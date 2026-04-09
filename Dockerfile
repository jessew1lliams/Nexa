# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/server/tsconfig.json ./apps/server/tsconfig.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/web/tsconfig.json ./apps/web/tsconfig.json

RUN npm ci

COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist

EXPOSE 3001
CMD ["npm", "run", "start"]
