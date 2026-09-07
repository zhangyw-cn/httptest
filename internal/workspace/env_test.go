package workspace

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestListEnvironmentsUsesFilenameNotYamlName(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	root := filepath.Join(ws.Workdir(), "environments")
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "prod.yaml"), []byte("name: production\nvariables:\n  k: v\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "staging.yaml"), []byte("variables:\n  a: 1\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	list, err := ws.ListEnvironments()
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 {
		t.Fatalf("%+v", list)
	}
	if list[0].Name != "prod" || list[0].Variables["k"] != "v" {
		t.Fatalf("prod %+v", list[0])
	}
	if list[1].Name != "staging" || list[1].Variables["a"] != "1" {
		t.Fatalf("staging %+v", list[1])
	}
}

func TestDeleteEnvironmentRemovesFileAndClearsActive(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutEnvironment(Environment{Name: "local", Variables: map[string]string{"k": "v"}}); err != nil {
		t.Fatal(err)
	}
	if err := ws.PutLocal(Local{Environment: "local", Override: "keep"}); err != nil {
		t.Fatal(err)
	}
	if err := ws.DeleteEnvironment("local"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(ws.Workdir(), "environments", "local.yaml")); !os.IsNotExist(err) {
		t.Fatalf("file still there: %v", err)
	}
	got, err := ws.GetLocal()
	if err != nil {
		t.Fatal(err)
	}
	if got.Environment != "" {
		t.Fatalf("active=%q want empty", got.Environment)
	}
	if got.Override != "keep" {
		t.Fatalf("override mutated: %+v", got)
	}
}

