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
	abs, err := filepath.Abs(cwd)
	if err != nil {
		t.Fatal(err)
	}
	if ws.Workdir() != abs {
		t.Fatalf("Workdir=%s want %s", ws.Workdir(), abs)
	}
	local := filepath.Join(abs, ".httptest")
	if ws.LocalDir() != local {
		t.Fatalf("LocalDir=%s", ws.LocalDir())
	}
	for _, p := range []string{
		filepath.Join(local, "local"),
		filepath.Join(local, "history"),
	} {
		st, err := os.Stat(p)
		if err != nil || !st.IsDir() {
			t.Fatalf("missing dir %s: %v", p, err)
		}
	}
	for _, p := range []string{
		filepath.Join(abs, "collections"),
		filepath.Join(abs, "environments"),
	} {
		if _, err := os.Stat(p); !os.IsNotExist(err) {
			t.Fatalf("should not create %s: %v", p, err)
		}
	}
	b, err := os.ReadFile(filepath.Join(local, ".gitignore"))
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != "*\n" {
		t.Fatalf("gitignore=%q", b)
	}
	st, err := os.Stat(filepath.Join(local, "local"))
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
	if !filepath.IsAbs(ws.LocalDir()) {
		t.Fatalf("Dir not abs: %q", ws.LocalDir())
	}
	abs, err := filepath.Abs(cwd)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(ws.LocalDir(), abs) {
		t.Fatalf("Dir=%q cwd=%q", ws.LocalDir(), abs)
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

func TestInitDoesNotOverwriteGitignore(t *testing.T) {
	cwd := t.TempDir()
	gi := filepath.Join(cwd, ".httptest", ".gitignore")
	if err := os.MkdirAll(filepath.Dir(gi), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(gi, []byte("keep\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Init(cwd); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(gi)
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != "keep\n" {
		t.Fatalf("gitignore overwritten: %q", b)
	}
}

func TestListRequestsMissingDir(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	list, err := ws.ListRequests()
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 0 {
		t.Fatalf("want empty, got %+v", list)
	}
}

func TestListEnvironmentsMissingDir(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	list, err := ws.ListEnvironments()
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 0 {
		t.Fatalf("want empty, got %+v", list)
	}
}

func TestListRequestsIgnoresOldNestedCollections(t *testing.T) {
	cwd := t.TempDir()
	ws, err := Init(cwd)
	if err != nil {
		t.Fatal(err)
	}
	old := filepath.Join(ws.LocalDir(), "collections")
	if err := os.MkdirAll(old, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(old, "legacy.yaml"), []byte("name: Old\nmethod: GET\nurl: http://x\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	list, err := ws.ListRequests()
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 0 {
		t.Fatalf("old nested collections must be ignored, got %+v", list)
	}
}

func TestListRequestsNotDir(t *testing.T) {
	cwd := t.TempDir()
	ws, err := Init(cwd)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(ws.Workdir(), "collections"), []byte("nope"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.ListRequests(); err == nil {
		t.Fatal("expected error when collections is a file")
	}
}

func TestListEnvironmentsNotDir(t *testing.T) {
	cwd := t.TempDir()
	ws, err := Init(cwd)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(ws.Workdir(), "environments"), []byte("nope"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.ListEnvironments(); err == nil {
		t.Fatal("expected error when environments is a file")
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
