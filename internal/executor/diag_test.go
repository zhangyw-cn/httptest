package executor

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/zhangyw-cn/httptest/internal/workspace"
)

func TestRedirectChain(t *testing.T) {
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/a" {
			http.Redirect(w, r, srv.URL+"/b", http.StatusFound)
			return
		}
		w.WriteHeader(200)
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()
	res := Execute(context.Background(), workspace.Request{Method: "GET", URL: srv.URL + "/a"}, nil)
	if res.ErrorClass != ClassHTTP || res.Status != 200 || res.Body != "ok" {
		t.Fatalf("%+v", res)
	}
	if len(res.Redirects) != 1 || res.Redirects[0].Status != 302 {
		t.Fatalf("redirects=%+v", res.Redirects)
	}
}

func TestRedirectFollowsTenThenOK(t *testing.T) {
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var n int
		_, _ = fmt.Sscanf(strings.TrimPrefix(r.URL.Path, "/"), "%d", &n)
		if n < 10 {
			http.Redirect(w, r, fmt.Sprintf("%s/%d", srv.URL, n+1), http.StatusFound)
			return
		}
		w.WriteHeader(200)
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()
	res := Execute(context.Background(), workspace.Request{Method: "GET", URL: srv.URL + "/0"}, nil)
	if res.ErrorClass != ClassHTTP || res.Status != 200 || res.Body != "ok" {
		t.Fatalf("%+v", res)
	}
	if len(res.Redirects) != 10 {
		t.Fatalf("redirects=%d want 10: %+v", len(res.Redirects), res.Redirects)
	}
	if res.ErrorMessage != "" {
		t.Fatalf("unexpected error %q", res.ErrorMessage)
	}
}

func TestRedirectLimitSurfaced(t *testing.T) {
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, srv.URL+"/next", http.StatusFound)
	}))
	defer srv.Close()
	res := Execute(context.Background(), workspace.Request{Method: "GET", URL: srv.URL}, nil)
	if res.ErrorClass != ClassHTTP || res.Status != http.StatusFound {
		t.Fatalf("%+v", res)
	}
	if !strings.Contains(res.ErrorMessage, "redirect limit") {
		t.Fatalf("want redirect limit message, got %q", res.ErrorMessage)
	}
	if len(res.Redirects) != 10 {
		t.Fatalf("redirects=%d want 10", len(res.Redirects))
	}
}

func TestUnsupportedSchemeIsInvalid(t *testing.T) {
	for _, raw := range []string{"file:///etc/passwd", "ftp://example.com/", "/relative-path"} {
		res := Execute(context.Background(), workspace.Request{Method: "GET", URL: raw}, nil)
		if res.ErrorClass != ClassInvalid {
			t.Fatalf("%s: class=%s msg=%s", raw, res.ErrorClass, res.ErrorMessage)
		}
	}
}

func TestTimeoutClass(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(300 * time.Millisecond)
		w.WriteHeader(200)
	}))
	defer srv.Close()
	res := Execute(context.Background(), workspace.Request{Method: "GET", URL: srv.URL, Timeout: "50ms"}, nil)
	if res.ErrorClass != ClassTimeout {
		t.Fatalf("%+v", res)
	}
}

func TestDNSClass(t *testing.T) {
	res := Execute(context.Background(), workspace.Request{Method: "GET", URL: "http://no-such-host.invalid/"}, nil)
	if res.ErrorClass != ClassDNS {
		t.Fatalf("%+v", res)
	}
}

func TestTLSClass(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer srv.Close()
	httpsURL := "https://" + strings.TrimPrefix(srv.URL, "http://")
	res := Execute(context.Background(), workspace.Request{Method: "GET", URL: httpsURL}, nil)
	if res.ErrorClass != ClassTLS {
		t.Fatalf("%+v", res)
	}
}

func TestCanceledClass(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(500 * time.Millisecond)
	}))
	defer srv.Close()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	res := Execute(ctx, workspace.Request{Method: "GET", URL: srv.URL}, nil)
	if res.ErrorClass != ClassCanceled {
		t.Fatalf("%+v", res)
	}
}

func TestTruncateBody(t *testing.T) {
	big := strings.Repeat("a", 2*1024*1024+50)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(big))
	}))
	defer srv.Close()
	res := Execute(context.Background(), workspace.Request{Method: "GET", URL: srv.URL}, nil)
	if !res.Truncated || len(res.Body) != 2*1024*1024 {
		t.Fatalf("truncated=%v len=%d", res.Truncated, len(res.Body))
	}
	if res.ErrorMessage != "" {
		t.Fatalf("truncate is not a read error: %q", res.ErrorMessage)
	}
}
