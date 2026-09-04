package workspace

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestInitCreatesLayoutAndGitignore(t *testing.T) {
	cwd := t.TempDir()
	ws, err := Init(cwd)
	if err != nil {
		t.Fatal(err)
	}
	root := filepath.Join(cwd, ".httptest")
	if ws.Dir() != root {
		t.Fatalf("Dir=%s", ws.Dir())
	}
	for _, p := range []string{
		filepath.Join(root, "collections"),
		filepath.Join(root, "environments"),
		filepath.Join(root, "local"),
		filepath.Join(root, "history"),
	} {
		st, err := os.Stat(p)
		if err != nil || !st.IsDir() {
			t.Fatalf("missing dir %s: %v", p, err)
		}
	}
	b, err := os.ReadFile(filepath.Join(root, ".gitignore"))
	if err != nil {
		t.Fatal(err)
	}
	got := string(b)
	if !strings.Contains(got, "local/") || !strings.Contains(got, "history/") {
		t.Fatalf("gitignore=%q", got)
	}
	st, err := os.Stat(filepath.Join(root, "local"))
	if err != nil {
		t.Fatal(err)
	}
	if st.Mode().Perm() != 0o700 {
		t.Fatalf("local dir mode=%o want 0700", st.Mode().Perm())
	}
}

func TestInitResolvesRelativeCwd(t *testing.T) {
	cwd := t.TempDir()
	orig, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(cwd); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(orig) })
	ws, err := Init(".")
	if err != nil {
		t.Fatal(err)
	}
	if !filepath.IsAbs(ws.Dir()) {
		t.Fatalf("Dir not abs: %q", ws.Dir())
	}
	abs, err := filepath.Abs(cwd)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(ws.Dir(), abs) {
		t.Fatalf("Dir=%q cwd=%q", ws.Dir(), abs)
	}
}

func TestInitIdempotent(t *testing.T) {
	cwd := t.TempDir()
	if _, err := Init(cwd); err != nil {
		t.Fatal(err)
	}
	if _, err := Init(cwd); err != nil {
		t.Fatal(err)
	}
}

func TestCleanRelRejectsTraversal(t *testing.T) {
	for _, rel := range []string{"../x", "..", "/abs", "a/../../b", "", "C:/foo", "C:\\foo"} {
		if _, err := CleanRel(rel); err == nil {
			t.Fatalf("expected error for %q", rel)
		}
	}
	got, err := CleanRel("auth/login")
	if err != nil || got != "auth/login" {
		t.Fatalf("got %q %v", got, err)
	}
	for _, rel := range []string{"v1..2/x", "a:b", "foo..bar"} {
		got, err := CleanRel(rel)
		if err != nil || got != rel {
			t.Fatalf("legal name %q: got %q %v", rel, got, err)
		}
	}
}
