# ---- build the Angular app ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY angular.json tsconfig.json tsconfig.app.json ./
COPY public ./public
COPY src ./src
RUN npm run build

# ---- runtime: Express serves the API and the built app ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY --from=build /app/dist ./dist

# Persisted org chart lives here; compose mounts ./data onto it.
ENV DATA_DIR=/app/data
ENV PORT=80
VOLUME ["/app/data"]

EXPOSE 80
CMD ["node", "server/index.mjs"]
