package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/zhangyw-cn/httptest/internal/executor"
	"github.com/zhangyw-cn/httptest/internal/workspace"
)

func TestPrepareMissingVars(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	payload, _ := json.Marshal(map[string]any{
		"request": workspace.Request{Method: "GET", URL: "{{base}}/x"},
	})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/prepare", payload))
	if rr.Code != 200 {
		t.Fatalf("%d %s", rr.Code, rr.Body.Bytes())
	}
	var res executor.PrepareResult
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if res.ErrorClass != executor.ClassInvalid || len(res.MissingVars) == 0 {
		t.Fatalf("%+v", res)
	}
}

func TestPrepareResolveNoHistory(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutHosts(workspace.HostsFile{
		Name:     "lan",
		Type:     workspace.HostsTypeMap,
		Mappings: map[string]string{"api.local": "10.0.0.9"},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.PutLocal(workspace.Local{Hosts: "lan"}); err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	payload, _ := json.Marshal(map[string]any{
		"request": workspace.Request{Method: "GET", URL: "http://api.local/p"},
	})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/prepare", payload))
	if rr.Code != 200 {
		t.Fatalf("%d %s", rr.Code, rr.Body.Bytes())
	}
	var res executor.PrepareResult
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if res.ErrorClass != "" || res.Resolve == nil || res.Resolve.IP != "10.0.0.9" {
		t.Fatalf("%+v", res)
	}
	entries, err := ws.ListHistory(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Fatalf("history should stay empty, got %d", len(entries))
	}
}

func TestPrepareInvalidTimeout(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	payload, _ := json.Marshal(map[string]any{
		"request": workspace.Request{Method: "GET", URL: "http://h/", Timeout: "bogus"},
	})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/prepare", payload))
	if rr.Code != http.StatusOK {
		t.Fatalf("%d %s", rr.Code, rr.Body.Bytes())
	}
	var res executor.PrepareResult
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if res.ErrorClass != executor.ClassInvalid {
		t.Fatalf("%+v", res)
	}
	if res.TimeoutSeconds != 0 {
		t.Fatalf("timeoutSeconds should be omitted/zero, got %v", res.TimeoutSeconds)
	}
}

func TestPrepareIllegalOverrideInvalid(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
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
	h := New(ws, nil)
	payload, _ := json.Marshal(map[string]any{
		"request": workspace.Request{Method: "GET", URL: "http://127.0.0.1/"},
	})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/prepare", payload))
	if rr.Code != http.StatusOK {
		t.Fatalf("%d %s", rr.Code, rr.Body.Bytes())
	}
	var res executor.PrepareResult
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if res.ErrorClass != executor.ClassInvalid {
		t.Fatalf("%+v", res)
	}
	if !strings.Contains(res.ErrorMessage, "overrides/dev") {
		t.Fatalf("%+v", res)
	}
}
