package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/zhangyw-cn/httptest/internal/executor"
	"github.com/zhangyw-cn/httptest/internal/workspace"
)

func TestExecuteWritesHistory(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer target.Close()

	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	payload, _ := json.Marshal(map[string]any{
		"id": "exec-1",
		"request": workspace.Request{
			Method: "GET",
			URL:    target.URL + "/ping",
		},
	})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/execute", payload))
	if rr.Code != 200 {
		t.Fatalf("%d %s", rr.Code, rr.Body.Bytes())
	}
	var res executor.Result
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if res.Status != 200 || res.ErrorClass != executor.ClassHTTP {
		t.Fatalf("%+v", res)
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/history/exec-1", nil))
	if rr.Code != 200 {
		t.Fatalf("history %d %s", rr.Code, rr.Body.Bytes())
	}
}

func TestCancelInFlight(t *testing.T) {
	started := make(chan struct{})
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(started)
		time.Sleep(2 * time.Second)
	}))
	defer target.Close()
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	payload, _ := json.Marshal(map[string]any{
		"id":      "exec-2",
		"request": workspace.Request{Method: "GET", URL: target.URL},
	})
	done := make(chan *httptest.ResponseRecorder)
	go func() {
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/execute", payload))
		done <- rr
	}()
	<-started
	crr := httptest.NewRecorder()
	h.ServeHTTP(crr, apiReq(http.MethodPost, "/api/execute/exec-2/cancel", nil))
	if crr.Code != 200 {
		t.Fatalf("cancel %d", crr.Code)
	}
	rr := <-done
	var res executor.Result
	_ = json.Unmarshal(rr.Body.Bytes(), &res)
	if res.ErrorClass != executor.ClassCanceled {
		t.Fatalf("%+v %s", res, rr.Body.Bytes())
	}
}

func TestExecuteHistoryErrorSurfaced(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))
	defer target.Close()

	dir := t.TempDir()
	ws, err := workspace.Init(dir)
	if err != nil {
		t.Fatal(err)
	}
	hist := filepath.Join(ws.LocalDir(), "history")
	if err := os.RemoveAll(hist); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(hist, []byte("not-a-dir"), 0o644); err != nil {
		t.Fatal(err)
	}

	h := New(ws, nil)
	payload, _ := json.Marshal(map[string]any{
		"id":      "exec-hist-fail",
		"request": workspace.Request{Method: "GET", URL: target.URL},
	})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/execute", payload))
	if rr.Code != 200 {
		t.Fatalf("%d %s", rr.Code, rr.Body.Bytes())
	}
	var res executor.Result
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if res.HistoryError == "" {
		t.Fatalf("want historyError, got %+v", res)
	}
}

func TestCancelWithoutContentTypeRejected(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/execute/none/cancel", nil)
	req.Host = "127.0.0.1:1370"
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("bare POST cancel: got %d %s", rr.Code, rr.Body.Bytes())
	}
}

func TestExecuteMissingOverrideInvalid(t *testing.T) {
	h := newTestHandler(t)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/local", []byte(`{"environment":"","override":"missing"}`)))
	if rr.Code != http.StatusOK {
		t.Fatal(rr.Code)
	}
	body := []byte(`{"id":"1","request":{"name":"R","method":"GET","url":"http://127.0.0.1/","query":{},"headers":{},"body":{"type":"none"}}}`)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/execute", body))
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d %s", rr.Code, rr.Body.Bytes())
	}
	var res struct {
		ErrorClass   string `json:"errorClass"`
		ErrorMessage string `json:"errorMessage"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if res.ErrorClass != "invalid" || !strings.Contains(res.ErrorMessage, "missing") {
		t.Fatalf("%+v", res)
	}
}

func TestExecuteIllegalOverrideNameInvalid(t *testing.T) {
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
	body := []byte(`{"id":"1","request":{"name":"R","method":"GET","url":"http://127.0.0.1/","query":{},"headers":{},"body":{"type":"none"}}}`)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/execute", body))
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d %s", rr.Code, rr.Body.Bytes())
	}
	var res struct {
		ErrorClass   string `json:"errorClass"`
		ErrorMessage string `json:"errorMessage"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if res.ErrorClass != "invalid" || !strings.Contains(res.ErrorMessage, "overrides/dev") {
		t.Fatalf("%+v", res)
	}
}

func TestCancelJSONEmptyBodyPassesGuard(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/execute/none/cancel", strings.NewReader("{}"))
	req.Host = "127.0.0.1:1370"
	req.Header.Set("Content-Type", "application/json")
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("JSON cancel should reach handler, got %d %s", rr.Code, rr.Body.Bytes())
	}
}
