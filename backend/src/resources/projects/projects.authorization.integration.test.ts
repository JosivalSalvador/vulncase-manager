import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { app } from "../../app.js"
import type { Role } from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"
import { redis } from "../../lib/redis.js"
import {
  addMember,
  createAsset,
  createFinding,
  createProject,
  errorOf,
  send,
  type Call,
} from "../../test/fixtures.js"
import {
  bodyOf,
  cleanupTestUsers,
  createUser,
  signIn,
  startServer,
  TestClient,
  uniqueEmail,
  type ApiResponse,
  type TestServer,
} from "../../test/helpers.js"

interface Actor {
  id: string
  email: string
  client: TestClient
}

let server: TestServer
let anonymous: TestClient
let owner: Actor
let member: Actor
let viewer: Actor
let outsider: Actor
let admin: Actor

// O projeto compartilhado pelos testes de leitura e de permissão.
let projectId: string
let assetId: string
let ownerFindingId: string
let memberFindingId: string

// Um UUID válido que não existe no banco.
const MISSING_ID: string = randomUUID()

// Cria o usuário no banco e já faz o login de verdade.
async function newActor(role: Role, label: string): Promise<Actor> {
  const user = await createUser({ role, email: uniqueEmail(label) })
  return {
    id: user.id,
    email: user.email,
    client: await signIn(server.baseUrl, user.email),
  }
}

// Chamadas que só um membro do projeto pode fazer (ou que só existem para ele).
// Para quem não é membro, TODAS devem dar o mesmo 404.
function projectCalls(): Call[] {
  const base = `/projects/${projectId}`
  return [
    { method: "GET", path: base },
    { method: "PATCH", path: base, body: { name: "Nome trocado" } },
    { method: "DELETE", path: base },
    { method: "GET", path: `${base}/assets` },
    { method: "GET", path: `${base}/assets/${assetId}` },
    {
      method: "POST",
      path: `${base}/assets`,
      body: { name: "Ativo novo", type: "WEB" },
    },
    { method: "GET", path: `${base}/members` },
    { method: "POST", path: `${base}/members`, body: { email: member.email } },
    { method: "GET", path: `${base}/findings` },
    { method: "GET", path: `${base}/findings/${ownerFindingId}` },
    { method: "GET", path: `${base}/findings/${ownerFindingId}/history` },
    { method: "GET", path: `${base}/findings/${ownerFindingId}/evidence` },
    {
      method: "POST",
      path: `${base}/findings`,
      body: {
        title: "Achado intruso",
        description: "Tentativa de criar achado sem ser membro.",
        severity: "LOW",
      },
    },
    {
      method: "PATCH",
      path: `${base}/findings/${ownerFindingId}`,
      body: { title: "Título trocado" },
    },
    {
      method: "PATCH",
      path: `${base}/findings/${ownerFindingId}/status`,
      body: { status: "IN_PROGRESS" },
    },
    { method: "DELETE", path: `${base}/findings/${ownerFindingId}` },
    { method: "GET", path: `${base}/stats` },
    { method: "GET", path: `${base}/report?format=csv` },
    { method: "GET", path: `${base}/summary` },
  ]
}

beforeAll(async (): Promise<void> => {
  await redis.connect()
  server = await startServer(app)

  anonymous = new TestClient(server.baseUrl)
  await anonymous.refreshCsrf()

  owner = await newActor("ANALYST", "dono")
  member = await newActor("ANALYST", "membro")
  viewer = await newActor("VIEWER", "leitor")
  outsider = await newActor("ANALYST", "de-fora")
  admin = await newActor("ADMIN", "admin")

  projectId = await createProject(owner.client, "Portal RH")
  assetId = await createAsset(owner.client, projectId)
  await addMember(owner.client, projectId, member.email)
  await addMember(owner.client, projectId, viewer.email)
  ownerFindingId = await createFinding(owner.client, projectId, {
    title: "SQL Injection no login",
  })
  memberFindingId = await createFinding(member.client, projectId, {
    title: "CSRF na troca de e-mail",
  })
})

