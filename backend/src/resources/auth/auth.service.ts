import bcrypt from "bcryptjs"

import type { User } from "../../generated/prisma/client.js"
import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../utils/AppError.js"
import type { LoginInput, PublicUser, RegisterInput } from "./auth.types.js"

const BCRYPT_ROUNDS = 12

const DUMMY_HASH: string = bcrypt.hashSync("senha-falsa", BCRYPT_ROUNDS)

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullname: user.fullname,
    role: user.role,
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
}

export async function registerService(
  input: RegisterInput,
): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  })
  if (existing) {
    throw new AppError(409, "E-mail já cadastrado")
  }

  const password = await bcrypt.hash(input.password, BCRYPT_ROUNDS)

  try {
    const user = await prisma.user.create({ data: { ...input, password } })
    return toPublicUser(user)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(409, "E-mail já cadastrado")
    }
    throw error
  }
}

export async function loginService(input: LoginInput): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { email: input.email } })

  const passwordMatches = await bcrypt.compare(
    input.password,
    user?.password ?? DUMMY_HASH,
  )

  if (!user || !passwordMatches) {
    throw new AppError(401, "E-mail ou senha inválidos")
  }

  return toPublicUser(user)
}

export async function getMeService(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new AppError(401, "Não autenticado")
  }
  return toPublicUser(user)
}
