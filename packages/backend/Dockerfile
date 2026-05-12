# Stage 1: Build (install deps, generate prisma, compile TS)
FROM node:18-alpine AS builder

WORKDIR /app

# Install build tooling for native deps (if any)
RUN apk add --no-cache libc6-compat

# Copy package manifests
COPY package*.json ./
COPY tsconfig.json ./

# Copy prisma schema/config
COPY prisma ./prisma

# Install dependencies (including dev deps for tsc)
RUN npm ci

# Generate Prisma client during build
RUN npx prisma generate

# Copy source and build
COPY src ./src
RUN npm run build

# Stage 2: Runtime (lean, generate already done)
FROM node:18-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

RUN apk add --no-cache libc6-compat

# Copy production node_modules + built dist + prisma
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 8080

CMD ["node", "dist/index.js"]