afterAll(async (): Promise<void> => {
  await cleanupTestUsers()
  await server.close()
  await redis.quit()
  await prisma.$disconnect()
})

describe("sem login", (): void => {
  const calls: Call[] = [
    { method: "GET", path: "/projects" },
    { method: "POST", path: "/projects", body: { name: "Projeto novo" } },
    { method: "GET", path: `/projects/${MISSING_ID}` },
    { method: "GET", path: `/projects/${MISSING_ID}/findings` },
    { method: "GET", path: "/stats" },
    { method: "GET", path: "/catalog/owasp" },
    { method: "GET", path: "/users" },
  ]

  it.each(calls)("$method $path dá 401", async (call: Call): Promise<void> => {
    const response: ApiResponse = await send(anonymous, call)

    expect(response.status).toBe(401)
    expect(errorOf(response)).toBe("Não autenticado")
  })
})

describe("quem não é membro do projeto", (): void => {
  it("recebe 404 em todas as rotas do projeto, leitura e escrita", async (): Promise<void> => {
    for (const call of projectCalls()) {
      const response: ApiResponse = await send(outsider.client, call)

      expect(response.status, `${call.method} ${call.path}`).toBe(404)
      expect(errorOf(response), `${call.method} ${call.path}`).toBe(
        "Projeto não encontrado",
      )
    }
  })

  it("as tentativas de escrita não mudam nada no banco", async (): Promise<void> => {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    })

    expect(project.name).toBe("Portal RH")
    expect(await prisma.asset.count({ where: { projectId } })).toBe(1)
    expect(await prisma.finding.count({ where: { projectId } })).toBe(2)
    expect(await prisma.projectMember.count({ where: { projectId } })).toBe(3)
  })

  it("o 404 é igual ao de um projeto que não existe (não revela que ele existe)", async (): Promise<void> => {
    const existing: ApiResponse = await outsider.client.request(
      "GET",
      `/projects/${projectId}`,
    )
    const missing: ApiResponse = await outsider.client.request(
      "GET",
      `/projects/${MISSING_ID}`,
    )

    expect(existing.status).toBe(404)
    expect(missing.status).toBe(404)
    expect(existing.body).toEqual(missing.body)
  })

  it("não vê o projeto na lista, e quem é membro vê", async (): Promise<void> => {
    const idsFor = async (actor: Actor): Promise<string[]> => {
      const response: ApiResponse = await actor.client.request(
        "GET",
        "/projects?pageSize=100",
      )
      expect(response.status).toBe(200)
      const data = bodyOf(response)["data"] as Array<{ id: string }>
      return data.map((project): string => project.id)
    }

    expect(await idsFor(outsider)).not.toContain(projectId)
    expect(await idsFor(member)).toContain(projectId)
    expect(await idsFor(viewer)).toContain(projectId)
  })

  it("o projeto também não entra nos números da visão geral", async (): Promise<void> => {
    const response: ApiResponse = await outsider.client.request("GET", "/stats")

    expect(response.status).toBe(200)
    expect(JSON.stringify(response.body)).not.toContain(projectId)
  })
})

