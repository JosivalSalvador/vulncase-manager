FROM node:24-alpine3.23 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:24-alpine3.23 AS development
WORKDIR /app
ENV NODE_ENV=development
COPY package*.json ./
RUN npm ci
EXPOSE 3333
CMD ["npm", "start"]

FROM node:24-alpine3.23 AS tests
WORKDIR /app
COPY package*.json ./
RUN npm ci
ENV NODE_ENV=test
COPY . .
RUN npx prisma generate
EXPOSE 3333
CMD ["npm", "start"]

# Último stage: é o que "docker build" gera quando não se passa --target.
FROM node:24-alpine3.23 AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
# O código fica com dono root (somente leitura para o app).
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3333
CMD ["node", "dist/main.js"]