package workspace

import (
	"errors"
	"strings"
	"testing"
)

func TestRewriteEnvNameYAMLKeepsComment(t *testing.T) {
	in := []byte("# keep me\nname: local\nvariables:\n  k: v\n")
	out, err := rewriteEnvNameYAML(in, "dev")
	if err != nil {
		t.Fatal(err)
	}
	got := string(out)
	if !strings.Contains(got, "# keep me") {
		t.Fatalf("comment lost:\n%s", got)
	}
	if !strings.Contains(got, "name: dev") {
		t.Fatalf("name not updated:\n%s", got)
	}
}

func TestWrapRestore(t *testing.T) {
	base := errors.New("active write failed")
	if wrapRestore(base, nil) != base {
		t.Fatal("nil restore should return original")
	}
	got := wrapRestore(base, errors.New("permission denied"))
	if !errors.Is(got, base) {
		t.Fatalf("got %v", got)
	}
	if !strings.Contains(got.Error(), "restore:") {
		t.Fatalf("%v", got)
	}
}
