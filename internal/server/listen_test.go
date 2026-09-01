package server

import (
	"strings"
	"testing"
)

func TestParseListenDefaultAndError(t *testing.T) {
	h, p, err := ParseListen("127.0.0.1:1370")
	if err != nil || h != "127.0.0.1" || p != "1370" {
		t.Fatalf("%s %s %v", h, p, err)
	}
	if _, _, err := ParseListen("nope"); err == nil {
		t.Fatal("expected error")
	}
	if WarnPublicListen("127.0.0.1") != "" {
		t.Fatal("no warn on loopback")
	}
	w := WarnPublicListen("0.0.0.0")
	if w == "" || !strings.Contains(w, "代理") {
		t.Fatalf("warn=%q", w)
	}
}

func TestWarnPublicListenEmptyHost(t *testing.T) {
	h, p, err := ParseListen(":1370")
	if err != nil || h != "" || p != "1370" {
		t.Fatalf("ParseListen(:1370)=%q %q %v", h, p, err)
	}
	for _, host := range []string{"", "::"} {
		w := WarnPublicListen(host)
		if w == "" || !strings.Contains(w, "代理") {
			t.Fatalf("host %q warn=%q", host, w)
		}
	}
}