describe("VIEWER (membro só de leitura)", (): void => {
  it("lê o projeto, os ativos, os achados e os números", async (): Promise<void> => {
    const reads: Call[] = [
      { method: "GET", path: `/projects/${projectId}` },
      { method: "GET", path: `/projects/${projectId}/assets` },
      { method: "GET", path: `/projects/${projectId}/assets/${assetId}` },
      { method: "GET", path: `/projects/${projectId}/members` },
      { method: "GET", path: `/projects/${projectId}/findings` },
      {
        method: "GET",
        path: `/projects/${projectId}/findings/${ownerFindingId}`,
      },
      {
        method: "GET",
        path: `/projects/${projectId}/findings/${ownerFindingId}/history`,
      },
      {
        method: "GET",
        path: `/projects/${projectId}/findings/${ownerFindingId}/evidence`,
      },
      { method: "GET", path: `/projects/${projectId}/stats` },
      { method: "GET", path: `/projects/${projectId}/report?format=csv` },
      { method: "GET", path: `/projects/${projectId}/summary` },
    ]

    for (const call of reads) {
      const response: ApiResponse = await send(viewer.client, call)
      expect(response.status, `${call.method} ${call.path}`).toBe(200)
    }
  })

  it("não escreve em nada: 403 em todas as rotas de escrita", async (): Promise<void> => {
    const base = `/projects/${projectId}`
    const writes: Call[] = [
      { method: "POST", path: "/projects", body: { name: "Projeto novo" } },
      { method: "PATCH", path: base, body: { name: "Nome trocado" } },
      { method: "DELETE", path: base },
      {
        method: "POST",
        path: `${base}/assets`,
        body: { name: "Ativo novo", type: "WEB" },
      },
      {
        method: "PATCH",
        path: `${base}/assets/${assetId}`,
        body: { name: "Ativo trocado" },
      },
      { method: "DELETE", path: `${base}/assets/${assetId}` },
      {
        method: "POST",
        path: `${base}/findings`,
        body: {
          title: "Achado do leitor",
          description: "Um leitor não pode registrar achados.",
          severity: "LOW",
        },
      },
      {
        method: "PATCH",
        path: `${base}/findings/${ownerFindingId}`,
        body: { title: "Título trocado" },
      },
      {
        method: "PATCH",
        path: `${base}/findings/${ownerFindingId}/status`,
        body: { status: "IN_PROGRESS" },
      },
      { method: "DELETE", path: `${base}/findings/${ownerFindingId}` },
      { method: "POST", path: `${base}/findings/${ownerFindingId}/evidence` },
      {
        method: "POST",
        path: `${base}/members`,
        body: { email: outsider.email },
      },
    ]

    for (const call of writes) {
      const response: ApiResponse = await send(viewer.client, call)
      expect(response.status, `${call.method} ${call.path}`).toBe(403)
    }
  })

  it("as tentativas de escrita não mudam nada no banco", async (): Promise<void> => {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    })
    const finding = await prisma.finding.findUniqueOrThrow({
      where: { id: ownerFindingId },
    })

    expect(project.name).toBe("Portal RH")
    expect(finding.title).toBe("SQL Injection no login")
    expect(finding.status).toBe("OPEN")
    expect(await prisma.asset.count({ where: { projectId } })).toBe(1)
    expect(await prisma.finding.count({ where: { projectId } })).toBe(2)
    expect(await prisma.projectMember.count({ where: { projectId } })).toBe(3)
  })
})

