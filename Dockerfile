# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY prisma ./prisma/
RUN bunx prisma generate

COPY tsconfig.json ./
COPY src ./src/
RUN bun run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
COPY prisma ./prisma/

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
