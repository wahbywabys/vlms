# VTC_LMS API. Build from the repository root so db/ (schema and seeds) is in the image:
#   docker build -f api/Dockerfile .
FROM node:22-slim
WORKDIR /srv/api
COPY api/package.json api/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY api/ ./
COPY db/ /srv/db/
ENV NODE_ENV=production DB_DIR=/srv/db PORT=4000
EXPOSE 4000
CMD ["npx", "tsx", "src/server.ts"]
