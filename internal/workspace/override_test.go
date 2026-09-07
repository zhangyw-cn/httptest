package workspace

import (
	"errors"
	"os"
	"path/filepath"
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
	if err := ws.PutOverride(Override{
		Name:      "default",
		Variables: map[string]string{"token": "secret", "password": "p"},
	}); err != nil {
		t.Fatal(err)
	}
	if err := ws.PutLocal(Local{Environment: "local", Override: "default"}); err != nil {
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
	if err := ws.PutLocal(Local{Environment: "local", Override: ""}); err != nil {
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
	if err := ws.PutLocal(Local{Environment: "", Override: "gone"}); err != nil {
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
	if err := ws.PutOverride(Override{Name: "b", Variables: map[string]string{"x": "1"}}); err != nil {
		t.Fatal(err)
	}
	if err := ws.PutOverride(Override{Name: "a", Variables: map[string]string{}}); err != nil {
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

func TestGetPutLocalOverrideField(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutLocal(Local{Environment: "local", Override: "default"}); err != nil {
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
