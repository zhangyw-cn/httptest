package workspace

import "testing"

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
	list, err := ws.ListEnvironments()
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].Name != "local" {
		t.Fatalf("%+v", list)
	}
}
