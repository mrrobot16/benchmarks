import { serve } from "@hono/node-server";
import { Hono } from "hono";

const PORT = 3007;
const DEFAULT_WIDTH = 1500;
const DEFAULT_HEIGHT = 1500;
const DEFAULT_MAX_ITER = 1000;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

/** CPU-heavy deterministic work: uint32 LCG chain per pixel (bit-identical across TS/Rust/Go). */
function computeChecksum(width: number, height: number, maxIter: number): bigint {
  let checksum = 0n;
  const mul = 1664525;
  const add = 1013904223;

  for (let py = 0; py < height; py++) {
    const y = (py + 1) >>> 0;
    for (let px = 0; px < width; px++) {
      const x = (px + 1) >>> 0;
      let v = 0 >>> 0;
      for (let k = 0; k < maxIter; k++) {
        v = (Math.imul(v, mul) + add + x + y + (k >>> 0)) >>> 0;
      }
      checksum += BigInt(v);
    }
  }
  return checksum;
}

const app = new Hono();

app.get("/compute", (c) => {
  const width = parsePositiveInt(c.req.query("width"), DEFAULT_WIDTH);
  const height = parsePositiveInt(c.req.query("height"), DEFAULT_HEIGHT);
  const maxIter = parsePositiveInt(c.req.query("maxIter"), DEFAULT_MAX_ITER);

  const start = process.hrtime.bigint();
  const checksum = computeChecksum(width, height, maxIter);
  const end = process.hrtime.bigint();
  const elapsedSeconds = Number(end - start) / 1e9;

  return c.json({
    language: "typescript-hono",
    elapsed_seconds: elapsedSeconds,
    width,
    height,
    maxIter,
    checksum: Number(checksum),
  });
});

serve(
  {
    fetch: app.fetch,
    port: PORT,
    hostname: "127.0.0.1",
  },
  () => {
    console.log(`TypeScript (Hono) benchmark server listening on http://127.0.0.1:${PORT}`);
  },
);
