package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/zhangyw-cn/httptest/internal/workspace"
)

func TestAPIRejectsDomainHost(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/local", nil)
	req.Host = "evil.example"
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("domain Host: got %d %s", rr.Code, rr.Body.Bytes())
	}
}

func TestAPIRejectsCrossOrigin(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	rr := httptest.NewRecorder()
	req := apiReq(http.MethodGet, "/api/local", nil)
	req.Header.Set("Origin", "http://evil.example")
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("cross origin: got %d %s", rr.Code, rr.Body.Bytes())
	}
}

func TestAPIRejectsNonJSONMutation(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/execute", bytes.NewReader([]byte(`{"id":"x","request":{"method":"GET","url":"http://127.0.0.1/"}}`)))
	req.Host = "127.0.0.1:1370"
	req.Header.Set("Content-Type", "text/plain")
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("text/plain POST: got %d %s", rr.Code, rr.Body.Bytes())
	}
}

func TestAPIAllowsLocalhostAndSameOrigin(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/workspace", nil)
	req.Host = "localhost:1370"
	req.Header.Set("Origin", "http://localhost:1370")
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("localhost same origin: got %d %s", rr.Code, rr.Body.Bytes())
	}

	rr = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/workspace", nil)
	req.Host = "localhost:1370"
	req.Header.Set("Origin", "http://Localhost:1370")
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("origin host case: got %d %s", rr.Code, rr.Body.Bytes())
	}
}

func TestAPIAllowsLiteralIPHost(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/workspace", nil)
	req.Host = "192.168.1.9:1370"
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("LAN IP Host: got %d %s", rr.Code, rr.Body.Bytes())
	}
}

func TestAPIIgnoresNonAPIPrefix(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/apifoo", nil)
	req.Host = "evil.example"
	h.ServeHTTP(rr, req)
	if rr.Code == http.StatusForbidden {
		t.Fatalf("/apifoo should not use API host guard, got %d %s", rr.Code, rr.Body.Bytes())
	}
}

func TestWorkspaceWorkdirIsAbsolute(t *testing.T) {
	root := t.TempDir()
	ws, err := workspace.Init(root)
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/workspace", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("%d %s", rr.Code, rr.Body.Bytes())
	}
	var body struct {
		Workdir string `json:"workdir"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if !filepath.IsAbs(body.Workdir) {
		t.Fatalf("workdir is not absolute: %q", body.Workdir)
	}
	if body.Workdir != root && body.Workdir != filepath.Clean(root) {
		abs, _ := filepath.Abs(root)
		if body.Workdir != abs {
			t.Fatalf("workdir=%q want %q", body.Workdir, abs)
		}
	}
}

func TestAllowedAPIHost(t *testing.T) {
	allow := []string{"127.0.0.1:1370", "localhost", "localhost:1370", "[::1]:1370", "::1", "10.0.0.2:80"}
	for _, h := range allow {
		if !allowedAPIHost(h) {
			t.Errorf("want allow %q", h)
		}
	}
	deny := []string{"", "evil.example", "evil.example:1370", "httptest.local"}
	for _, h := range deny {
		if allowedAPIHost(h) {
			t.Errorf("want deny %q", h)
		}
	}
}
