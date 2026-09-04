package server

import (
	"bytes"
	"net/http"
	"net/http/httptest"
)

func apiReq(method, path string, body []byte) *http.Request {
	var r *http.Request
	if body != nil {
		r = httptest.NewRequest(method, path, bytes.NewReader(body))
	} else {
		r = httptest.NewRequest(method, path, nil)
	}
	r.Host = "127.0.0.1:1370"
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch:
		r.Header.Set("Content-Type", "application/json")
	}
	return r
}
