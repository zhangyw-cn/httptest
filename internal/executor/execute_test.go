package executor

import (
	"bytes"
	"compress/gzip"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/zhangyw-cn/httptest/internal/workspace"
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
	res := Execute(context.Background(), req, map[string]string{"baseUrl": srv.URL, "user": "n"}, nil)
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
	if res.RequestSize != int64(len(`{"u":"n"}`)) {
		t.Fatalf("requestSize=%d want body length", res.RequestSize)
	}
	if res.ResponseSize != int64(len(`{"ok":true}`)) {
		t.Fatalf("responseSize=%d", res.ResponseSize)
	}
	if res.Timings.TotalMs <= 0 {
		t.Fatalf("totalMs should be sub-ms precise and > 0, got %v", res.Timings.TotalMs)
	}
}

func TestElapsedMsFractional(t *testing.T) {
	start := time.Now()
	end := start.Add(250 * time.Microsecond)
	got := elapsedMs(start, end)
	if got < 0.2 || got > 0.3 {
		t.Fatalf("elapsedMs=%v want ~0.25", got)
	}
	if elapsedMs(time.Time{}, end) != 0 {
		t.Fatal("zero start should be 0")
	}
}

func TestExecuteMissingVarDoesNotHitServer(t *testing.T) {
	hit := false
	srv := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { hit = true }))
	defer srv.Close()
	res := Execute(context.Background(), workspace.Request{Method: "GET", URL: "{{missing}}/x"}, nil, nil)
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
	res := Execute(context.Background(), workspace.Request{Method: "GET", URL: srv.URL + "/nope"}, nil, nil)
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
	res := Execute(context.Background(), workspace.Request{Method: "GET", URL: srv.URL}, nil, nil)
	if res.ErrorClass != ClassHTTP || res.Status != 200 {
		t.Fatalf("%+v", res)
	}
	if !strings.EqualFold(connHdr, "close") {
		t.Fatalf("Connection=%q, want close (DisableKeepAlives)", connHdr)
	}
	if res.RequestSize != 0 {
		t.Fatalf("GET requestSize=%d want 0 (body bytes, not dump)", res.RequestSize)
	}
}

func TestExecuteTransportIgnoresProxy(t *testing.T) {
	tr := newExecuteTransport(nil, nil)
	if tr.Proxy != nil {
		t.Fatal("Proxy must be nil so HTTP_PROXY/HTTPS_PROXY are ignored")
	}
	if !tr.DisableKeepAlives {
		t.Fatal("DisableKeepAlives must be true")
	}
	if !tr.DisableCompression {
		t.Fatal("DisableCompression must be true so DumpResponse keeps Content-Encoding")
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
	res := Execute(context.Background(), workspace.Request{Method: "GET", URL: srv.URL}, nil, nil)
	if res.ErrorMessage == "" {
		t.Fatalf("want ErrorMessage on body read failure, got %+v", res)
	}
	if !strings.Contains(res.Body, "partial") {
		t.Fatalf("want partial body kept, got %q", res.Body)
	}
}

func TestGzipDumpKeepsEncodingAndWireSize(t *testing.T) {
	plain := []byte(strings.Repeat("hello gzip body ", 80))
	var zipped bytes.Buffer
	zw := gzip.NewWriter(&zipped)
	if _, err := zw.Write(plain); err != nil {
		t.Fatal(err)
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	wire := zipped.Bytes()
	if len(wire) >= len(plain) {
		t.Fatalf("expected compressed body smaller, plain=%d wire=%d", len(plain), len(wire))
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(200)
		_, _ = w.Write(wire)
	}))
	defer srv.Close()

	res := Execute(context.Background(), workspace.Request{Method: "GET", URL: srv.URL}, nil, nil)
	if res.ErrorClass != ClassHTTP || res.Status != 200 {
		t.Fatalf("%+v", res)
	}
	if res.Body != string(plain) {
		t.Fatalf("decoded body=%q", res.Body)
	}
	if res.ResponseSize != int64(len(wire)) {
		t.Fatalf("responseSize=%d want wire %d", res.ResponseSize, len(wire))
	}
	if !strings.Contains(res.ResponseDump, "Content-Encoding: gzip") {
		t.Fatalf("dump missing Content-Encoding:\n%s", res.ResponseDump)
	}
}

func TestExecuteHostsMappingKeepsHostHeader(t *testing.T) {
	var sawHost string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawHost = r.Host
		w.WriteHeader(200)
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()
	u, err := url.Parse(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	hostURL := "http://api.example.com:" + u.Port() + "/x"
	res := Execute(context.Background(), workspace.Request{Method: "GET", URL: hostURL}, nil, map[string]string{
		"api.example.com": "127.0.0.1",
	})
	if res.ErrorClass != ClassHTTP || res.Status != 200 {
		t.Fatalf("%+v", res)
	}
	if sawHost != "api.example.com:"+u.Port() {
		t.Fatalf("host=%q", sawHost)
	}
	if res.ResolvedIP != "127.0.0.1" {
		t.Fatalf("resolvedIP=%q", res.ResolvedIP)
	}
}

func TestExecuteHostsRedirectSecondHop(t *testing.T) {
	mux := http.NewServeMux()
	srv := httptest.NewServer(mux)
	defer srv.Close()
	u, _ := url.Parse(srv.URL)
	port := u.Port()
	mux.HandleFunc("/a", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "http://pay.example.com:"+port+"/b", http.StatusFound)
	})
	mux.HandleFunc("/b", func(w http.ResponseWriter, r *http.Request) {
		if r.Host != "pay.example.com:"+port {
			t.Errorf("hop2 host=%q", r.Host)
		}
		w.WriteHeader(200)
		_, _ = w.Write([]byte("done"))
	})
	mappings := map[string]string{
		"api.example.com": "127.0.0.1",
		"pay.example.com": "127.0.0.1",
	}
	res := Execute(context.Background(), workspace.Request{
		Method: "GET",
		URL:    "http://api.example.com:" + port + "/a",
	}, nil, mappings)
	if res.ErrorClass != ClassHTTP || res.Status != 200 || res.Body != "done" {
		t.Fatalf("%+v", res)
	}
	if len(res.Redirects) < 1 {
		t.Fatalf("redirects=%v", res.Redirects)
	}
}

func TestExecuteHostsResolvedIPClearsOnUnmappedHop(t *testing.T) {
	mux := http.NewServeMux()
	srv := httptest.NewServer(mux)
	defer srv.Close()
	u, _ := url.Parse(srv.URL)
	port := u.Port()
	mux.HandleFunc("/a", func(w http.ResponseWriter, r *http.Request) {
		// Second hop uses the literal server host (IP), which must not remap.
		http.Redirect(w, r, srv.URL+"/b", http.StatusFound)
	})
	mux.HandleFunc("/b", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		_, _ = w.Write([]byte("done"))
	})
	res := Execute(context.Background(), workspace.Request{
		Method: "GET",
		URL:    "http://api.example.com:" + port + "/a",
	}, nil, map[string]string{
		"api.example.com": "127.0.0.1",
	})
	if res.ErrorClass != ClassHTTP || res.Status != 200 || res.Body != "done" {
		t.Fatalf("%+v", res)
	}
	if res.ResolvedIP != "" {
		t.Fatalf("final hop is IP literal; resolvedIP should clear, got %q", res.ResolvedIP)
	}
}