func TestDeleteEnvironmentLeavesOtherActive(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutEnvironment(Environment{Name: "local", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	if err := ws.PutEnvironment(Environment{Name: "prod", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	if err := ws.PutLocal(Local{Environment: "local", Override: ""}); err != nil {
		t.Fatal(err)
	}
	if err := ws.DeleteEnvironment("prod"); err != nil {
		t.Fatal(err)
	}
	got, err := ws.GetLocal()
	if err != nil {
		t.Fatal(err)
	}
	if got.Environment != "local" {
		t.Fatalf("active=%q", got.Environment)
	}
}

func TestDeleteEnvironmentMissing(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	err = ws.DeleteEnvironment("nope")
	if !os.IsNotExist(err) {
		t.Fatalf("got %v", err)
	}
}

func TestDeleteEnvironmentInvalidName(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	err = ws.DeleteEnvironment("a/b")
	if err == nil || !strings.Contains(err.Error(), "invalid environment name") {
		t.Fatalf("got %v", err)
	}
}

func TestDeleteEnvironmentRollsBackFileWhenActiveWriteFails(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutEnvironment(Environment{Name: "local", Variables: map[string]string{"k": "v"}}); err != nil {
		t.Fatal(err)
	}
	if err := ws.PutLocal(Local{Environment: "local", Override: ""}); err != nil {
		t.Fatal(err)
	}
	envFile := filepath.Join(ws.Workdir(), "environments", "local.yaml")
	if err := os.Chmod(envFile, 0o600); err != nil {
		t.Fatal(err)
	}
	active := filepath.Join(ws.LocalDir(), "local", "active.yaml")
	if err := os.Remove(active); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(active, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := ws.DeleteEnvironment("local"); err == nil {
		t.Fatal("expected error")
	}
	restored := filepath.Join(ws.Workdir(), "environments", "local.yaml")
	st, err := os.Stat(restored)
	if err != nil {
		t.Fatalf("env file should be restored: %v", err)
	}
	if st.Mode().Perm() != 0o600 {
		t.Fatalf("restored mode=%o want 0600", st.Mode().Perm())
	}
}

func TestRenameEnvironmentMovesFileAndFollowsActive(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutEnvironment(Environment{Name: "local", Variables: map[string]string{"baseUrl": "http://h"}}); err != nil {
		t.Fatal(err)
	}
	if err := ws.PutLocal(Local{Environment: "local", Override: "default"}); err != nil {
		t.Fatal(err)
	}
	env, err := ws.RenameEnvironment("local", "dev")
	if err != nil {
		t.Fatal(err)
	}
	if env.Name != "dev" || env.Variables["baseUrl"] != "http://h" {
		t.Fatalf("%+v", env)
	}
	if _, err := os.Stat(filepath.Join(ws.Workdir(), "environments", "local.yaml")); !os.IsNotExist(err) {
		t.Fatalf("old file: %v", err)
	}
	got, err := ws.GetLocal()
	if err != nil {
		t.Fatal(err)
	}
	if got.Environment != "dev" || got.Override != "default" {
		t.Fatalf("%+v", got)
	}
}

func TestRenameEnvironmentLeavesOtherActive(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutEnvironment(Environment{Name: "local", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	if err := ws.PutEnvironment(Environment{Name: "prod", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	if err := ws.PutLocal(Local{Environment: "prod", Override: ""}); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.RenameEnvironment("local", "dev"); err != nil {
		t.Fatal(err)
	}
	got, err := ws.GetLocal()
	if err != nil {
		t.Fatal(err)
	}
	if got.Environment != "prod" {
		t.Fatalf("active=%q", got.Environment)
	}
}

func TestRenameEnvironmentTargetExists(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutEnvironment(Environment{Name: "local", Variables: map[string]string{"k": "1"}}); err != nil {
		t.Fatal(err)
	}
	if err := ws.PutEnvironment(Environment{Name: "prod", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	_, err = ws.RenameEnvironment("local", "prod")
	if !errors.Is(err, ErrEnvExists) {
		t.Fatalf("got %v", err)
	}
	if _, err := os.Stat(filepath.Join(ws.Workdir(), "environments", "local.yaml")); err != nil {
		t.Fatalf("old file missing: %v", err)
	}
}

func TestRenameEnvironmentSameName(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutEnvironment(Environment{Name: "local", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	_, err = ws.RenameEnvironment("local", "local")
	if !errors.Is(err, ErrSameEnvName) {
		t.Fatalf("got %v", err)
	}
	if _, err := os.Stat(filepath.Join(ws.Workdir(), "environments", "local.yaml")); err != nil {
		t.Fatal(err)
	}
}

func TestRenameEnvironmentInvalidName(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutEnvironment(Environment{Name: "local", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	_, err = ws.RenameEnvironment("local", "a/b")
	if err == nil || !strings.Contains(err.Error(), "invalid environment name") {
		t.Fatalf("got %v", err)
	}
	if _, err := os.Stat(filepath.Join(ws.Workdir(), "environments", "local.yaml")); err != nil {
		t.Fatal(err)
	}
}

func TestRenameEnvironmentMissing(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	_, err = ws.RenameEnvironment("nope", "dev")
	if !os.IsNotExist(err) {
		t.Fatalf("got %v", err)
	}
}

func TestRenameEnvironmentRollsBackWhenActiveWriteFails(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutEnvironment(Environment{Name: "local", Variables: map[string]string{"k": "v"}}); err != nil {
		t.Fatal(err)
	}
	if err := ws.PutLocal(Local{Environment: "local", Override: ""}); err != nil {
		t.Fatal(err)
	}
	active := filepath.Join(ws.LocalDir(), "local", "active.yaml")
	if err := os.Remove(active); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(active, 0o755); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.RenameEnvironment("local", "dev"); err == nil {
		t.Fatal("expected error")
	}
	if _, err := os.Stat(filepath.Join(ws.Workdir(), "environments", "local.yaml")); err != nil {
		t.Fatalf("old file should be restored: %v", err)
	}
	if _, err := os.Stat(filepath.Join(ws.Workdir(), "environments", "dev.yaml")); !os.IsNotExist(err) {
		t.Fatal("new file should not remain")
	}
}

func TestRenameEnvironmentPreservesComments(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	dir := filepath.Join(ws.Workdir(), "environments")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	src := filepath.Join(dir, "local.yaml")
	body := "# keep me\nname: local\nvariables:\n  k: v\n"
	if err := os.WriteFile(src, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.RenameEnvironment("local", "dev"); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(filepath.Join(dir, "dev.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(got), "# keep me") {
		t.Fatalf("comment lost:\n%s", got)
	}
	if !strings.Contains(string(got), "name: dev") {
		t.Fatalf("name not updated:\n%s", got)
	}
}

func TestRenameEnvironmentSameFileUsesTemp(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutEnvironment(Environment{Name: "local", Variables: map[string]string{"k": "v"}}); err != nil {
		t.Fatal(err)
	}
	oldPath := filepath.Join(ws.Workdir(), "environments", "local.yaml")
	newPath := filepath.Join(ws.Workdir(), "environments", "dev.yaml")
	if err := os.Link(oldPath, newPath); err != nil {
		t.Skipf("hard link not supported: %v", err)
	}
	env, err := ws.RenameEnvironment("local", "dev")
	if err != nil {
		t.Fatal(err)
	}
	if env.Name != "dev" {
		t.Fatalf("%+v", env)
	}
	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Fatalf("old file: %v", err)
	}
	got, err := os.ReadFile(newPath)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(got), "name: dev") {
		t.Fatalf("%s", got)
	}
}
