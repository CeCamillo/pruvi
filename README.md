# Pruvi

Monorepo with a **Fastify** API server and a **React Native (Expo)** mobile app.

## Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/) (v10+) — `npm i -g pnpm`
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Getting Started

### 1. Install dependencies

```sh
pnpm install
```

### 2. Set up environment variables

**Server** — copy the example and generate a secret:

```sh
cp apps/server/.env.example apps/server/.env
```

Open `apps/server/.env` and replace `BETTER_AUTH_SECRET` with a random string (min 32 chars):

```sh
# generates and prints a secret you can paste
openssl rand -base64 32
```

The rest of the defaults work out of the box with the Docker setup below.

**Native app** — copy the example and set your LAN IP:

```sh
cp apps/native/.env.example apps/native/.env
```

Open `apps/native/.env` and replace `192.168.x.x` with your machine's local IP:

```sh
# macOS
ipconfig getifaddr en0

# Linux
hostname -I | awk '{print $1}'
```

### 3. Start the database and Redis

```sh
pnpm db:start
```

This runs Postgres 17 and Redis 7 via Docker Compose.

### 4. Push the database schema

```sh
pnpm db:push
```

### 5. Run the server

```sh
pnpm dev:server
```

The API starts at `http://localhost:3000`.

### 6. Run the mobile app

In a separate terminal:

```sh
pnpm dev:native
```

Scan the QR code with Expo Go on your phone (make sure your phone is on the same Wi-Fi network).

## Useful Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start everything (server + native) |
| `pnpm dev:server` | Start the API server |
| `pnpm dev:worker` | Start the background worker |
| `pnpm dev:native` | Start the Expo dev server |
| `pnpm db:start` | Start Postgres & Redis containers |
| `pnpm db:stop` | Stop containers (keeps data) |
| `pnpm db:down` | Stop containers and remove volumes |
| `pnpm db:push` | Push schema changes to the database |
| `pnpm db:studio` | Open Drizzle Studio (DB GUI) |
| `pnpm db:seed` | Seed the database |
| `pnpm build` | Build all packages |
| `pnpm check-types` | Type-check all packages |

## Project Structure

```
apps/
  server/      Fastify API (Bun runtime)
  native/      React Native app (Expo)
packages/
  auth/        Authentication (Better Auth)
  db/          Database schema & migrations (Drizzle + Postgres)
  env/         Environment variable validation (t3-env)
  shared/      Shared types and contracts
  config/      Shared TypeScript config
```
