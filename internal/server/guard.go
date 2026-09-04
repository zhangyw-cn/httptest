package server

import (
	"mime"
	"net"
	"net/http"
	"net/url"
	"strings"
)

func guardAPI(w http.ResponseWriter, r *http.Request) bool {
	path := r.URL.Path
	if path != "/api" && !strings.HasPrefix(path, "/api/") {
		return true
	}
	if !allowedAPIHost(r.Host) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden host"})
		return false
	}
	if origin := r.Header.Get("Origin"); origin != "" {
		u, err := url.Parse(origin)
		if err != nil || !strings.EqualFold(u.Host, r.Host) || (u.Scheme != "http" && u.Scheme != "https") {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden origin"})
			return false
		}
	}
	switch r.Method {
	case http.MethodPost, http.MethodPut, http.MethodPatch:
		media, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil || media != "application/json" {
			writeJSON(w, http.StatusUnsupportedMediaType, map[string]string{"error": "Content-Type must be application/json"})
			return false
		}
	}
	return true
}

// allowedAPIHost accepts localhost and literal IPs (with optional port).
// Domain names are rejected so DNS rebinding cannot read /api.
func allowedAPIHost(host string) bool {
	if host == "" {
		return false
	}
	h := host
	if th, _, err := net.SplitHostPort(host); err == nil {
		h = th
	}
	h = strings.Trim(h, "[]")
	if strings.EqualFold(h, "localhost") {
		return true
	}
	return net.ParseIP(h) != nil
}
