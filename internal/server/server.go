package server

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"strings"

	"httptest/internal/workspace"
)

// New registers workspace CRUD routes. When ui is nil, "/" is not mounted.
func New(ws *workspace.Workspace, ui fs.FS) http.Handler {
	s := &server{ws: ws}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/workspace", s.handleGetWorkspace)
	mux.HandleFunc("GET /api/requests/{path...}", s.handleGetRequest)
	mux.HandleFunc("PUT /api/requests/{path...}", s.handlePutRequest)
	mux.HandleFunc("DELETE /api/requests/{path...}", s.handleDeleteRequest)
	mux.HandleFunc("POST /api/requests", s.handlePostRequest)
	mux.HandleFunc("GET /api/environments", s.handleListEnvironments)
	mux.HandleFunc("PUT /api/environments/{name}", s.handlePutEnvironment)
	mux.HandleFunc("GET /api/local", s.handleGetLocal)
	mux.HandleFunc("PUT /api/local", s.handlePutLocal)
	if ui != nil {
		mux.Handle("/", http.FileServer(http.FS(ui)))
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "..") {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid path"})
			return
		}
		mux.ServeHTTP(w, r)
	})
}

type server struct {
	ws *workspace.Workspace
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
