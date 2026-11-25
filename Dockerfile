# syntax=docker/dockerfile:1

# Static assets are architecture independent; build once on the builder's platform.
FROM --platform=$BUILDPLATFORM node:26-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY script/prepare-web-data.ts ./script/prepare-web-data.ts
COPY data/data.csv ./data/data.csv
RUN npm run build

FROM nginx:stable-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
