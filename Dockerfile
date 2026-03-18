FROM oven/bun:latest
WORKDIR /work
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY src ./src
CMD ["bun", "start"]