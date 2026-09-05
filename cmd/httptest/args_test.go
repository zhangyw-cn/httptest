package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseArgsDefault(t *testing.T) {
	opt, err := parseArgs(nil)
	if err != nil {
		t.Fatal(err)
	}
	if opt.open {
		t.Fatal("open should default false")
	}
	if opt.listen != defaultListen {
		t.Fatalf("listen %q", opt.listen)
	}
	if opt.workdir != "" {
		t.Fatalf("workdir should be empty, got %q", opt.workdir)
	}
}

func TestParseArgsDirBeforeAndAfterFlags(t *testing.T) {
	a, err := parseArgs([]string{"--open", "/tmp/proj"})
	if err != nil {
		t.Fatal(err)
	}
	if !a.open || a.workdir != "/tmp/proj" {
		t.Fatalf("%+v", a)
	}
	b, err := parseArgs([]string{"/tmp/proj", "--open"})
	if err != nil {
		t.Fatal(err)
	}
	if !b.open || b.workdir != "/tmp/proj" {
		t.Fatalf("%+v", b)
	}
}

func TestParseArgsListenForms(t *testing.T) {
	a, err := parseArgs([]string{"--listen", "127.0.0.1:1", "--open", "./api"})
	if err != nil {
		t.Fatal(err)
	}
	if a.listen != "127.0.0.1:1" || !a.open || a.workdir != "./api" {
		t.Fatalf("%+v", a)
	}
	b, err := parseArgs([]string{"--listen=127.0.0.1:2", "d"})
	if err != nil {
		t.Fatal(err)
	}
	if b.listen != "127.0.0.1:2" || b.workdir != "d" {
		t.Fatalf("%+v", b)
	}
}

func TestParseArgsExtraPositional(t *testing.T) {
	if _, err := parseArgs([]string{"a", "b"}); err == nil {
		t.Fatal("expected error")
	}
}

func TestParseArgsDashDash(t *testing.T) {
	opt, err := parseArgs([]string{"--open", "--", "/tmp/proj"})
	if err != nil {
		t.Fatal(err)
	}
	if !opt.open || opt.workdir != "/tmp/proj" {
		t.Fatalf("%+v", opt)
	}
}

func TestResolveWorkdirEmptyUsesGetwd(t *testing.T) {
	abs, code, err := resolveWorkdir("")
	if err != nil || code != 0 {
		t.Fatalf("%q %d %v", abs, code, err)
	}
	wd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if abs != wd {
		t.Fatalf("got %q want %q", abs, wd)
	}
}

func TestResolveWorkdirRelativeGetwdFailureExit1(t *testing.T) {
	original, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := os.Chdir(original); err != nil {
			t.Errorf("restore working directory: %v", err)
		}
	}()
	if err := os.Remove(dir); err != nil {
		t.Skipf("platform cannot remove current working directory: %v", err)
	}

	if _, code, err := resolveWorkdir("."); err == nil || code != 1 {
		t.Fatalf("code=%d err=%v", code, err)
	}
}

func TestResolveWorkdirMissingAndFile(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "nope")
	if _, code, err := resolveWorkdir(missing); err == nil || code != 2 {
		t.Fatalf("missing: code=%d err=%v", code, err)
	}
	f := filepath.Join(t.TempDir(), "file")
	if err := os.WriteFile(f, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, code, err := resolveWorkdir(f); err == nil || code != 2 {
		t.Fatalf("file: code=%d err=%v", code, err)
	}
}

func TestResolveWorkdirOk(t *testing.T) {
	dir := t.TempDir()
	abs, code, err := resolveWorkdir(dir)
	if err != nil || code != 0 {
		t.Fatalf("%d %v", code, err)
	}
	want, err := filepath.Abs(dir)
	if err != nil {
		t.Fatal(err)
	}
	if abs != want {
		t.Fatalf("got %q want %q", abs, want)
	}
}

func TestRunMissingDirExit2(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "nope")
	if code := run([]string{missing}); code != 2 {
		t.Fatalf("want 2, got %d", code)
	}
}

func TestRunExtraArgsExit2(t *testing.T) {
	if code := run([]string{"a", "b"}); code != 2 {
		t.Fatalf("want 2, got %d", code)
	}
}
