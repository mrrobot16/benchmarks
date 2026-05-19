# Benchmark Languages Performance

HTTP servers expose `GET /compute` with the same **deterministic CPU-heavy workload** (nested loops + per-pixel `uint32` LCG chain). The JSON response includes **`elapsed_seconds`** (wall time for the whole computation) and a **`checksum`** so you can confirm every implementation did identical work.

> **Why not floating-point Mandelbrot?** IEEE-754 `double` Mandelbrot can diverge slightly across runtimes (optimizations, FMA, etc.), so checksums would not match. The `uint32` LCG chain is bit-identical across Node, Rust, and Go and stays CPU-bound.

## Servers

| Directory            | Language / runtime | Framework        | Port | `language` in JSON   |
| -------------------- | ------------------ | ---------------- | ---- | -------------------- |
| `typescript/`        | TypeScript (Node)  | Express          | 3001 | `typescript`         |
| `typescript-fastify/`| TypeScript (Node)  | Fastify (no plugins) | 3004 | `typescript-fastify` |
| `rust/`              | Rust               | Axum             | 3002 | `rust`               |
| `go/`                | Go                 | `net/http`       | 3003 | `go`                 |

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

Change the port to **3001** (Express), **3002** (Rust), or **3003** (Go) as needed.

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

Requires `curl` and `jq`. Start **Express (3001), Rust (3002), and Go (3003)**, then from the repo root:

```bash
chmod +x run-bench.sh   # once
./run-bench.sh
```

The script calls each of those three servers **5** times, **discards the first** response as warm-up, then reports **min / median / avg** of `elapsed_seconds` over the remaining **4** requests. It fails if `checksum` values differ.

**Fastify (3004)** is not included in `run-bench.sh`; benchmark it manually with the same `curl` command above (run multiple times and compare `elapsed_seconds`).

## Sample results (this machine)

From `./run-bench.sh` (Express, Rust, Go only):

| Server     | Min (s) | Median (s) | Avg (s) | Checksum        |
| ---------- | ------- | ---------- | ------- | --------------- |
| TypeScript (Express) | 3.577   | 3.642      | 6.560   | 4831866064556224 |
| Rust       | 1.936   | 1.978      | 1.983   | 4831866064556224 |
| Go         | 3.538   | 3.592      | 3.586   | 4831866064556224 |

- **Recorded:** 2026-05-05  
- **Hardware:** Apple Silicon (darwin 24.x), local run via `./run-bench.sh` with default query params.  
- **Interpretation:** On this sample, **Rust** had the lowest median time; Node/V8 JIT and Go’s `net/http` handler were in a similar band for this workload. Your numbers will vary by CPU, power settings, and background load. TypeScript’s **average** can exceed the median if an occasional slow request (GC, scheduling) appears in the post–warm-up window.

## Caveats

- Single machine, mostly **single-request-at-a-time** CPU work (Rust runs the compute on a blocking thread pool so the async runtime stays responsive).
- Not a substitute for full load testing (concurrency, connection pools, etc.).
- Rebuild **Go** after changing `main.go` before benchmarking so you are not running an old `benchmark-go` binary.
- **Express** and **Fastify** are separate packages (`typescript/` vs `typescript-fastify/`); install and build each independently.
