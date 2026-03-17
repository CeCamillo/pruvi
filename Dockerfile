# Stage 1: Install dependencies
FROM node:24-slim AS deps

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

# Copy workspace config and lockfile
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy all package.json files for workspace resolution
COPY apps/server/package.json apps/server/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/env/package.json packages/env/package.json
COPY packages/config/package.json packages/config/package.json

RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:24-slim AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

COPY --from=deps /app/ ./

# Copy source
COPY . .

# Build the server (tsdown bundles monorepo packages)
RUN pnpm --filter server run build

# Stage 3: Production image
FROM oven/bun:1-slim AS production

WORKDIR /app

# Copy built output
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/package.json ./package.json

# Copy node_modules needed at runtime
COPY --from=builder /app/node_modules ./node_modules

# Copy migrations for production DB setup
COPY --from=builder /app/packages/db/src/migrations ./migrations

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "dist/index.mjs"]
