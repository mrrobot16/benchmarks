# Benchmark Languages Performance

HTTP servers expose `GET /compute` with the same **deterministic CPU-heavy workload** (nested loops + per-pixel `uint32` LCG chain). The JSON response includes **`elapsed_seconds`** (wall time for the whole computation) and a **`checksum`** so you can confirm every implementation did identical work.

> **Why not floating-point Mandelbrot?** IEEE-754 `double` Mandelbrot can diverge slightly across runtimes (optimizations, FMA, etc.), so checksums would not match. The `uint32` LCG chain is bit-identical across Node, Rust, and Go and stays CPU-bound.

## Servers

| Directory             | Language / runtime | Framework              | Port | `language` in JSON     |
| --------------------- | ------------------ | ---------------------- | ---- | ---------------------- |
| `typescript/`         | TypeScript (Node)  | Express                | 3001 | `typescript`           |
| `typescript-fastify/` | TypeScript (Node)  | Fastify (no plugins)   | 3004 | `typescript-fastify`   |
| `typescript-nestjs/`  | TypeScript (Node)  | NestJS (Express adapter) | 3005 | `typescript-nestjs`    |
| `typescript-koa/`     | TypeScript (Node)  | Koa (no router plugins)  | 3006 | `typescript-koa`       |
| `typescript-hono/`    | TypeScript (Node)  | Hono (`@hono/node-server`) | 3007 | `typescript-hono`      |
| `bun/`                | TypeScript (Bun)   | `Bun.serve` (built-in) | 3008 | `bun`                  |
| `rust/`               | Rust               | Axum                   | 3002 | `rust`                 |
| `go/`                 | Go                 | `net/http`             | 3003 | `go`                   |

## API

`GET /compute?width=<W>&height=<H>&maxIter=<M>`

Defaults: `width=1500`, `height=1500`, `maxIter=1000`.

Example response (Rust; other servers use the same fields with a different `language` value):

```json
{
  "language": "rust",
  "elapsed_seconds": 1.977525021,
  "width": 1500,
  "height": 1500,
  "maxIter": 1000,
  "checksum": 4831866064556224
}
```

Fastify example:

```json
{
  "language": "typescript-fastify",
  "elapsed_seconds": 3.5919145835,
  "width": 1500,
  "height": 1500,
  "maxIter": 1000,
  "checksum": 4831866064556224
}
```

### One server at a time (timestamp only)

Start a single server, then:

```bash
curl -sS 'http://127.0.0.1:3004/compute' | jq '{language, elapsed_seconds, checksum}'
```

Change the port to **3001** (Express), **3004** (Fastify), **3005** (NestJS), **3006** (Koa), **3007** (Hono), **3008** (Bun), **3002** (Rust), or **3003** (Go) as needed.

## Run each server

Use separate terminals (or background jobs).

### TypeScript (Express) — port 3001

```bash
cd typescript
npm install
npm run build
node dist/server.js
```

### TypeScript (Fastify, no plugins) — port 3004

```bash
cd typescript-fastify
npm install
npm run build
node dist/server.js
# or: npm run dev
```

### TypeScript (NestJS) — port 3005

```bash
cd typescript-nestjs
npm install
npm run build
node dist/main.js
# or: npm run dev
```

### TypeScript (Koa, no router plugins) — port 3006

```bash
cd typescript-koa
npm install
npm run build
node dist/server.js
# or: npm run dev
```

### TypeScript (Hono) — port 3007

```bash
cd typescript-hono
npm install
npm run build
node dist/server.js
# or: npm run dev
```

### Bun (`Bun.serve`) — port 3008

No build step or framework — Bun runs the `.ts` file directly and the HTTP server is built in.

```bash
cd bun
bun install
bun run start
# or: bun run dev
```

### Rust (Axum) — port 3002

Use a **release** build (debug is much slower). If your environment sets `CARGO_TARGET_DIR` (e.g. some IDE sandboxes), pin the binary path:

```bash
cd rust
CARGO_TARGET_DIR=target cargo build --release
./target/release/benchmark-rust
```

Otherwise `cargo build --release` and run `target/release/benchmark-rust` from `rust/` as usual.

### Go (`net/http`) — port 3003

```bash
cd go
go build -o benchmark-go .
./benchmark-go
```

## Benchmark script

Requires `curl` and `jq`. Start **all eight servers** (Express 3001, Fastify 3004, NestJS 3005, Koa 3006, Hono 3007, Bun 3008, Rust 3002, Go 3003), then from the repo root:

```bash
chmod +x run-bench.sh   # once
./run-bench.sh
```

The script calls each server **5** times, **discards the first** response as warm-up, then reports **min / median / avg** of `elapsed_seconds` over the remaining **4** requests. It fails if `checksum` values differ.

## Sample results (this machine)

From `./run-bench.sh` (all seven servers, default query params):

| Server               | Min (s) | Median (s) | Avg (s) | Checksum        |
| -------------------- | ------- | ---------- | ------- | --------------- |
| TypeScript (Express) | 3.573   | 3.584      | 6.304   | 4831866064556224 |
| TypeScript (Fastify) | 3.585   | 3.616      | 6.290   | 4831866064556224 |
| TypeScript (NestJS)  | 3.562   | 3.580      | 6.262   | 4831866064556224 |
| TypeScript (Koa)     | 3.569   | 3.576      | 6.292   | 4831866064556224 |
| TypeScript (Hono)    | 3.573   | 3.577      | 6.287   | 4831866064556224 |
| Bun (Bun.serve)      | 5.596   | 5.602      | 5.605   | 4831866064556224 |
| Rust                 | 1.965   | 1.967      | 1.970   | 4831866064556224 |
| Go                   | 3.554   | 3.563      | 3.561   | 4831866064556224 |

- **Recorded:** 2026-06-09  
- **Hardware:** Apple Silicon (darwin 24.x), local run via `./run-bench.sh` with default query params.  
- **Interpretation:** On this sample, **Rust** again had the lowest median time (~1.97s). The Node frameworks (Express, Fastify, NestJS, Koa, Hono) clustered tightly around a ~3.58s median, and Go’s `net/http` matched that band (~3.56s) with a more stable average. **Bun** was notably slower on this integer-heavy workload (~5.60s median) but very consistent — its average tracked its median closely, whereas the Node servers show **averages** well above their medians (~6.3s) because occasional slow requests (GC, scheduling) land in the post–warm-up window.

## Caveats

- Single machine, mostly **single-request-at-a-time** CPU work (Rust runs the compute on a blocking thread pool so the async runtime stays responsive).
- Not a substitute for full load testing (concurrency, connection pools, etc.).
- Rebuild **Go** after changing `main.go` before benchmarking so you are not running an old `benchmark-go` binary.
- Each TypeScript server is a separate package (`typescript/`, `typescript-fastify/`, `typescript-nestjs/`, `typescript-koa/`, `typescript-hono/`); install and build each independently.
