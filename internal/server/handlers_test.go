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

func TestRequestCRUDAndTraversal(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	body := []byte(`{"path":"auth/login","request":{"name":"Login","method":"POST","url":"http://h/login","query":{},"headers":{},"body":{"type":"none"}}}`)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/requests", body))
	if rr.Code != 200 && rr.Code != 201 {
		t.Fatalf("create %d %s", rr.Code, rr.Body.Bytes())
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/requests/auth/login", nil))
	if rr.Code != 200 {
		t.Fatalf("get %d %s", rr.Code, rr.Body.Bytes())
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/workspace", nil))
	if rr.Code != 200 {
		t.Fatal(rr.Body.String())
	}
	var wsj struct {
		Cwd      string                  `json:"cwd"`
		Requests []workspace.RequestMeta `json:"requests"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &wsj); err != nil {
		t.Fatal(err)
	}
	if len(wsj.Requests) != 1 || wsj.Requests[0].Path != "auth/login" {
		t.Fatalf("%+v", wsj)
	}
	if !filepath.IsAbs(wsj.Cwd) {
		t.Fatalf("cwd not abs: %q", wsj.Cwd)
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/requests/../x", nil))
	if rr.Code != 400 {
		t.Fatalf("expected 400 got %d", rr.Code)
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodDelete, "/api/requests/auth/login", nil))
	if rr.Code != 200 && rr.Code != 204 {
		t.Fatalf("delete %d", rr.Code)
	}
}

func TestRequestPathAllowsDotDotInName(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	body := []byte(`{"path":"v1..2/x","request":{"name":"X","method":"GET","url":"http://h","query":{},"headers":{},"body":{"type":"none"}}}`)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/requests", body))
	if rr.Code != 200 && rr.Code != 201 {
		t.Fatalf("create v1..2/x %d %s", rr.Code, rr.Body.Bytes())
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/requests/v1..2/x", nil))
	if rr.Code != 200 {
		t.Fatalf("get v1..2/x %d %s", rr.Code, rr.Body.Bytes())
	}
}

func TestEnvironmentJSONKeys(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)

	rr := httptest.NewRecorder()
	putBody := []byte(`{"name":"local","variables":{"baseUrl":"http://h"}}`)
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/environments/local", putBody))
	if rr.Code != http.StatusOK {
		t.Fatalf("put %d %s", rr.Code, rr.Body.Bytes())
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/environments", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("get %d %s", rr.Code, rr.Body.Bytes())
	}
	body := rr.Body.Bytes()
	if !bytes.Contains(body, []byte(`"name"`)) || !bytes.Contains(body, []byte(`"variables"`)) {
		t.Fatalf("expected lowercase keys, got %s", body)
	}
	if bytes.Contains(body, []byte(`"Name"`)) || bytes.Contains(body, []byte(`"Variables"`)) {
		t.Fatalf("expected no PascalCase keys, got %s", body)
	}
}

func TestLocalAndEnvAPI(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/environments/local", []byte(`{"name":"local","variables":{"baseUrl":"http://h"}}`)))
	if rr.Code != 200 {
		t.Fatalf("%d %s", rr.Code, rr.Body.Bytes())
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/local", []byte(`{"environment":"local","secrets":{"t":"1"}}`)))
	if rr.Code != 200 {
		t.Fatalf("%d %s", rr.Code, rr.Body.Bytes())
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/local", nil))
	if rr.Code != 200 || !bytes.Contains(rr.Body.Bytes(), []byte(`"t":"1"`)) {
		t.Fatalf("%s", rr.Body.Bytes())
	}
}
