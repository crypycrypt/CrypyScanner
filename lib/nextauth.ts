import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import EmailProvider from 'next-auth/providers/email'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import prisma from './prisma'

export const authOptions = {
  adapter: PrismaAdapter(prisma as any),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || ''
    }),
    EmailProvider({
      server: process.env.EMAIL_SERVER || '',
      from: process.env.EMAIL_FROM || ''
    })
  ],
  secret: process.env.NEXTAUTH_SECRET,
}

export default NextAuth(authOptions)
