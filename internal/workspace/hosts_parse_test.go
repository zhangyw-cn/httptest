package workspace

import (
	"errors"
	"testing"
)

func TestParseHostsContentAliasesAndComments(t *testing.T) {
	m, err := ParseHostsContent(`
# gateway
10.0.0.5 api.example.com api
10.0.0.8 pay.example.com # trailing comment
`)
	if err != nil {
		t.Fatal(err)
	}
	if m["api.example.com"] != "10.0.0.5" || m["api"] != "10.0.0.5" {
		t.Fatalf("%v", m)
	}
	if m["pay.example.com"] != "10.0.0.8" {
		t.Fatalf("%v", m)
	}
}

func TestParseHostsContentDuplicateRejected(t *testing.T) {
	_, err := ParseHostsContent("1.1.1.1 a.com\n2.2.2.2 A.COM")
	if !errors.Is(err, ErrInvalidHostsMapping) {
		t.Fatalf("got %v", err)
	}
}

func TestParseHostsContentEmptyOK(t *testing.T) {
	m, err := ParseHostsContent("\n# only comment\n")
	if err != nil || len(m) != 0 {
		t.Fatalf("%v %v", m, err)
	}
}
