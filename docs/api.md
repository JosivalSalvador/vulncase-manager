# API

> Estado em 21/11/2026 (commit `932cbcb`). Este documento é um retrato do momento e vai mudar conforme o projeto avançar. A lista foi levantada a partir do código, então confirme com o código se algo parecer diferente.

A API roda por padrão em `http://localhost:3333` e responde sempre em JSON, exceto no download de evidências.

## Como usar

### Autenticação e CSRF

A autenticação é por sessão, com um cookie (`sid`). Em todas as chamadas o cliente precisa enviar os cookies (no `fetch`, `credentials: "include"`).

Qualquer requisição que não seja `GET` (inclusive `POST /auth/login` e `POST /auth/register`) exige um token CSRF:

1. Chame `GET /csrf-token`. A resposta é `{ "csrfToken": "..." }` e a API também grava um cookie de CSRF.
2. Envie esse token no cabeçalho `x-csrf-token` em cada `POST`, `PATCH` e `DELETE`.
3. O token é amarrado ao usuário da sessão, então **peça um token novo depois do login e depois do logout**. Um token pedido antes de logar deixa de valer.

Sem o token, a resposta é 403 com "Token CSRF inválido ou ausente".

### Papéis e permissões

| Termo | Significado |
| --- | --- |
| Logado | Qualquer usuário autenticado |
| Membro | Usuário que participa do projeto (o administrador conta como membro de todos) |
| Escrita | Papel `ADMIN` ou `ANALYST`. O papel `VIEWER` só lê |
| Dono | Quem criou o projeto |

Quem não é membro de um projeto recebe 404, como se o projeto não existisse.

### Formatos gerais

