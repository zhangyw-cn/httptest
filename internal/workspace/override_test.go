package workspace

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestResolvedVarsOverrideWins(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutEnvironment(Environment{
		Name:      "local",
		Variables: map[string]string{"baseUrl": "http://127.0.0.1:8080", "token": "public"},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutOverride(Override{
		Name:      "default",
		Variables: map[string]string{"token": "secret", "password": "p"},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutLocal(Local{Environment: "local", Override: "default"}); err != nil {
		t.Fatal(err)
	}
	vars, err := ws.ResolvedVars()
	if err != nil {
		t.Fatal(err)
	}
	if vars["baseUrl"] != "http://127.0.0.1:8080" || vars["token"] != "secret" || vars["password"] != "p" {
		t.Fatalf("%v", vars)
	}
	st, err := os.Stat(filepath.Join(ws.LocalDir(), "local", "overrides", "default.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if st.Mode().Perm() != 0o600 {
		t.Fatalf("mode=%o want 0600", st.Mode().Perm())
	}
}

func TestResolvedVarsEmptyOverride(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutEnvironment(Environment{
		Name:      "local",
		Variables: map[string]string{"k": "v"},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutLocal(Local{Environment: "local", Override: ""}); err != nil {
		t.Fatal(err)
	}
	vars, err := ws.ResolvedVars()
	if err != nil {
		t.Fatal(err)
	}
	if vars["k"] != "v" || len(vars) != 1 {
		t.Fatalf("%v", vars)
	}
}

func TestResolvedVarsMissingOverrideFile(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutLocal(Local{Environment: "", Override: "gone"}); err != nil {
		t.Fatal(err)
	}
	_, err = ws.ResolvedVars()
	if !errors.Is(err, ErrOverrideNotFound) {
		t.Fatalf("got %v", err)
	}
}

func TestPutListOverride(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutOverride(Override{Name: "b", Variables: map[string]string{"x": "1"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutOverride(Override{Name: "a", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	list, err := ws.ListOverrides()
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 || list[0].Name != "a" || list[1].Name != "b" {
		t.Fatalf("%+v", list)
	}
}

func TestDeleteOverrideClearsActive(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutOverride(Override{Name: "default", Variables: map[string]string{"k": "v"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutLocal(Local{Environment: "local", Override: "default"}); err != nil {
		t.Fatal(err)
	}
	if err := ws.DeleteOverride("default"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(ws.LocalDir(), "local", "overrides", "default.yaml")); !os.IsNotExist(err) {
		t.Fatal("file remains")
	}
	got, err := ws.GetLocal()
	if err != nil {
		t.Fatal(err)
	}
	if got.Override != "" || got.Environment != "local" {
		t.Fatalf("%+v", got)
	}
}

func TestDeleteOverrideLeavesOtherActive(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutOverride(Override{Name: "a", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutOverride(Override{Name: "b", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutLocal(Local{Override: "a"}); err != nil {
		t.Fatal(err)
	}
	if err := ws.DeleteOverride("b"); err != nil {
		t.Fatal(err)
	}
	got, err := ws.GetLocal()
	if err != nil {
		t.Fatal(err)
	}
	if got.Override != "a" {
		t.Fatalf("%+v", got)
	}
}

func TestRenameOverrideUpdatesActive(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutOverride(Override{Name: "old", Variables: map[string]string{"t": "1"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutLocal(Local{Environment: "local", Override: "old"}); err != nil {
		t.Fatal(err)
	}
	got, err := ws.RenameOverride("old", "new")
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "new" || got.Variables["t"] != "1" {
		t.Fatalf("%+v", got)
	}
	local, err := ws.GetLocal()
	if err != nil {
		t.Fatal(err)
	}
	if local.Override != "new" || local.Environment != "local" {
		t.Fatalf("%+v", local)
	}
}

func TestRenameOverridePreservesComment(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	dir := filepath.Join(ws.LocalDir(), "local", "overrides")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	src := filepath.Join(dir, "old.yaml")
	body := "# keep me\nname: old\nvariables:\n  t: \"1\"\n"
	if err := os.WriteFile(src, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.RenameOverride("old", "new"); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(filepath.Join(dir, "new.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(got), "# keep me") {
		t.Fatalf("comment lost:\n%s", got)
	}
	if !strings.Contains(string(got), "name: new") {
		t.Fatalf("name not updated:\n%s", got)
	}
}

func TestRenameOverrideTightensPermissions(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutOverride(Override{Name: "old", Variables: map[string]string{"t": "1"}}); err != nil {
		t.Fatal(err)
	}
	oldPath := filepath.Join(ws.LocalDir(), "local", "overrides", "old.yaml")
	if err := os.Chmod(oldPath, 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.RenameOverride("old", "new"); err != nil {
		t.Fatal(err)
	}
	st, err := os.Stat(filepath.Join(ws.LocalDir(), "local", "overrides", "new.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if st.Mode().Perm() != 0o600 {
		t.Fatalf("mode=%o want 0600", st.Mode().Perm())
	}
}

func TestRenameOverrideConflict(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutOverride(Override{Name: "a", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutOverride(Override{Name: "b", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	_, err = ws.RenameOverride("a", "b")
	if !errors.Is(err, ErrOverrideExists) {
		t.Fatalf("got %v", err)
	}
}

func TestRenameOverrideSameName(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutOverride(Override{Name: "a", Variables: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	_, err = ws.RenameOverride("a", "a")
	if !errors.Is(err, ErrSameOverrideName) {
		t.Fatalf("got %v", err)
	}
}

func TestGetPutLocalOverrideField(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutLocal(Local{Environment: "local", Override: "default"}); err != nil {
		t.Fatal(err)
	}
	got, err := ws.GetLocal()
	if err != nil {
		t.Fatal(err)
	}
	if got.Environment != "local" || got.Override != "default" {
		t.Fatalf("%+v", got)
	}
	if _, err := os.Stat(filepath.Join(ws.LocalDir(), "local", "secrets.yaml")); !os.IsNotExist(err) {
		t.Fatalf("secrets.yaml should not be written: %v", err)
	}
}

func TestPutLocalRejectsInvalidOverrideName(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	_, err = ws.PutLocal(Local{Override: "overrides/dev"})
	if err == nil || !strings.Contains(err.Error(), "invalid override name") {
		t.Fatalf("got %v", err)
	}
}

func TestResolvedVarsIllegalOverrideName(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	localDir := filepath.Join(ws.LocalDir(), "local")
	if err := os.MkdirAll(localDir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(localDir, "active.yaml"), []byte("override: overrides/dev\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	_, err = ws.ResolvedVars()
	if !errors.Is(err, ErrOverrideNotFound) {
		t.Fatalf("got %v", err)
	}
}
