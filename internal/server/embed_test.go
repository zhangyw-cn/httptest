package server

import (
	"bytes"
	"io/fs"
	"testing"
)

func TestEmbeddedUIHasIndex(t *testing.T) {
	b, err := UI.ReadFile("ui/index.html")
	if err != nil {
		t.Fatalf("embed missing ui/index.html (vite emptyOutDir?): %v", err)
	}
	if !bytes.Contains(b, []byte(`id="root"`)) {
		t.Fatalf("index.html missing root: %s", b)
	}
	entries, err := fs.ReadDir(UI, "ui/assets")
	if err != nil || len(entries) == 0 {
		t.Fatalf("embed missing ui/assets: %v %d", err, len(entries))
	}
}
