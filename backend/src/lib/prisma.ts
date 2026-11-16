import { PrismaMariaDb } from "@prisma/adapter-mariadb"

import { PrismaClient } from "../generated/prisma/client.js"
import { env } from "../utils/getEnv.js"

const adapter: PrismaMariaDb = new PrismaMariaDb(env.DATABASE_URL)

export const prisma: PrismaClient = new PrismaClient({ adapter })