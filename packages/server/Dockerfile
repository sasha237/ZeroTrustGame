# Multi-stage build for the Balance of Terror M2 server.
# Build: full workspace install (engine is a workspace dep), compile engine + server.
# Run: production-only node_modules, compiled dist, migrations next to dist.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/tsconfig.json packages/engine/tsconfig.build.json packages/engine/
COPY packages/server/package.json packages/server/tsconfig.json packages/server/tsconfig.build.json packages/server/
RUN npm ci
COPY packages/engine/src packages/engine/src
COPY packages/server/src packages/server/src
COPY packages/server/migrations packages/server/migrations
RUN npm run build --workspace @bot/engine \
 && npm run build --workspace @bot/server

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/server/package.json packages/server/
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/packages/engine/dist packages/engine/dist
COPY --from=build /app/packages/server/dist packages/server/dist
COPY packages/server/migrations packages/server/migrations
# A-25: run as the unprivileged built-in node user (owns WORKDIR).
RUN chown -R node:node /app
USER node
EXPOSE 8080
CMD ["node", "packages/server/dist/index.js"]
