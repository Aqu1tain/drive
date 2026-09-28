# syntax=docker/dockerfile:1
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm rebuild sharp esbuild && pnpm build \
 && cp scripts/migrate.mjs .output/server/migrate.mjs \
 && cp -r server/database/migrations .output/migrations

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000 \
    MIGRATIONS_DIR=/app/.output/migrations \
    NUXT_STORAGE_LOCAL_DIR=/data/storage
COPY --from=build --chown=node:node /app/.output ./.output
RUN mkdir -p /data/storage && chown -R node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/setup').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["sh", "-c", "node .output/server/migrate.mjs && exec node .output/server/index.mjs"]
