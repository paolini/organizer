# Multi-stage Dockerfile for Next.js production
FROM node:24.14.1-bookworm AS builder
WORKDIR /app

# Install full dependencies for build
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Copy source and build the Next.js app
COPY . .
ENV NODE_ENV=production
RUN npm run build

# Remove devDependencies to keep only production modules
RUN npm prune --production

FROM node:24.14.1-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy only the built artifacts and production node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
# next.config.js not required/copied if not present in project

EXPOSE 3000
ENV PORT=3000

CMD ["npm", "run", "start"]
