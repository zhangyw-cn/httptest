package workspace

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPutGetDeleteRequest(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	req := Request{
		Name:    "Login",
		Method:  "post",
		URL:     "{{baseUrl}}/api/login",
		Query:   map[string]string{"n": "1"},
		Headers: map[string]string{"Accept": "application/json"},
		Body: Body{Type: BodyJSON, Text: `{"user":"{{username}}"}`},
	}
	if err := ws.PutRequest("auth/login", req); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(ws.Workdir(), "collections", "auth", "login.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if !containsAll(string(raw), "name: Login", "method: POST", "type: json") {
		t.Fatalf("yaml=%s", raw)
	}
	got, err := ws.GetRequest("auth/login")
	if err != nil {
		t.Fatal(err)
	}
	if got.Method != "POST" || got.Name != "Login" || got.Body.Text != `{"user":"{{username}}"}` {
		t.Fatalf("%+v", got)
	}
	list, err := ws.ListRequests()
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].Path != "auth/login" || list[0].Name != "Login" {
		t.Fatalf("%+v", list)
	}
	if err := ws.DeleteRequest("auth/login"); err != nil {
		t.Fatal(err)
	}
	if _, err := ws.GetRequest("auth/login"); err == nil {
		t.Fatal("expected missing")
	}
}

func TestPutRequestRejectsTraversal(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := ws.PutRequest("../x", Request{Name: "x", Method: "GET", URL: "http://example.com"}); err == nil {
		t.Fatal("expected error")
	}
}

func TestFormBodyRoundTrip(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	req := Request{
		Name:   "Form",
		Method: "POST",
		URL:    "http://example.com",
		Body:   Body{Type: BodyForm, Form: map[string]string{"a": "b"}},
	}
	if err := ws.PutRequest("form", req); err != nil {
		t.Fatal(err)
	}
	got, err := ws.GetRequest("form")
	if err != nil {
		t.Fatal(err)
	}
	if got.Body.Type != BodyForm || got.Body.Form["a"] != "b" {
		t.Fatalf("%+v", got.Body)
	}
}

func TestListRequestsSkipsInvalidFiles(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	req := Request{
		Name:   "Good",
		Method: "GET",
		URL:    "http://example.com/good",
	}
	if err := ws.PutRequest("good", req); err != nil {
		t.Fatal(err)
	}
	collections := filepath.Join(ws.Workdir(), "collections")
	if err := os.WriteFile(filepath.Join(collections, "bad-method.yaml"), []byte("name: Bad\nmethod: FOO\nurl: http://example.com/bad\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(collections, "corrupt.yaml"), []byte("name: Bad\nmethod: [\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	list, err := ws.ListRequests()
	if err != nil {
		t.Fatalf("ListRequests should not fail on invalid files: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 request, got %d: %+v", len(list), list)
	}
	if list[0].Path != "good" || list[0].Name != "Good" {
		t.Fatalf("%+v", list)
	}
}

func TestGetRequestRejectsTopLevelTimeout(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(ws.Workdir(), "collections", "old.yaml")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	content := "name: Old\nmethod: GET\nurl: http://example.com\ntimeout: 30s\n"
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	_, err = ws.GetRequest("old")
	if err == nil || !strings.Contains(err.Error(), "settings.timeoutMs") {
		t.Fatalf("got %v", err)
	}
}

func TestPutRequestCompactsDefaultSettings(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	ms := int64(30000)
	follow := true
	max := 10
	insecure := false
	req := Request{
		Name:   "Def",
		Method: "GET",
		URL:    "http://example.com",
		Settings: RequestSettings{
			TimeoutMs: &ms, FollowRedirects: &follow,
			MaxRedirects: &max, InsecureSkipVerify: &insecure,
		},
	}
	if err := ws.PutRequest("def", req); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(ws.Workdir(), "collections", "def.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "settings:") {
		t.Fatalf("expected no settings block, got %s", raw)
	}
}

func TestPutGetRequestSettingsRoundTrip(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	ms := int64(5000)
	follow := false
	req := Request{
		Name:   "S",
		Method: "GET",
		URL:    "http://example.com",
		Settings: RequestSettings{TimeoutMs: &ms, FollowRedirects: &follow},
	}
	if err := ws.PutRequest("s", req); err != nil {
		t.Fatal(err)
	}
	got, err := ws.GetRequest("s")
	if err != nil {
		t.Fatal(err)
	}
	if got.Settings.TimeoutMs == nil || *got.Settings.TimeoutMs != 5000 {
		t.Fatalf("%+v", got.Settings)
	}
	if got.Settings.FollowRedirects == nil || *got.Settings.FollowRedirects {
		t.Fatalf("%+v", got.Settings)
	}
}

func containsAll(s string, parts ...string) bool {
	for _, p := range parts {
		if !strings.Contains(s, p) {
			return false
		}
	}
	return true
}
