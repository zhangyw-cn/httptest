package executor

import (
	"fmt"
	"sort"
	"strings"

	"github.com/zhangyw-cn/httptest/internal/workspace"
)

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

func mergeMissing(dst map[string]struct{}, missing []string) {
	for _, name := range missing {
		dst[name] = struct{}{}
	}
}

func sortedKeys(m map[string]struct{}) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func Prepare(req workspace.Request, vars map[string]string) (workspace.Request, []string, error) {
	method, err := normalizeMethod(req.Method)
	if err != nil {
		return workspace.Request{}, nil, err
	}

	out := workspace.Request{
		Name:    req.Name,
		Method:  method,
		Timeout: req.Timeout,
		Body: workspace.Body{
			Type: req.Body.Type,
		},
		Query:   map[string]string{},
		Headers: map[string]string{},
	}

	missingSet := map[string]struct{}{}

	var miss []string
	out.URL, miss = Substitute(req.URL, vars)
	mergeMissing(missingSet, miss)

	for k, v := range req.Query {
		sv, miss := Substitute(v, vars)
		mergeMissing(missingSet, miss)
		out.Query[k] = sv
	}
	for k, v := range req.Headers {
		sv, miss := Substitute(v, vars)
		mergeMissing(missingSet, miss)
		out.Headers[k] = sv
	}

	out.Body.Text, miss = Substitute(req.Body.Text, vars)
	mergeMissing(missingSet, miss)

	if req.Body.Form != nil {
		out.Body.Form = map[string]string{}
		for k, v := range req.Body.Form {
			sv, miss := Substitute(v, vars)
			mergeMissing(missingSet, miss)
			out.Body.Form[k] = sv
		}
	}

	return out, sortedKeys(missingSet), nil
}
