package server

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/zhangyw-cn/httptest/internal/executor"
	"github.com/zhangyw-cn/httptest/internal/workspace"
)

func (s *server) handlePrepare(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Request json.RawMessage `json:"request"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	var req workspace.Request
	if err := decodeWorkspaceRequest(body.Request, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	vars, err := s.ws.ResolvedVars()
	if err != nil {
		if errors.Is(err, workspace.ErrOverrideNotFound) {
			writeJSON(w, http.StatusOK, executor.PrepareResult{
				ErrorClass:   executor.ClassInvalid,
				ErrorMessage: err.Error(),
				Prepared:     req,
			})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	mappings, err := s.ws.ActiveHostsMappings()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, executor.BuildPrepareResult(req, vars, mappings))
}
