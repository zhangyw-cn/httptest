package main

import (
	"flag"
	"testing"

	"httptest/internal/server"
)

func TestListenFlagDefaults(t *testing.T) {
	fs := flag.NewFlagSet("httptest", flag.ContinueOnError)
	listen := fs.String("listen", "127.0.0.1:1370", "")
	open := fs.Bool("open", false, "")
	if err := fs.Parse(nil); err != nil {
		t.Fatal(err)
	}
	if *open {
		t.Fatal("open should default to false")
	}
	h, p, err := server.ParseListen(*listen)
	if err != nil || h != "127.0.0.1" || p != "1370" {
		t.Fatalf("default listen: %s %s %v", h, p, err)
	}
}

func TestIllegalListenExitCode(t *testing.T) {
	if code := run([]string{"--listen", "nope"}); code != 2 {
		t.Fatalf("want exit 2, got %d", code)
	}
}