**Paginação.** As listagens aceitam `page` (padrão 1) e `pageSize` (padrão 10, máximo 100) e respondem:

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 10, "total": 0, "totalPages": 0 }
}
```

**Erros.** Sempre neste formato, com `details` presente só quando há problemas por campo:

```json
{
  "error": "Dados inválidos",
  "details": [{ "field": "title", "message": "..." }]
}
```

| Código | Quando acontece |
| --- | --- |
| 400 | Dados inválidos ou JSON malformado |
| 401 | Não autenticado, ou e-mail ou senha incorretos |
| 403 | Sem permissão ou token CSRF inválido |
| 404 | Recurso não encontrado, ou projeto de que o usuário não participa |
| 409 | Conflito (e-mail já cadastrado, transição de status inválida, limite de evidências, entre outros) |
| 413 | Arquivo ou corpo da requisição grande demais |
| 415 | Tipo de arquivo não permitido |
| 429 | Muitas tentativas de login ou cadastro |
| 500 | Erro interno |

## Geral

| Rota | Quem pode | O que faz |
| --- | --- | --- |
| `GET /health` | Qualquer um | Responde `{ "status": "ok" }` |
| `GET /csrf-token` | Qualquer um | Entrega o token CSRF |

## Autenticação (`/auth`)

| Rota | Quem pode | O que faz |
| --- | --- | --- |
| `POST /auth/register` | Qualquer um | Cria a conta. Devolve 201 com o usuário |
| `POST /auth/login` | Qualquer um | Inicia a sessão. Devolve o usuário |
| `POST /auth/logout` | Qualquer um | Encerra a sessão. Devolve 204 |
| `GET /auth/me` | Logado | Devolve o usuário da sessão |

- **Cadastro:** corpo com `fullname` (2 a 100 caracteres), `email` e `password` (8 a 72 caracteres). Toda conta nova começa como `ANALYST`.
- **Login:** corpo com `email` e `password`.
- O usuário devolvido tem `id`, `email`, `fullname` e `role`.
- Cadastro e login têm limite de tentativas (429).

## Projetos (`/projects`)

| Rota | Quem pode | O que faz |
| --- | --- | --- |
| `GET /projects` | Logado | Lista os projetos do usuário (o administrador vê todos). Aceita `search` |
| `POST /projects` | Escrita | Cria um projeto. O criador vira dono e membro |
| `GET /projects/:projectId` | Membro | Detalha o projeto |
| `PATCH /projects/:projectId` | Membro com escrita | Edita nome e descrição |
| `DELETE /projects/:projectId` | Dono ou administrador | Exclui o projeto, com ativos, achados e evidências |

Corpo de criação: `name` (3 a 120 caracteres) e `description` (opcional, até 2000). A edição aceita qualquer um dos dois campos.

## Ativos (`/projects/:projectId/assets`)

| Rota | Quem pode | O que faz |
| --- | --- | --- |
| `GET /` | Membro | Lista os ativos. Filtros: `type` e `search` |
| `POST /` | Membro com escrita | Cria um ativo |
| `GET /:assetId` | Membro | Detalha o ativo |
| `PATCH /:assetId` | Membro com escrita | Edita o ativo |
| `DELETE /:assetId` | Membro com escrita | Exclui o ativo. Os achados dele ficam sem ativo |

Corpo: `name` (2 a 120), `type` (`WEB`, `MOBILE`, `NETWORK` ou `CODE`) e `identifier` (opcional, até 255, como URL, IP ou repositório).

## Membros (`/projects/:projectId/members`)

| Rota | Quem pode | O que faz |
| --- | --- | --- |
| `GET /` | Membro | Lista os membros |
| `POST /` | Dono ou administrador | Adiciona um membro pelo e-mail |
| `DELETE /:userId` | Dono ou administrador, ou o próprio membro | Remove o membro. O dono não pode ser removido |

- Corpo de `POST`: `{ "email": "..." }`. Responde 404 se o e-mail não tiver conta e 409 se a pessoa já for membro.
- Cada item da lista tem `userId`, `fullname`, `email`, `role`, `isOwner` e `joinedAt`.
- Quando um membro sai, os achados sob responsabilidade dele ficam sem responsável.

## Achados (`/projects/:projectId/findings`)

| Rota | Quem pode | O que faz |
| --- | --- | --- |
| `GET /` | Membro | Lista os achados, com filtros |
| `POST /` | Membro com escrita | Registra um achado. Ele nasce com status `OPEN` |
| `GET /:findingId` | Membro | Detalha o achado |
| `PATCH /:findingId` | Membro com escrita | Edita o achado (não altera o status) |
| `DELETE /:findingId` | Quem registrou, dono ou administrador | Exclui o achado, com evidências e histórico |
| `PATCH /:findingId/status` | Membro com escrita | Muda o status, respeitando as transições permitidas |
| `GET /:findingId/history` | Membro | Lista o histórico de status, do mais antigo ao mais novo |

**Filtros da listagem:** `severity`, `status`, `assigneeId`, `assetId`, `search` (no título), `overdue=true` (só os vencidos) e `staleDays=N` (só os abertos há mais de N dias, de 1 a 365). A ordem é da severidade mais grave para a menos grave e, dentro da mesma, os mais novos primeiro.

**Corpo de criação:**

```json
{
  "title": "SQL Injection no login",
  "description": "O campo de e-mail aceita aspas e altera a consulta.",
  "severity": "HIGH",
  "remediation": "Usar consultas parametrizadas.",
  "owaspCategory": "A03:2021",
  "cwe": "CWE-89",
  "cve": null,
  "dueDate": "2026-12-31",
  "assetId": null,
  "assigneeId": null
}
```

- Obrigatórios: `title` (3 a 200 caracteres), `description` (10 a 10000) e `severity`. Os demais são opcionais e podem ser `null`.
- `severity`: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` ou `INFO`.
- `owaspCategory` precisa existir no catálogo (consulte `GET /catalog/owasp`). `cwe` segue o formato `CWE-89` e `cve` o formato `CVE-2024-12345`.
- `dueDate` no formato `AAAA-MM-DD`.
- `assetId` e `assigneeId` precisam pertencer ao mesmo projeto. O responsável tem de ser membro dele.
- A edição aceita qualquer subconjunto desses campos, com pelo menos um.

