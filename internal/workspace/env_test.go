package workspace

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestResolvedVarsSecretsOverride(t *testing.T) {
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
	if err := ws.PutLocal(Local{
		Environment: "local",
		Secrets:     map[string]string{"token": "secret", "password": "p"},
	}); err != nil {
		t.Fatal(err)
	}
	vars, err := ws.ResolvedVars()
	if err != nil {
		t.Fatal(err)
	}
	if vars["baseUrl"] != "http://127.0.0.1:8080" || vars["token"] != "secret" || vars["password"] != "p" {
		t.Fatalf("%v", vars)
	}
	got, err := ws.GetLocal()
	if err != nil {
		t.Fatal(err)
	}
	if got.Environment != "local" || got.Secrets["token"] != "secret" {
		t.Fatalf("%+v", got)
	}
	st, err := os.Stat(filepath.Join(ws.LocalDir(), "local", "secrets.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if st.Mode().Perm() != 0o600 {
		t.Fatalf("secrets.yaml mode=%o want 0600", st.Mode().Perm())
	}
	list, err := ws.ListEnvironments()
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].Name != "local" {
		t.Fatalf("%+v", list)
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
	if err := ws.PutLocal(Local{Environment: "local", Secrets: map[string]string{"t": "1"}}); err != nil {
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
	if got.Secrets["t"] != "1" {
		t.Fatalf("secrets mutated: %+v", got.Secrets)
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
	if err := ws.PutLocal(Local{Environment: "local", Secrets: map[string]string{}}); err != nil {
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
	if err := ws.PutLocal(Local{Environment: "local", Secrets: map[string]string{}}); err != nil {
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
	if _, err := os.Stat(filepath.Join(ws.Workdir(), "environments", "local.yaml")); err != nil {
		t.Fatalf("env file should be restored: %v", err)
	}
}
