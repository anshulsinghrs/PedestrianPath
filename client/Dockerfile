# Multi-stage build: compile the Vite app, then serve from nginx.
FROM node:20-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

COPY . ./

# Vite reads VITE_* env vars at build time. The compose file passes them
# in via build args; tweak in .env at repo root to redeploy for a new city.
ARG VITE_API_URL=""
ARG VITE_CITY_NAME="Mumbai"
ARG VITE_CITY_LAT="19.076"
ARG VITE_CITY_LNG="72.8777"
ARG VITE_CITY_ZOOM="12"
ARG VITE_CITY_LOCALE="en"
ARG VITE_CITY_OSM_BBOX=""
ARG VITE_MODULE3_ENABLED="false"
ARG VITE_MODULE3_QUICK_EXIT_URL=""

ENV VITE_API_URL=$VITE_API_URL \
    VITE_CITY_NAME=$VITE_CITY_NAME \
    VITE_CITY_LAT=$VITE_CITY_LAT \
    VITE_CITY_LNG=$VITE_CITY_LNG \
    VITE_CITY_ZOOM=$VITE_CITY_ZOOM \
    VITE_CITY_LOCALE=$VITE_CITY_LOCALE \
    VITE_CITY_OSM_BBOX=$VITE_CITY_OSM_BBOX \
    VITE_MODULE3_ENABLED=$VITE_MODULE3_ENABLED \
    VITE_MODULE3_QUICK_EXIT_URL=$VITE_MODULE3_QUICK_EXIT_URL

RUN npm run build


FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