**Mudança de status:** corpo `{ "status": "FIXED" }`. Os valores são `OPEN`, `IN_PROGRESS`, `FIXED`, `VERIFIED`, `ACCEPTED_RISK` e `FALSE_POSITIVE`. Uma transição não permitida (ou para o mesmo status) responde 409 listando as opções válidas. O mapa de transições está em [`arquitetura.md`](arquitetura.md).

O achado devolvido traz também `asset`, `assignee` e `reporter` (com `id` e nome). Cada item do histórico traz `fromStatus`, `toStatus`, `createdAt` e `changedBy`.

## Evidências (`/projects/:projectId/findings/:findingId/evidence`)

| Rota | Quem pode | O que faz |
| --- | --- | --- |
| `GET /` | Membro | Lista as evidências do achado |
| `POST /` | Membro com escrita | Envia uma evidência |
| `GET /:evidenceId/download` | Membro | Baixa o arquivo |
| `DELETE /:evidenceId` | Quem enviou, dono ou administrador | Exclui a evidência e o arquivo |

- O envio é `multipart/form-data`, com **um** arquivo no campo `file` e nenhum outro campo.
- Limites: 5 MB por arquivo e 10 evidências por achado.
- Tipos aceitos: PNG, JPEG, WEBP, GIF, PDF e texto puro. O tipo é detectado pelo conteúdo, não pela extensão.
- Erros de envio: 400 (sem arquivo, arquivo vazio ou campo errado), 413 (maior que 5 MB), 415 (tipo não permitido) e 409 (limite de 10 atingido).
- A listagem responde `{ "data": [...] }`, com `id`, `originalName`, `mimeType`, `size`, `createdAt` e `uploadedBy` em cada item.
- O download sempre vem como anexo.

## Estatísticas

| Rota | Quem pode | O que faz |
| --- | --- | --- |
| `GET /projects/:projectId/stats` | Membro | Números de um projeto |
| `GET /stats` | Logado | Visão geral dos projetos do usuário (o administrador vê todos) |

Os dois aceitam `staleDays` (de 1 a 365, padrão 30), que define a partir de quantos dias um achado aberto conta como "parado".

**Por projeto** devolve: `total`, `open` (abertos), `overdue` (vencidos), `stale` (parados), `staleDays`, `bySeverity`, `openBySeverity`, `byStatus` e `byOwasp` (lista de `{ category, count }` em ordem decrescente). Todas as severidades e status aparecem, mesmo com zero achados.

**Visão geral** devolve `totals` (`total`, `open`, `openCritical`, `overdue`, `stale`, `staleDays`, `bySeverity` e `byStatus`) e `projects`, uma lista com `id`, `name`, `total`, `open`, `openCritical` e `overdue` de cada projeto (até 100, por ordem de nome). Os totais consideram todos os projetos, mesmo se a lista cortar em 100.

"Aberto" é o achado em `OPEN` ou `IN_PROGRESS`. "Vencido" é um achado aberto com prazo anterior a hoje (calculado em UTC).

## Catálogo (`/catalog`)

| Rota | Quem pode | O que faz |
| --- | --- | --- |
| `GET /catalog/owasp` | Logado | Lista as categorias do OWASP Top 10. Filtro opcional `edition` (`2021` ou `2025`) |
| `GET /catalog/cwe` | Logado | Lista os CWE. Filtro opcional `search`, por código (`89` ou `CWE-89`) ou por parte do nome |

As duas respondem `{ "data": [...] }`. Cada categoria OWASP traz `code`, `edition`, `name` (oficial, em inglês) e `namePt` (tradução). Cada CWE traz `code` e `name`.

## Ainda não existe

- Exportação de relatório
- Resumo automático dos achados
- Deduplicação (em andamento)
- Gerenciamento de usuários e papéis
- Recuperação e troca de senha