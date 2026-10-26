FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
# A marca (BRAND = pasta de src/brands) e o modo do módulo de Notas Fiscais são gravados no build.
# Notas Fiscais: vazio = módulo oculto (padrão de produção); "api" = módulo de verdade; "demo" = simulação, só para demonstrar.
ARG BRAND
ARG NEXT_PUBLIC_NOTAS_FISCAIS
ENV BRAND=$BRAND NEXT_PUBLIC_NOTAS_FISCAIS=$NEXT_PUBLIC_NOTAS_FISCAIS NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# next.config.ts usa output: "standalone": só o necessário para rodar, sem node_modules inteiro.
FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
