package server

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/zhangyw-cn/httptest/internal/executor"
	"github.com/zhangyw-cn/httptest/internal/workspace"
)

func (s *server) handleExecute(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID          string            `json:"id"`
		RequestPath string            `json:"requestPath"`
		Request     workspace.Request `json:"request"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if body.ID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing id"})
		return
	}

	vars, err := s.ws.ResolvedVars()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithCancel(r.Context())
	s.cancelsMu.Lock()
	s.cancels[body.ID] = cancel
	s.cancelsMu.Unlock()
	defer func() {
		s.cancelsMu.Lock()
		delete(s.cancels, body.ID)
		s.cancelsMu.Unlock()
		cancel()
	}()

	result := executor.Execute(ctx, body.Request, vars)

	raw, err := json.Marshal(result)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if err := s.ws.AppendHistory(workspace.HistoryEntry{
		ID:          body.ID,
		Time:        time.Now(),
		RequestPath: body.RequestPath,
		Request:     result.Prepared,
		Result:      raw,
	}); err != nil {
		result.HistoryError = err.Error()
	}

	writeJSON(w, http.StatusOK, result)
}

func (s *server) handleCancel(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	s.cancelsMu.Lock()
	cancel, ok := s.cancels[id]
	s.cancelsMu.Unlock()
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	cancel()
	writeJSON(w, http.StatusOK, map[string]string{"ok": "canceled"})
}

func (s *server) handleListHistory(w http.ResponseWriter, r *http.Request) {
	limit := 0
	if q := r.URL.Query().Get("limit"); q != "" {
		if n, err := strconv.Atoi(q); err == nil {
			limit = n
		}
	}
	entries, err := s.ws.ListHistory(limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if entries == nil {
		entries = []workspace.HistoryEntry{}
	}
	writeJSON(w, http.StatusOK, entries)
}

func (s *server) handleGetHistory(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	entry, err := s.ws.GetHistory(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, entry)
}
