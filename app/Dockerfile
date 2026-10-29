# VTC_LMS web app (Next.js standalone server). Build from the repository root:
#   docker build -f app/Dockerfile .
FROM node:22-slim AS build
WORKDIR /srv/app
COPY app/package.json app/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY app/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-slim
WORKDIR /srv/app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /srv/app/.next/standalone ./
COPY --from=build /srv/app/.next/static ./.next/static
COPY --from=build /srv/app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
