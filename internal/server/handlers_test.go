package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/zhangyw-cn/httptest/internal/workspace"
)

func newTestHandler(t *testing.T) http.Handler {
	t.Helper()
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return New(ws, nil)
}

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
		Workdir  string                  `json:"workdir"`
		Requests []workspace.RequestMeta `json:"requests"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &wsj); err != nil {
		t.Fatal(err)
	}
	if len(wsj.Requests) != 1 || wsj.Requests[0].Path != "auth/login" {
		t.Fatalf("%+v", wsj)
	}
	if !filepath.IsAbs(wsj.Workdir) {
		t.Fatalf("workdir not abs: %q", wsj.Workdir)
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
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/overrides/default", []byte(`{"name":"default","variables":{"t":"1"}}`)))
	if rr.Code != 200 {
		t.Fatalf("%d %s", rr.Code, rr.Body.Bytes())
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/local", []byte(`{"environment":"local","override":"default"}`)))
	if rr.Code != 200 {
		t.Fatalf("%d %s", rr.Code, rr.Body.Bytes())
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/local", nil))
	if rr.Code != 200 || !bytes.Contains(rr.Body.Bytes(), []byte(`"override":"default"`)) {
		t.Fatalf("%s", rr.Body.Bytes())
	}
}

func TestEnvironmentDeleteAndRename(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	put := func(name, body string) {
		t.Helper()
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/environments/"+name, []byte(body)))
		if rr.Code != 200 {
			t.Fatalf("put %s %d %s", name, rr.Code, rr.Body.Bytes())
		}
	}
	put("local", `{"name":"local","variables":{"baseUrl":"http://h"}}`)
	put("prod", `{"name":"prod","variables":{}}`)

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/local", []byte(`{"environment":"local","override":"default"}`)))
	if rr.Code != 200 {
		t.Fatalf("local %d %s", rr.Code, rr.Body.Bytes())
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/environments/local/rename", []byte(`{"name":"dev"}`)))
	if rr.Code != 200 {
		t.Fatalf("rename %d %s", rr.Code, rr.Body.Bytes())
	}
	if !bytes.Contains(rr.Body.Bytes(), []byte(`"name":"dev"`)) {
		t.Fatalf("rename body %s", rr.Body.Bytes())
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/local", nil))
	if rr.Code != 200 || !bytes.Contains(rr.Body.Bytes(), []byte(`"environment":"dev"`)) {
		t.Fatalf("active after rename %s", rr.Body.Bytes())
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/environments/dev/rename", []byte(`{"name":"prod"}`)))
	if rr.Code != 409 {
		t.Fatalf("conflict %d %s", rr.Code, rr.Body.Bytes())
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/environments/dev/rename", []byte(`{"name":"dev"}`)))
	if rr.Code != 400 {
		t.Fatalf("same name %d %s", rr.Code, rr.Body.Bytes())
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/environments/nope/rename", []byte(`{"name":"x"}`)))
	if rr.Code != 404 {
		t.Fatalf("rename missing %d", rr.Code)
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodDelete, "/api/environments/prod", nil))
	if rr.Code != 204 {
		t.Fatalf("delete other %d %s", rr.Code, rr.Body.Bytes())
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/local", nil))
	if rr.Code != 200 || !bytes.Contains(rr.Body.Bytes(), []byte(`"environment":"dev"`)) {
		t.Fatalf("active after other delete %s", rr.Body.Bytes())
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodDelete, "/api/environments/dev", nil))
	if rr.Code != 204 {
		t.Fatalf("delete current %d", rr.Code)
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/local", nil))
	if rr.Code != 200 || !bytes.Contains(rr.Body.Bytes(), []byte(`"environment":""`)) {
		t.Fatalf("active after delete current %s", rr.Body.Bytes())
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodDelete, "/api/environments/dev", nil))
	if rr.Code != 404 {
		t.Fatalf("delete missing %d", rr.Code)
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodDelete, "/api/environments/../x", nil))
	if rr.Code != 400 {
		t.Fatalf("escape delete %d", rr.Code)
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/environments/../x/rename", []byte(`{"name":"y"}`)))
	if rr.Code != 400 {
		t.Fatalf("escape rename %d", rr.Code)
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodDelete, "/api/environments/a/b", nil))
	if rr.Code != 400 && rr.Code != 404 {
		t.Fatalf("slash name %d", rr.Code)
	}
}

func TestOverrideCRUDAndLocal(t *testing.T) {
	h := newTestHandler(t)
	putBody := []byte(`{"name":"default","variables":{"token":"s"}}`)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/overrides/default", putBody))
	if rr.Code != http.StatusOK {
		t.Fatalf("put %d %s", rr.Code, rr.Body.Bytes())
	}
	var putResp struct {
		Name      string            `json:"name"`
		Variables map[string]string `json:"variables"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &putResp); err != nil {
		t.Fatal(err)
	}
	if putResp.Name != "default" || putResp.Variables["token"] != "s" {
		t.Fatalf("%+v", putResp)
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/overrides/empty", []byte(`{"name":"empty"}`)))
	if rr.Code != http.StatusOK {
		t.Fatalf("put empty %d %s", rr.Code, rr.Body.Bytes())
	}
	putResp = struct {
		Name      string            `json:"name"`
		Variables map[string]string `json:"variables"`
	}{}
	if err := json.Unmarshal(rr.Body.Bytes(), &putResp); err != nil {
		t.Fatal(err)
	}
	if putResp.Name != "empty" || putResp.Variables == nil || len(putResp.Variables) != 0 {
		t.Fatalf("variables should be empty map, got %+v", putResp)
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/local", []byte(`{"environment":"","override":"default"}`)))
	if rr.Code != http.StatusOK {
		t.Fatalf("local %d", rr.Code)
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/overrides", nil))
	if rr.Code != http.StatusOK {
		t.Fatal(rr.Code)
	}
	var list []struct {
		Name      string            `json:"name"`
		Variables map[string]string `json:"variables"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &list); err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 {
		t.Fatalf("want 2 overrides, got %+v", list)
	}
	foundDefault, foundEmpty := false, false
	for _, o := range list {
		switch o.Name {
		case "default":
			if o.Variables["token"] == "s" {
				foundDefault = true
			}
		case "empty":
			if o.Variables != nil && len(o.Variables) == 0 {
				foundEmpty = true
			}
		}
	}
	if !foundDefault || !foundEmpty {
		t.Fatalf("list missing entries: %+v", list)
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/overrides/default/rename", []byte(`{"name":"prod"}`)))
	if rr.Code != http.StatusOK {
		t.Fatalf("rename %d %s", rr.Code, rr.Body.Bytes())
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/local", nil))
	var loc struct {
		Environment string `json:"environment"`
		Override    string `json:"override"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &loc); err != nil {
		t.Fatal(err)
	}
	if loc.Override != "prod" {
		t.Fatalf("%+v", loc)
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodDelete, "/api/overrides/prod", nil))
	if rr.Code != http.StatusNoContent {
		t.Fatal(rr.Code)
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/local", nil))
	if err := json.Unmarshal(rr.Body.Bytes(), &loc); err != nil {
		t.Fatal(err)
	}
	if loc.Override != "" {
		t.Fatalf("%+v", loc)
	}
}

func TestOverrideRenameConflict(t *testing.T) {
	h := newTestHandler(t)
	for _, name := range []string{"a", "b"} {
		body := []byte(`{"name":"` + name + `","variables":{}}`)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/overrides/"+name, body))
		if rr.Code != http.StatusOK {
			t.Fatal(rr.Code)
		}
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/overrides/a/rename", []byte(`{"name":"b"}`)))
	if rr.Code != http.StatusConflict {
		t.Fatalf("got %d", rr.Code)
	}
}

func TestPutLocalInvalidOverrideName(t *testing.T) {
	h := newTestHandler(t)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/local", []byte(`{"environment":"","override":"a/b"}`)))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("got %d %s", rr.Code, rr.Body.Bytes())
	}
}

func TestPutOverrideInvalidPathSegment(t *testing.T) {
	h := newTestHandler(t)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/overrides/a%2Fb", []byte(`{"name":"a/b","variables":{}}`)))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("got %d %s", rr.Code, rr.Body.Bytes())
	}
}

func TestHostsCRUDAndLocal(t *testing.T) {
	h := newTestHandler(t)
	putBody := []byte(`{"name":"lan","type":"map","mappings":{"api.example.com":"10.0.0.5"}}`)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/hosts/lan", putBody))
	if rr.Code != http.StatusOK {
		t.Fatalf("put %d %s", rr.Code, rr.Body.Bytes())
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/local", []byte(`{"environment":"","override":"","hosts":"lan"}`)))
	if rr.Code != http.StatusOK {
		t.Fatalf("local %d %s", rr.Code, rr.Body.Bytes())
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/hosts/lan/rename", []byte(`{"name":"lab"}`)))
	if rr.Code != http.StatusOK {
		t.Fatalf("rename %d %s", rr.Code, rr.Body.Bytes())
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/local", nil))
	var loc struct {
		Hosts string `json:"hosts"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &loc); err != nil {
		t.Fatal(err)
	}
	if loc.Hosts != "lab" {
		t.Fatalf("%+v", loc)
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodDelete, "/api/hosts/lab", nil))
	if rr.Code != http.StatusNoContent {
		t.Fatal(rr.Code)
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/local", nil))
	if err := json.Unmarshal(rr.Body.Bytes(), &loc); err != nil {
		t.Fatal(err)
	}
	if loc.Hosts != "" {
		t.Fatalf("%+v", loc)
	}
}

func TestHostsPutInvalidMapping(t *testing.T) {
	h := newTestHandler(t)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/hosts/lan", []byte(`{"name":"lan","type":"map","mappings":{"a/b":"1.1.1.1"}}`)))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("got %d", rr.Code)
	}
}

func TestHostsListInvalidType500(t *testing.T) {
	ws, err := workspace.Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := New(ws, nil)
	putOK := []byte(`{"name":"ok","type":"map","mappings":{"a.com":"1.1.1.1"}}`)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/hosts/ok", putOK))
	if rr.Code != http.StatusOK {
		t.Fatal(rr.Code)
	}
	bad := filepath.Join(ws.Workdir(), "hosts", "bad.yaml")
	if err := os.WriteFile(bad, []byte("name: bad\nmappings: {}\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodGet, "/api/hosts", nil))
	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("got %d %s", rr.Code, rr.Body.Bytes())
	}
}

func TestHostsPutChangeType400(t *testing.T) {
	h := newTestHandler(t)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/hosts/lan", []byte(`{"name":"lan","type":"map","mappings":{}}`)))
	if rr.Code != http.StatusOK {
		t.Fatal(rr.Code)
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/hosts/lan", []byte(`{"name":"lan","type":"hosts","content":""}`)))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("got %d", rr.Code)
	}
}

func TestHostsPutHostsTypeOK(t *testing.T) {
	h := newTestHandler(t)
	body := []byte(`{"name":"lan","type":"hosts","content":"10.0.0.5 api.example.com api\n"}`)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/hosts/lan", body))
	if rr.Code != http.StatusOK {
		t.Fatalf("%d %s", rr.Code, rr.Body.Bytes())
	}
}

func TestHostsRenameConflict(t *testing.T) {
	h := newTestHandler(t)
	for _, name := range []string{"a", "b"} {
		body := []byte(`{"name":"` + name + `","type":"map","mappings":{}}`)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, apiReq(http.MethodPut, "/api/hosts/"+name, body))
		if rr.Code != http.StatusOK {
			t.Fatal(rr.Code)
		}
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, apiReq(http.MethodPost, "/api/hosts/a/rename", []byte(`{"name":"b"}`)))
	if rr.Code != http.StatusConflict {
		t.Fatalf("got %d", rr.Code)
	}
}
