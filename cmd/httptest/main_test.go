package main

import (
	"net"
	"os"
	"testing"

	"github.com/zhangyw-cn/httptest/internal/server"
)

func TestListenFlagDefaults(t *testing.T) {
	fs, listen, open := newFlagSet()
	if err := fs.Parse(nil); err != nil {
		t.Fatal(err)
	}
	if *open {
		t.Fatal("open should default to false")
	}
	if *listen != defaultListen {
		t.Fatalf("listen default %q", *listen)
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

func TestRunFailsWhenPortBusy(t *testing.T) {
	dir := t.TempDir()
	orig, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(orig) })

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	code := run([]string{"--listen", ln.Addr().String()})
	if code != 1 {
		t.Fatalf("busy port: want exit 1, got %d", code)
	}
}
