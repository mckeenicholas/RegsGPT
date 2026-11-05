FROM node:25-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

FROM node:25-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN npm run build

FROM node:25-alpine AS runtime

WORKDIR /app

# Persistent SQLite location
RUN mkdir -p /app/data

# Copy the build artifacts from the build stage
COPY --from=build /app/.output ./.output

EXPOSE 3000

CMD ["node", "./.output/server/index.mjs"]
