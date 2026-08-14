# syntax=docker/dockerfile:1

# --- build stage: compile TypeScript -> dist/ ---
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# --- runtime stage: production deps + compiled output only ---
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Ansible + its SSH transport need Python3 on the runtime image only — the
# build stage never executes a playbook, so it stays lean. `pip3 install
# ansible` (over `apt-get install ansible`) is the deliberate choice here:
# Debian slim's own `ansible` package is frequently several minor versions
# behind upstream and pulls a large chain of apt-only transitive deps for
# modules this app never uses (cloud provider inventory plugins, etc.);
# pip's `ansible-core` + `ansible` gets a current, predictable version with
# a smaller footprint, at the cost of one extra `pip3 install` layer.
# `--no-cache-dir` keeps pip's download cache out of the final image;
# `openssh-client` is Ansible's actual SSH transport (`ansible-playbook`
# shells out to the system `ssh` binary, it doesn't reimplement SSH).
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip openssh-client && \
    pip3 install --no-cache-dir --break-system-packages ansible && \
    apt-get purge -y python3-pip && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
