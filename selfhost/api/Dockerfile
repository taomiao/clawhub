FROM oven/bun:1 AS deps
WORKDIR /app

# Install deps first for better caching.
COPY package.json bun.lock ./
COPY packages/schema/package.json packages/schema/package.json
COPY packages/clawdhub/package.json packages/clawdhub/package.json

RUN bun install

# Build schema package (needed by CLI)
COPY packages/schema ./packages/schema
RUN cd packages/schema && bun run build

# Build CLI package
COPY packages/clawdhub ./packages/clawdhub
RUN cd packages/clawdhub && bun run build

FROM oven/bun:1
WORKDIR /app

# Install curl for CLI HTTP requests
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/packages /app/packages
COPY . .

ENV PORT=8787
EXPOSE 8787

CMD ["bun", "selfhost/api/src/index.ts"]

