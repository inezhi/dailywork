FROM node:24-bookworm-slim AS build

WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN corepack enable && corepack prepare pnpm@10.18.3 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @daily/web build
RUN pnpm --filter @daily/server build

FROM node:24-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV DAILYWORK_DATA_DIR=/data
ENV DAILYWORK_HOST=0.0.0.0
ENV DAILYWORK_PORT=47821
ENV DAILYWORK_WEB_DIST=/app/web
ENV DAILYWORK_SERVER_MODE=1

COPY --from=build --chown=node:node /app/apps/server/dist/server.mjs /app/server.mjs
COPY --from=build --chown=node:node /app/apps/web/dist /app/web

RUN mkdir -p /data && chown node:node /data

USER node
VOLUME ["/data"]
EXPOSE 47821

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:47821/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "/app/server.mjs"]
