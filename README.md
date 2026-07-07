# WhaleRadar AI

A modern AI-powered Web3 analytics platform scaffold built with Next.js 15, TypeScript, TailwindCSS and Prisma.

This repository contains a starter scaffold for the WhaleRadar AI product. It includes base pages, styles and a Prisma schema to get started.

Quick start

1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies:

```bash
npm install
```

3. Run dev server:

```bash
npm run dev
```

Prisma

- Update `DATABASE_URL` in `.env` before running migrations.
- Use `npx prisma migrate dev` to create your DB schema.

Next steps

- Add NextAuth configuration, RainbowKit/wagmi wallet connectors, and AI provider integration.
- Implement dashboard features and connect real on-chain data sources.
