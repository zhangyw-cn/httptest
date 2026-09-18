package workspace

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

const (
	DefaultTimeoutMs    int64 = 30000
	DefaultMaxRedirects       = 10
	MaxMaxRedirects           = 50
)

type RequestSettings struct {
	TimeoutMs          *int64 `json:"timeoutMs,omitempty" yaml:"timeoutMs,omitempty"`
	FollowRedirects    *bool  `json:"followRedirects,omitempty" yaml:"followRedirects,omitempty"`
	MaxRedirects       *int   `json:"maxRedirects,omitempty" yaml:"maxRedirects,omitempty"`
	InsecureSkipVerify *bool  `json:"insecureSkipVerify,omitempty" yaml:"insecureSkipVerify,omitempty"`
}

type Request struct {
	Name     string            `json:"name" yaml:"name"`
	Method   string            `json:"method" yaml:"method"`
	URL      string            `json:"url" yaml:"url"`
	Query    map[string]string `json:"query" yaml:"query"`
	Headers  map[string]string `json:"headers" yaml:"headers"`
	Body     Body              `json:"body" yaml:"body"`
	Settings RequestSettings   `json:"settings,omitempty" yaml:"settings,omitempty"`
}

func CompactSettings(s RequestSettings) RequestSettings {
	out := RequestSettings{}
	if s.TimeoutMs != nil && *s.TimeoutMs != DefaultTimeoutMs {
		out.TimeoutMs = s.TimeoutMs
	}
	if s.FollowRedirects != nil && !*s.FollowRedirects {
		out.FollowRedirects = s.FollowRedirects
	}
	if s.MaxRedirects != nil && *s.MaxRedirects != DefaultMaxRedirects {
		out.MaxRedirects = s.MaxRedirects
	}
	if s.InsecureSkipVerify != nil && *s.InsecureSkipVerify {
		out.InsecureSkipVerify = s.InsecureSkipVerify
	}
	return out
}

// RejectLegacyTimeoutObject rejects legacy top-level timeout and settings.timeout keys.
func RejectLegacyTimeoutObject(probe map[string]interface{}) error {
	if _, ok := probe["timeout"]; ok {
		return fmt.Errorf("top-level timeout is no longer supported; use settings.timeoutMs")
	}
	if raw, ok := probe["settings"]; ok && raw != nil {
		m, ok := raw.(map[string]interface{})
		if !ok {
			return fmt.Errorf("settings must be a mapping")
		}
		if _, ok := m["timeout"]; ok {
			return fmt.Errorf("settings.timeout is no longer supported; use settings.timeoutMs")
		}
	}
	return nil
}

func rejectLegacyTimeoutYAML(data []byte) error {
	var probe map[string]interface{}
	if err := yaml.Unmarshal(data, &probe); err != nil {
		return err
	}
	return RejectLegacyTimeoutObject(probe)
}

// RejectLegacyTimeoutJSON rejects legacy timeout keys in a JSON request object.
func RejectLegacyTimeoutJSON(data []byte) error {
	var probe map[string]interface{}
	if err := json.Unmarshal(data, &probe); err != nil {
		return err
	}
	return RejectLegacyTimeoutObject(probe)
}

type RequestMeta struct {
	Path string `json:"path"`
	Name string `json:"name"`
}

var allowedMethods = map[string]struct{}{
	"GET": {}, "POST": {}, "PUT": {}, "PATCH": {},
	"DELETE": {}, "HEAD": {}, "OPTIONS": {},
}

func normalizeMethod(m string) (string, error) {
	upper := strings.ToUpper(strings.TrimSpace(m))
	if _, ok := allowedMethods[upper]; !ok {
		return "", fmt.Errorf("invalid method %q", m)
	}
	return upper, nil
}

func (w *Workspace) fileFor(rel string) (string, error) {
	rel = strings.TrimSuffix(rel, ".yaml")
	rel = strings.TrimSuffix(rel, ".yml")
	cleaned, err := CleanRel(rel)
	if err != nil {
		return "", err
	}
	return filepath.Join(w.workdir, "collections", cleaned+".yaml"), nil
}

func (w *Workspace) PutRequest(rel string, req Request) error {
	method, err := normalizeMethod(req.Method)
	if err != nil {
		return err
	}
	req.Method = method
	req.Settings = CompactSettings(req.Settings)
	path, err := w.fileFor(rel)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := yaml.Marshal(&req)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func (w *Workspace) GetRequest(rel string) (Request, error) {
	path, err := w.fileFor(rel)
	if err != nil {
		return Request{}, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return Request{}, err
	}
	if err := rejectLegacyTimeoutYAML(data); err != nil {
		return Request{}, err
	}
	var req Request
	if err := yaml.Unmarshal(data, &req); err != nil {
		return Request{}, err
	}
	method, err := normalizeMethod(req.Method)
	if err != nil {
		return Request{}, err
	}
	req.Method = method
	if req.Query == nil {
		req.Query = map[string]string{}
	}
	if req.Headers == nil {
		req.Headers = map[string]string{}
	}
	return req, nil
}

func (w *Workspace) ListRequests() ([]RequestMeta, error) {
	root := filepath.Join(w.workdir, "collections")
	st, err := os.Stat(root)
	if err != nil {
		if os.IsNotExist(err) {
			return []RequestMeta{}, nil
		}
		return nil, err
	}
	if !st.IsDir() {
		return nil, fmt.Errorf("not a directory: %s", root)
	}
	var list []RequestMeta
	err = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		if !strings.HasSuffix(path, ".yaml") {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		rel = filepath.ToSlash(rel)
		rel = strings.TrimSuffix(rel, ".yaml")
		req, err := w.GetRequest(rel)
		if err != nil {
			return fmt.Errorf("%s: %w", rel, err)
		}
		list = append(list, RequestMeta{Path: rel, Name: req.Name})
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Slice(list, func(i, j int) bool { return list[i].Path < list[j].Path })
	return list, nil
}

func (w *Workspace) DeleteRequest(rel string) error {
	path, err := w.fileFor(rel)
	if err != nil {
		return err
	}
	return os.Remove(path)
}
