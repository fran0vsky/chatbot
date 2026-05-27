# syntax=docker/dockerfile:1.7
# Multi-stage build for the NestJS backend.

# ---------- Stage 1: build ----------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY nx.json tsconfig.json tsconfig.base.json ./
COPY libs/ libs/

RUN npm ci --legacy-peer-deps

COPY apps/backend ./apps/backend

RUN npx nx sync && npx nx build backend --configuration=production

# ---------- Stage 2: runtime --------------------------------------------------
FROM node:24-alpine AS runner

# Tini for proper signal handling (PID 1 in Node ignores SIGTERM otherwise)
RUN apk add --no-cache tini

WORKDIR /app

# Run as non-root user
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder --chown=app:app /app/apps/backend/dist ./dist
COPY --from=builder --chown=app:app /app/package*.json ./

RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force && \
    chown -R app:app /app

USER app

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
