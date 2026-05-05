package main

import "testing"

func TestComputeChecksum10x10(t *testing.T) {
	const want uint64 = 225181304728
	got := computeChecksum(10, 10, 20)
	if got != want {
		t.Fatalf("checksum = %d, want %d", got, want)
	}
}
