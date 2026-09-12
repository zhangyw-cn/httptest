package workspace

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestPutListHostsNormalizesKeys(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	saved, err := ws.PutHosts(HostsFile{
		Name: "lan",
		Mappings: map[string]string{
			"API.Example.COM": "10.0.0.5",
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if saved.Mappings["api.example.com"] != "10.0.0.5" {
		t.Fatalf("%v", saved.Mappings)
	}
	if _, ok := saved.Mappings["API.Example.COM"]; ok {
		t.Fatal("raw key should be normalized away")
	}
	list, err := ws.ListHosts()
	if err != nil || len(list) != 1 || list[0].Name != "lan" {
		t.Fatalf("%v %v", list, err)
	}
	st, err := os.Stat(filepath.Join(ws.Workdir(), "hosts", "lan.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if st.Mode().Perm() != 0o644 {
		t.Fatalf("mode=%o", st.Mode().Perm())
	}
}

func TestPutHostsRejectsBadMapping(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	cases := []map[string]string{
		{"http://x": "1.1.1.1"},
		{"a/b": "1.1.1.1"},
		{"a:80": "1.1.1.1"},
		{"ok": "not-an-ip"},
		{"": "1.1.1.1"},
		{"ok": ""},
	}
	for _, m := range cases {
		if _, err := ws.PutHosts(HostsFile{Name: "lan", Mappings: m}); err == nil {
			t.Fatalf("expected error for %v", m)
		}
	}
}

func TestNormalizeDuplicateHost(t *testing.T) {
	_, err := normalizeAndValidateMappings(map[string]string{
		"Foo.COM": "1.1.1.1",
		"foo.com": "2.2.2.2",
	})
	if err == nil {
		t.Fatal("expected duplicate")
	}
}

func TestActiveHostsMappings(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutHosts(HostsFile{Name: "lan", Mappings: map[string]string{"api.test": "127.0.0.1"}}); err != nil {
		t.Fatal(err)
	}
	m, err := ws.ActiveHostsMappings()
	if err != nil || m != nil {
		t.Fatalf("empty active: %v %v", m, err)
	}
	if _, err := ws.PutLocal(Local{Hosts: "lan"}); err != nil {
		t.Fatal(err)
	}
	m, err = ws.ActiveHostsMappings()
	if err != nil || m["api.test"] != "127.0.0.1" {
		t.Fatalf("%v %v", m, err)
	}
	if _, err := ws.PutLocal(Local{Hosts: "gone"}); err != nil {
		t.Fatal(err)
	}
	m, err = ws.ActiveHostsMappings()
	if err != nil || m != nil {
		t.Fatalf("missing file should degrade: %v %v", m, err)
	}
}

func TestDeleteHostsClearsActive(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutHosts(HostsFile{Name: "lan", Mappings: map[string]string{}}); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutLocal(Local{Environment: "e", Override: "o", Hosts: "lan"}); err != nil {
		t.Fatal(err)
	}
	if err := ws.DeleteHosts("lan"); err != nil {
		t.Fatal(err)
	}
	got, err := ws.GetLocal()
	if err != nil {
		t.Fatal(err)
	}
	if got.Hosts != "" || got.Environment != "e" || got.Override != "o" {
		t.Fatalf("%+v", got)
	}
}

func TestRenameHostsUpdatesActive(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutHosts(HostsFile{Name: "old", Mappings: map[string]string{"a.com": "1.1.1.1"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutLocal(Local{Hosts: "old"}); err != nil {
		t.Fatal(err)
	}
	h, err := ws.RenameHosts("old", "new")
	if err != nil || h.Name != "new" {
		t.Fatalf("%v %v", h, err)
	}
	got, err := ws.GetLocal()
	if err != nil || got.Hosts != "new" {
		t.Fatalf("%+v %v", got, err)
	}
	if _, err := os.Stat(filepath.Join(ws.Workdir(), "hosts", "new.yaml")); err != nil {
		t.Fatal(err)
	}
}

func TestRenameHostsConflict(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, n := range []string{"a", "b"} {
		if _, err := ws.PutHosts(HostsFile{Name: n, Mappings: map[string]string{}}); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := ws.RenameHosts("a", "b"); !errors.Is(err, ErrHostsExists) {
		t.Fatalf("%v", err)
	}
}
