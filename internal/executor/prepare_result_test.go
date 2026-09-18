package executor

import (
	"testing"

	"github.com/zhangyw-cn/httptest/internal/workspace"
)

func TestLookupResolveHit(t *testing.T) {
	r := LookupResolve("https://API.Example.com/v1", map[string]string{"api.example.com": "10.0.0.5"})
	if r == nil || r.Host != "api.example.com" || r.Port != "443" || r.IP != "10.0.0.5" {
		t.Fatalf("%+v", r)
	}
}

func TestLookupResolveMiss(t *testing.T) {
	if LookupResolve("http://other.com/", map[string]string{"api.com": "1.1.1.1"}) != nil {
		t.Fatal("expected nil")
	}
}

func TestEffectiveTimeoutSecondsFromSettings(t *testing.T) {
	s, err := EffectiveTimeoutSeconds(workspace.RequestSettings{})
	if err != nil || s != 30 {
		t.Fatalf("%v %v", s, err)
	}
	ms := int64(500)
	s, err = EffectiveTimeoutSeconds(workspace.RequestSettings{TimeoutMs: &ms})
	if err != nil || s != 0.5 {
		t.Fatalf("%v %v", s, err)
	}
}

func TestBuildPrepareResultInvalidSettings(t *testing.T) {
	bad := int64(-1)
	res := BuildPrepareResult(workspace.Request{
		Method:   "GET",
		URL:      "http://h/",
		Settings: workspace.RequestSettings{TimeoutMs: &bad},
	}, nil, nil)
	if res.ErrorClass != ClassInvalid || res.TimeoutSeconds != 0 {
		t.Fatalf("%+v", res)
	}
}

func TestBuildPrepareResultMissingVars(t *testing.T) {
	res := BuildPrepareResult(workspace.Request{
		Method: "GET",
		URL:    "{{base}}/x",
	}, nil, nil)
	if res.ErrorClass != ClassInvalid || len(res.MissingVars) == 0 {
		t.Fatalf("%+v", res)
	}
}

func TestBuildPrepareResultInvalidURL(t *testing.T) {
	cases := []struct {
		url string
		msg string
	}{
		{"not-a-url", "unsupported protocol scheme"},
		{"ftp://h/", "unsupported protocol scheme ftp"},
	}
	for _, tc := range cases {
		res := BuildPrepareResult(workspace.Request{
			Method: "GET",
			URL:    tc.url,
		}, nil, nil)
		if res.ErrorClass != ClassInvalid {
			t.Fatalf("url=%q class=%q want invalid", tc.url, res.ErrorClass)
		}
		if res.ErrorMessage != tc.msg {
			t.Fatalf("url=%q msg=%q want %q", tc.url, res.ErrorMessage, tc.msg)
		}
	}
}

func TestBuildPrepareResultOK(t *testing.T) {
	res := BuildPrepareResult(workspace.Request{
		Method: "GET",
		URL:    "http://api.local/ping",
	}, nil, map[string]string{"api.local": "127.0.0.1"})
	if res.ErrorClass != "" || res.Prepared.URL != "http://api.local/ping" {
		t.Fatalf("%+v", res)
	}
	if res.Resolve == nil || res.Resolve.IP != "127.0.0.1" || res.Resolve.Port != "80" {
		t.Fatalf("resolve=%+v", res.Resolve)
	}
	if res.TimeoutSeconds != 30 {
		t.Fatalf("timeout=%v", res.TimeoutSeconds)
	}
}

func TestLookupResolveHTTPSSchemeCase(t *testing.T) {
	r := LookupResolve("HTTPS://API.Example.com/v1", map[string]string{"api.example.com": "10.0.0.5"})
	if r == nil || r.Port != "443" {
		t.Fatalf("%+v", r)
	}
}
