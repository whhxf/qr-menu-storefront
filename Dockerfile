FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

# /data is the named volume mount (see docker-compose.yml). Do not move SQLite back into /app.
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    ADMIN_PASSWORD=changeme

RUN mkdir -p /data /data/uploads

EXPOSE 3000

VOLUME ["/data"]

CMD ["node", "src/server.js"]