describe("ANALYST que é membro, mas não é o dono", (): void => {
  it("registra achado em nome dele (quem registrou vem da sessão)", async (): Promise<void> => {
    const response: ApiResponse = await member.client.request(
      "POST",
      `/projects/${projectId}/findings`,
      {
        body: {
          title: "Cookie sem HttpOnly",
          description: "O cookie de preferências pode ser lido por scripts.",
          severity: "LOW",
        },
        csrf: true,
      },
    )

    expect(response.status).toBe(201)
    expect(bodyOf(response)["reporter"]).toMatchObject({ id: member.id })
  })

  it("não exclui o projeto: 403, e o projeto continua lá", async (): Promise<void> => {
    const response: ApiResponse = await member.client.request(
      "DELETE",
      `/projects/${projectId}`,
      { csrf: true },
    )

    expect(response.status).toBe(403)
    expect(await prisma.project.count({ where: { id: projectId } })).toBe(1)
  })

  it("não adiciona membros nem remove os outros", async (): Promise<void> => {
    const add: ApiResponse = await member.client.request(
      "POST",
      `/projects/${projectId}/members`,
      { body: { email: outsider.email }, csrf: true },
    )
    const remove: ApiResponse = await member.client.request(
      "DELETE",
      `/projects/${projectId}/members/${viewer.id}`,
      { csrf: true },
    )

    expect(add.status).toBe(403)
    expect(remove.status).toBe(403)
    expect(await prisma.projectMember.count({ where: { projectId } })).toBe(3)
  })

  it("não exclui o achado de outra pessoa, mas exclui o que ele mesmo registrou", async (): Promise<void> => {
    const others: ApiResponse = await member.client.request(
      "DELETE",
      `/projects/${projectId}/findings/${ownerFindingId}`,
      { csrf: true },
    )
    const mine: ApiResponse = await member.client.request(
      "DELETE",
      `/projects/${projectId}/findings/${memberFindingId}`,
      { csrf: true },
    )

    expect(others.status).toBe(403)
    expect(mine.status).toBe(204)
    expect(await prisma.finding.count({ where: { id: ownerFindingId } })).toBe(
      1,
    )
    expect(await prisma.finding.count({ where: { id: memberFindingId } })).toBe(
      0,
    )
  })

  it("sai do projeto sozinho e perde o acesso na hora", async (): Promise<void> => {
    const ownProject: string = await createProject(owner.client, "Projeto Beta")
    await addMember(owner.client, ownProject, member.email)

    const before: ApiResponse = await member.client.request(
      "GET",
      `/projects/${ownProject}`,
    )
    const leave: ApiResponse = await member.client.request(
      "DELETE",
      `/projects/${ownProject}/members/${member.id}`,
      { csrf: true },
    )
    const after: ApiResponse = await member.client.request(
      "GET",
      `/projects/${ownProject}`,
    )

    expect(before.status).toBe(200)
    expect(leave.status).toBe(204)
    expect(after.status).toBe(404)
  })
})

describe("dono do projeto", (): void => {
  it("adiciona membro: 201, e 409 se já for membro", async (): Promise<void> => {
    const ownProject: string = await createProject(owner.client, "Projeto Gama")
    const call: Call = {
      method: "POST",
      path: `/projects/${ownProject}/members`,
      body: { email: member.email },
    }

    const first: ApiResponse = await send(owner.client, call)
    const second: ApiResponse = await send(owner.client, call)

    expect(first.status).toBe(201)
    expect(second.status).toBe(409)
  })

  it("e-mail que não existe dá 404, sem dizer mais nada", async (): Promise<void> => {
    const response: ApiResponse = await owner.client.request(
      "POST",
      `/projects/${projectId}/members`,
      { body: { email: uniqueEmail("ninguem") }, csrf: true },
    )

    expect(response.status).toBe(404)
    expect(errorOf(response)).toBe("Usuário não encontrado")
  })

  it("o dono não pode ser removido, nem por ele mesmo nem pelo ADMIN", async (): Promise<void> => {
    const byOwner: ApiResponse = await owner.client.request(
      "DELETE",
      `/projects/${projectId}/members/${owner.id}`,
      { csrf: true },
    )
    const byAdmin: ApiResponse = await admin.client.request(
      "DELETE",
      `/projects/${projectId}/members/${owner.id}`,
      { csrf: true },
    )

    expect(byOwner.status).toBe(409)
    expect(byAdmin.status).toBe(409)
  })

  it("exclui o achado de outro membro e, por fim, o próprio projeto", async (): Promise<void> => {
    const ownProject: string = await createProject(
      owner.client,
      "Projeto Delta",
    )
    await addMember(owner.client, ownProject, member.email)
    const findingId: string = await createFinding(member.client, ownProject)

    const removeFinding: ApiResponse = await owner.client.request(
      "DELETE",
      `/projects/${ownProject}/findings/${findingId}`,
      { csrf: true },
    )
    const removeProject: ApiResponse = await owner.client.request(
      "DELETE",
      `/projects/${ownProject}`,
      { csrf: true },
    )
    const after: ApiResponse = await owner.client.request(
      "GET",
      `/projects/${ownProject}`,
    )

    expect(removeFinding.status).toBe(204)
    expect(removeProject.status).toBe(204)
    expect(after.status).toBe(404)
  })
})

