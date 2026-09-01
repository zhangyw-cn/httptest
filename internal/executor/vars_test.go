package executor

import (
	"testing"

	"httptest/internal/workspace"
)

func TestSubstituteMissingAndHit(t *testing.T) {
	out, missing := Substitute("{{baseUrl}}/x/{{id}}", map[string]string{"baseUrl": "http://h"})
	if out != "http://h/x/{{id}}" {
		t.Fatalf("out=%s", out)
	}
	if len(missing) != 1 || missing[0] != "id" {
		t.Fatalf("%v", missing)
	}
}

func TestPrepareAppliesEverywhere(t *testing.T) {
	req := workspace.Request{
		Method:  "post",
		URL:     "{{baseUrl}}/login",
		Query:   map[string]string{"t": "{{token}}"},
		Headers: map[string]string{"X": "{{token}}"},
		Body:    workspace.Body{Type: workspace.BodyJSON, Text: `{"u":"{{user}}"}`},
	}
	got, missing, err := Prepare(req, map[string]string{
		"baseUrl": "http://h", "token": "abc", "user": "n",
	})
	if err != nil || len(missing) != 0 {
		t.Fatalf("%v %v", missing, err)
	}
	if got.Method != "POST" || got.URL != "http://h/login" || got.Query["t"] != "abc" || got.Headers["X"] != "abc" || got.Body.Text != `{"u":"n"}` {
		t.Fatalf("%+v", got)
	}
}

func TestPrepareInvalidMethod(t *testing.T) {
	_, _, err := Prepare(workspace.Request{Method: "TRACE", URL: "http://h"}, nil)
	if err == nil {
		t.Fatal("expected error")
	}
}
