FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY nx.json tsconfig.json tsconfig.base.json ./
COPY libs/ libs/

RUN npm ci --legacy-peer-deps

COPY apps/backend ./apps/backend

RUN npx nx sync && npx nx build backend --prod

# ---- Production image ----
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist/apps/backend ./dist
COPY --from=builder /app/package*.json ./

RUN npm ci --omit=dev --legacy-peer-deps

EXPOSE 3000

CMD ["node", "dist/main.js"]
