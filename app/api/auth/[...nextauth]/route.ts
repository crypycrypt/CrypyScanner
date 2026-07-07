import { NextResponse } from 'next/server'
import NextAuth from 'next-auth'
import { authOptions } from '../../../../lib/nextauth'

const handler = NextAuth(authOptions as any)

export async function GET(request: Request) {
  return handler(request as any)
}

export async function POST(request: Request) {
  return handler(request as any)
}