describe("ADMIN", (): void => {
  it("acessa o projeto sem ser membro, e o projeto aparece na lista dele", async (): Promise<void> => {
    const project: ApiResponse = await admin.client.request(
      "GET",
      `/projects/${projectId}`,
    )
    const list: ApiResponse = await admin.client.request(
      "GET",
      "/projects?pageSize=100",
    )
    const ids = (bodyOf(list)["data"] as Array<{ id: string }>).map(
      (item): string => item.id,
    )

    expect(project.status).toBe(200)
    expect(ids).toContain(projectId)
  })

  it("projeto que não existe continua dando 404, até para ele", async (): Promise<void> => {
    const response: ApiResponse = await admin.client.request(
      "GET",
      `/projects/${MISSING_ID}`,
    )

    expect(response.status).toBe(404)
  })

  it("adiciona membro, edita e exclui o projeto de outra pessoa", async (): Promise<void> => {
    const ownProject: string = await createProject(
      owner.client,
      "Projeto Ômega",
    )

    const add: ApiResponse = await admin.client.request(
      "POST",
      `/projects/${ownProject}/members`,
      { body: { email: viewer.email }, csrf: true },
    )
    const edit: ApiResponse = await admin.client.request(
      "PATCH",
      `/projects/${ownProject}`,
      { body: { name: "Projeto Ômega 2" }, csrf: true },
    )
    const remove: ApiResponse = await admin.client.request(
      "DELETE",
      `/projects/${ownProject}`,
      { csrf: true },
    )

    expect(add.status).toBe(201)
    expect(edit.status).toBe(200)
    expect(remove.status).toBe(204)
  })
})

describe("gestão de usuários (só ADMIN)", (): void => {
  it("ADMIN lista os usuários, sem a senha", async (): Promise<void> => {
    const response: ApiResponse = await admin.client.request(
      "GET",
      `/users?search=${encodeURIComponent(owner.email)}`,
    )

    expect(response.status).toBe(200)
    expect(JSON.stringify(response.body)).not.toContain("password")
    expect(JSON.stringify(response.body)).toContain(owner.email)
  })

  it("ANALYST e VIEWER recebem 403 ao listar e ao mudar papel", async (): Promise<void> => {
    for (const actor of [owner, viewer]) {
      const list: ApiResponse = await actor.client.request("GET", "/users")
      const role: ApiResponse = await actor.client.request(
        "PATCH",
        `/users/${outsider.id}/role`,
        { body: { role: "ADMIN" }, csrf: true },
      )

      expect(list.status).toBe(403)
      expect(role.status).toBe(403)
    }

    const saved = await prisma.user.findUniqueOrThrow({
      where: { id: outsider.id },
    })
    expect(saved.role).toBe("ANALYST")
  })

  it("ninguém muda o próprio papel, nem o ADMIN", async (): Promise<void> => {
    const response: ApiResponse = await admin.client.request(
      "PATCH",
      `/users/${admin.id}/role`,
      { body: { role: "VIEWER" }, csrf: true },
    )

    expect(response.status).toBe(409)
  })

  it("o papel novo vale na hora, sem precisar de novo login", async (): Promise<void> => {
    const analyst: Actor = await newActor("ANALYST", "rebaixado")
    const call: Call = {
      method: "POST",
      path: "/projects",
      body: { name: "Projeto do rebaixado" },
    }

    const before: ApiResponse = await send(analyst.client, call)
    const change: ApiResponse = await admin.client.request(
      "PATCH",
      `/users/${analyst.id}/role`,
      { body: { role: "VIEWER" }, csrf: true },
    )
    const after: ApiResponse = await send(analyst.client, call)

    expect(before.status).toBe(201)
    expect(change.status).toBe(200)
    expect(after.status).toBe(403)
  })
})
