package executor

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"httptest/internal/workspace"
)

func TestExecuteJSONOK(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/login" {
			t.Errorf("got %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("ct=%s", r.Header.Get("Content-Type"))
		}
		if r.Header.Get("User-Agent") != "httptest/0.1" {
			t.Errorf("ua=%s", r.Header.Get("User-Agent"))
		}
		b, _ := io.ReadAll(r.Body)
		if string(b) != `{"u":"n"}` {
			t.Errorf("body=%s", b)
		}
		w.Header().Set("X-R", "1")
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer srv.Close()

	req := workspace.Request{
		Method: "POST",
		URL:    "{{baseUrl}}/login",
		Body:   workspace.Body{Type: workspace.BodyJSON, Text: `{"u":"{{user}}"}`},
	}
	res := Execute(context.Background(), req, map[string]string{"baseUrl": srv.URL, "user": "n"})
	if res.ErrorClass != ClassHTTP || res.Status != 200 || res.Body != `{"ok":true}` {
		t.Fatalf("%+v", res)
	}
	if res.Headers["X-R"][0] != "1" {
		t.Fatalf("headers=%v", res.Headers)
	}
	if !strings.Contains(res.RequestDump, "POST") || !strings.Contains(res.ResponseDump, "200") {
		t.Fatalf("dumps %s %s", res.RequestDump, res.ResponseDump)
	}
	if res.Prepared.URL != srv.URL+"/login" {
		t.Fatalf("prepared %s", res.Prepared.URL)
	}
}

func TestExecuteMissingVarDoesNotHitServer(t *testing.T) {
	hit := false
	srv := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { hit = true }))
	defer srv.Close()
	res := Execute(context.Background(), workspace.Request{Method: "GET", URL: "{{missing}}/x"}, nil)
	if hit {
		t.Fatal("server hit")
	}
	if res.ErrorClass != ClassInvalid || len(res.MissingVars) != 1 || res.MissingVars[0] != "missing" {
		t.Fatalf("%+v", res)
	}
}

func TestExecuteNotFoundIsHTTP(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	defer srv.Close()
	res := Execute(context.Background(), workspace.Request{Method: "GET", URL: srv.URL + "/nope"}, nil)
	if res.ErrorClass != ClassHTTP || res.Status != 404 {
		t.Fatalf("%+v", res)
	}
}

func TestExecuteSendsConnectionClose(t *testing.T) {
	var connHdr string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		connHdr = r.Header.Get("Connection")
		w.WriteHeader(200)
	}))
	defer srv.Close()
	res := Execute(context.Background(), workspace.Request{Method: "GET", URL: srv.URL}, nil)
	if res.ErrorClass != ClassHTTP || res.Status != 200 {
		t.Fatalf("%+v", res)
	}
	if !strings.EqualFold(connHdr, "close") {
		t.Fatalf("Connection=%q, want close (DisableKeepAlives)", connHdr)
	}
}

func TestExecuteTransportIgnoresProxy(t *testing.T) {
	tr := newExecuteTransport()
	if tr.Proxy != nil {
		t.Fatal("Proxy must be nil so HTTP_PROXY/HTTPS_PROXY are ignored")
	}
	if !tr.DisableKeepAlives {
		t.Fatal("DisableKeepAlives must be true")
	}
}

func TestExecuteBodyReadErrorSetsMessage(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hj, ok := w.(http.Hijacker)
		if !ok {
			t.Fatal("ResponseWriter is not a Hijacker")
			return
		}
		conn, bufrw, err := hj.Hijack()
		if err != nil {
			t.Fatal(err)
			return
		}
		_, _ = bufrw.WriteString("HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\npartial")
		_ = bufrw.Flush()
		_ = conn.Close()
	}))
	defer srv.Close()
	res := Execute(context.Background(), workspace.Request{Method: "GET", URL: srv.URL}, nil)
	if res.ErrorMessage == "" {
		t.Fatalf("want ErrorMessage on body read failure, got %+v", res)
	}
	if !strings.Contains(res.Body, "partial") {
		t.Fatalf("want partial body kept, got %q", res.Body)
	}
}
