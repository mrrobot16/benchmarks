import Koa from "koa";

const PORT = 3006;
const DEFAULT_WIDTH = 1500;
const DEFAULT_HEIGHT = 1500;
const DEFAULT_MAX_ITER = 1000;

type ComputeQuery = {
  width?: string;
  height?: string;
  maxIter?: string;
};

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

const app = new Koa();

app.use(async (ctx) => {
  if (ctx.method !== "GET" || ctx.path !== "/compute") {
    ctx.status = 404;
    return;
  }

  const query = ctx.query as ComputeQuery;
  const width = parsePositiveInt(query.width, DEFAULT_WIDTH);
  const height = parsePositiveInt(query.height, DEFAULT_HEIGHT);
  const maxIter = parsePositiveInt(query.maxIter, DEFAULT_MAX_ITER);

  const start = process.hrtime.bigint();
  const checksum = computeChecksum(width, height, maxIter);
  const end = process.hrtime.bigint();
  const elapsedSeconds = Number(end - start) / 1e9;

  ctx.body = {
    language: "typescript-koa",
    elapsed_seconds: elapsedSeconds,
    width,
    height,
    maxIter,
    checksum: Number(checksum),
  };
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`TypeScript (Koa) benchmark server listening on http://127.0.0.1:${PORT}`);
});
