package server

import (
	"context"
	"encoding/json"
	"io/fs"
	"net/http"
	"strings"
	"sync"

	"github.com/zhangyw-cn/httptest/internal/workspace"
)

// New registers workspace CRUD routes. When ui is nil, "/" is not mounted.
func New(ws *workspace.Workspace, ui fs.FS) http.Handler {
	s := &server{ws: ws, cancels: make(map[string]context.CancelFunc)}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/execute", s.handleExecute)
	mux.HandleFunc("POST /api/execute/{id}/cancel", s.handleCancel)
	mux.HandleFunc("GET /api/history", s.handleListHistory)
	mux.HandleFunc("GET /api/history/{id}", s.handleGetHistory)
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
		if pathHasDotDotSegment(r.URL.Path) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid path"})
			return
		}
		if !guardAPI(w, r) {
			return
		}
		mux.ServeHTTP(w, r)
	})
}

func pathHasDotDotSegment(p string) bool {
	for _, seg := range strings.Split(p, "/") {
		if seg == ".." {
			return true
		}
	}
	return false
}

type server struct {
	ws        *workspace.Workspace
	cancelsMu sync.Mutex
	cancels   map[string]context.CancelFunc
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
