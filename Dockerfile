FROM oven/bun:latest AS base
WORKDIR /work
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY src ./
RUN [ "bun", "start" ]