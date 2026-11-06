# Single image: builds the whole monorepo, then runs the server, which also serves the web build.
FROM node:22-alpine

# Prisma's query engine needs OpenSSL (it picks the musl + OpenSSL 3 engine on Alpine).
RUN apk add --no-cache openssl

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# Install dependencies first so this layer is cached until a manifest changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# The server's postinstall runs `prisma generate`, which needs the schema.
COPY apps/server/prisma apps/server/prisma
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

ENV NODE_ENV=production
EXPOSE 3000
# Applies pending migrations, then starts the API + bot + static web.
CMD ["pnpm", "start"]
