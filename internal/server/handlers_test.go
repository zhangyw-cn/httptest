package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"httptest/internal/workspace"
)

func TestRequestCRUDAndTraversal(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	body := []byte(`{"path":"auth/login","request":{"name":"Login","method":"POST","url":"http://h/login","query":{},"headers":{},"body":{"type":"none"}}}`)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/requests", bytes.NewReader(body))
	h.ServeHTTP(rr, req)
	if rr.Code != 200 && rr.Code != 201 {
		t.Fatalf("create %d %s", rr.Code, rr.Body.Bytes())
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/requests/auth/login", nil))
	if rr.Code != 200 {
		t.Fatalf("get %d %s", rr.Code, rr.Body.Bytes())
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/workspace", nil))
	if rr.Code != 200 {
		t.Fatal(rr.Body.String())
	}
	var wsj struct {
		Requests []workspace.RequestMeta `json:"requests"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &wsj); err != nil {
		t.Fatal(err)
	}
	if len(wsj.Requests) != 1 || wsj.Requests[0].Path != "auth/login" {
		t.Fatalf("%+v", wsj)
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/requests/../x", nil))
	if rr.Code != 400 {
		t.Fatalf("expected 400 got %d", rr.Code)
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodDelete, "/api/requests/auth/login", nil))
	if rr.Code != 200 && rr.Code != 204 {
		t.Fatalf("delete %d", rr.Code)
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
	req := httptest.NewRequest(http.MethodPut, "/api/environments/local", bytes.NewReader(putBody))
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("put %d %s", rr.Code, rr.Body.Bytes())
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/environments", nil))
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
	req := httptest.NewRequest(http.MethodPut, "/api/environments/local", bytes.NewReader([]byte(`{"name":"local","variables":{"baseUrl":"http://h"}}`)))
	h.ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("%d %s", rr.Code, rr.Body.Bytes())
	}
	rr = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPut, "/api/local", bytes.NewReader([]byte(`{"environment":"local","secrets":{"t":"1"}}`)))
	h.ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("%d %s", rr.Code, rr.Body.Bytes())
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/local", nil))
	if rr.Code != 200 || !bytes.Contains(rr.Body.Bytes(), []byte(`"t":"1"`)) {
		t.Fatalf("%s", rr.Body.Bytes())
	}
}
