import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

// Prisma validates that DATABASE_URL exists the moment PrismaClient is
// constructed — not just when a query runs. This file is imported by
// app/api/auth/[...nextauth]/route.ts, and Next.js's build statically loads
// every route to collect its metadata, so a totally-unset DATABASE_URL (no
// database provisioned yet) throws here and takes the ENTIRE build down,
// even though nothing outside login actually touches Prisma. Falling back
// to an obviously-fake connection string lets construction succeed; only an
// actual query (i.e. someone trying to sign in) then fails at runtime with
// a normal connection error instead of blocking deployment. Once a real
// DATABASE_URL is set in the environment, it's used as-is.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://unset:unset@localhost:5432/unset'
}

export const prisma = global.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export default prisma
