use axum::{extract::Query, routing::get, Json, Router};
use serde::Serialize;
use std::collections::HashMap;
use std::time::Instant;

const DEFAULT_WIDTH: u32 = 1500;
const DEFAULT_HEIGHT: u32 = 1500;
const DEFAULT_MAX_ITER: u32 = 1000;

#[derive(Serialize)]
struct ComputeResponse {
    language: &'static str,
    elapsed_seconds: f64,
    width: u32,
    height: u32,
    #[serde(rename = "maxIter")]
    max_iter: u32,
    checksum: u64,
}

fn parse_positive_u32(params: &HashMap<String, String>, key: &str, fallback: u32) -> u32 {
    params
        .get(key)
        .and_then(|s| s.parse::<u32>().ok())
        .filter(|&n| n >= 1)
        .unwrap_or(fallback)
}

/// CPU-heavy deterministic work: uint32 LCG chain per pixel (bit-identical across TS/Rust/Go).
fn compute_checksum(width: u32, height: u32, max_iter: u32) -> u64 {
    const MUL: u32 = 1_664_525;
    const ADD: u32 = 1_013_904_223;
    let mut checksum: u64 = 0;

    for py in 0..height {
        let y = py.wrapping_add(1);
        for px in 0..width {
            let x = px.wrapping_add(1);
            let mut v: u32 = 0;
            for k in 0..max_iter {
                v = v
                    .wrapping_mul(MUL)
                    .wrapping_add(ADD)
                    .wrapping_add(x)
                    .wrapping_add(y)
                    .wrapping_add(k);
            }
            checksum += v as u64;
        }
    }
    checksum
}

async fn compute(Query(params): Query<HashMap<String, String>>) -> Json<ComputeResponse> {
    let width = parse_positive_u32(&params, "width", DEFAULT_WIDTH);
    let height = parse_positive_u32(&params, "height", DEFAULT_HEIGHT);
    let max_iter = parse_positive_u32(&params, "maxIter", DEFAULT_MAX_ITER);

    let (elapsed, checksum) = tokio::task::spawn_blocking(move || {
        let start = Instant::now();
        let checksum = compute_checksum(width, height, max_iter);
        let elapsed = start.elapsed().as_secs_f64();
        (elapsed, checksum)
    })
    .await
    .expect("spawn_blocking failed");

    Json(ComputeResponse {
        language: "rust",
        elapsed_seconds: elapsed,
        width,
        height,
        max_iter,
        checksum,
    })
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/compute", get(compute));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3002")
        .await
        .expect("bind failed");
    println!("Rust benchmark server listening on http://127.0.0.1:3002");
    axum::serve(listener, app).await.expect("server failed");
}

#[cfg(test)]
mod tests {
    use super::compute_checksum;

    #[test]
    fn checksum_matches_reference() {
        assert_eq!(compute_checksum(10, 10, 20), 225_181_304_728);
    }
}
