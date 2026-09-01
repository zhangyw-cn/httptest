package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"httptest/internal/executor"
	"httptest/internal/workspace"
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
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodPost, "/api/execute", bytes.NewReader(payload)))
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
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/history/exec-1", nil))
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
		"id": "exec-2",
		"request": workspace.Request{Method: "GET", URL: target.URL},
	})
	done := make(chan *httptest.ResponseRecorder)
	go func() {
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, httptest.NewRequest(http.MethodPost, "/api/execute", bytes.NewReader(payload)))
		done <- rr
	}()
	<-started
	crr := httptest.NewRecorder()
	h.ServeHTTP(crr, httptest.NewRequest(http.MethodPost, "/api/execute/exec-2/cancel", nil))
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
