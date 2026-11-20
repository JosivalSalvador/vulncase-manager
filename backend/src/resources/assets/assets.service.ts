import type { Asset } from "../../generated/prisma/client.js"
import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../utils/AppError.js"
import { omitUndefined } from "../../utils/omitUndefined.js"
import { getSkip, toPaginated, type Paginated } from "../../utils/pagination.js"
import type {
  CreateAssetInput,
  ListAssetsQuery,
  UpdateAssetInput,
} from "./assets.types.js"

// Em TODAS as consultas o projectId entra no "where". Sem isso, um membro do
// projeto A poderia ler ou apagar um ativo do projeto B só trocando o assetId.

export async function createAssetService(
  projectId: string,
  input: CreateAssetInput,
): Promise<Asset> {
  return prisma.asset.create({
    data: {
      name: input.name,
      type: input.type,
      identifier: input.identifier,
      projectId,
    },
  })
}

export async function listAssetsService(
  projectId: string,
  query: ListAssetsQuery,
): Promise<Paginated<Asset>> {
  const { page, pageSize, type, search } = query

  const where = {
    projectId,
    ...(type ? { type } : {}),
    ...(search ? { name: { contains: search } } : {}),
  }

  const [assets, total] = await prisma.$transaction([
    prisma.asset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: getSkip(page, pageSize),
      take: pageSize,
    }),
    prisma.asset.count({ where }),
  ])

  return toPaginated(assets, total, page, pageSize)
}

export async function getAssetService(
  projectId: string,
  assetId: string,
): Promise<Asset> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId, projectId },
  })
  if (!asset) {
    throw new AppError(404, "Ativo não encontrado")
  }
  return asset
}

export async function updateAssetService(
  projectId: string,
  assetId: string,
  input: UpdateAssetInput,
): Promise<Asset> {
  // Se o ativo não existir nesse projeto, o Prisma lança P2025 (vira 404).
  return prisma.asset.update({
    where: { id: assetId, projectId },
    data: omitUndefined(input),
  })
}

export async function deleteAssetService(
  projectId: string,
  assetId: string,
): Promise<void> {
  await prisma.asset.delete({ where: { id: assetId, projectId } })
}
