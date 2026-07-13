FROM node:20-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

# sharp ships prebuilt binaries for the standard Node image; no
# native build deps required on bookworm-slim.

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . ./

RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "server.js"]
