# The sign-up site and workspace provisioner. Built from the repository root, as Railway does.
FROM oven/bun:1.4.3@sha256:ec06c3b6cea04192ae6770c434f668ca41d343ad19fa6472216c7b48be39c598
WORKDIR /app
COPY agentic-crm/platform/package.json agentic-crm/platform/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY agentic-crm/platform/src src
COPY agentic-crm/platform/public public
COPY agentic-crm/platform/migrations migrations
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "src/index.ts"]
