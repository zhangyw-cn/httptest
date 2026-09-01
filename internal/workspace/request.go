package workspace

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

type Request struct {
	Name    string            `json:"name" yaml:"name"`
	Method  string            `json:"method" yaml:"method"`
	URL     string            `json:"url" yaml:"url"`
	Query   map[string]string `json:"query" yaml:"query"`
	Headers map[string]string `json:"headers" yaml:"headers"`
	Body    Body              `json:"body" yaml:"body"`
	Timeout string            `json:"timeout,omitempty" yaml:"timeout,omitempty"`
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
	return filepath.Join(w.dir, "collections", cleaned+".yaml"), nil
}

func (w *Workspace) PutRequest(rel string, req Request) error {
	method, err := normalizeMethod(req.Method)
	if err != nil {
		return err
	}
	req.Method = method
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
	root := filepath.Join(w.dir, "collections")
	var list []RequestMeta
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
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
			return err
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
