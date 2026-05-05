package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"
)

const (
	defaultWidth    = 1500
	defaultHeight   = 1500
	defaultMaxIter  = 1000
	listenAddr      = "127.0.0.1:3003"
)

type computeResponse struct {
	Language         string  `json:"language"`
	ElapsedSeconds   float64 `json:"elapsed_seconds"`
	Width            uint32 `json:"width"`
	Height           uint32 `json:"height"`
	MaxIter          uint32 `json:"maxIter"`
	Checksum         uint64 `json:"checksum"`
}

func parsePositiveUint32(s string, fallback uint32) uint32 {
	if s == "" {
		return fallback
	}
	n, err := strconv.ParseUint(s, 10, 32)
	if err != nil || n < 1 {
		return fallback
	}
	return uint32(n)
}

// CPU-heavy deterministic work: uint32 LCG chain per pixel (bit-identical across TS/Rust/Go).
func computeChecksum(width, height, maxIter uint32) uint64 {
	const mul uint32 = 1664525
	const add uint32 = 1013904223
	var checksum uint64

	for py := uint32(0); py < height; py++ {
		y := py + 1
		for px := uint32(0); px < width; px++ {
			x := px + 1
			var v uint32
			for k := uint32(0); k < maxIter; k++ {
				v = v*mul + add + x + y + k
			}
			checksum += uint64(v)
		}
	}
	return checksum
}

func computeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	q := r.URL.Query()
	width := parsePositiveUint32(q.Get("width"), defaultWidth)
	height := parsePositiveUint32(q.Get("height"), defaultHeight)
	maxIter := parsePositiveUint32(q.Get("maxIter"), defaultMaxIter)

	start := time.Now()
	checksum := computeChecksum(width, height, maxIter)
	elapsed := time.Since(start).Seconds()

	resp := computeResponse{
		Language:       "go",
		ElapsedSeconds: elapsed,
		Width:          width,
		Height:         height,
		MaxIter:        maxIter,
		Checksum:       checksum,
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		log.Printf("encode: %v", err)
	}
}

func main() {
	http.HandleFunc("/compute", computeHandler)
	log.Printf("Go benchmark server listening on http://%s", listenAddr)
	log.Fatal(http.ListenAndServe(listenAddr, nil))
}
