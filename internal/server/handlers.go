package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/zhangyw-cn/httptest/internal/workspace"
)

func (s *server) handleGetWorkspace(w http.ResponseWriter, r *http.Request) {
	list, err := s.ws.ListRequests()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if list == nil {
		list = []workspace.RequestMeta{}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"cwd":      filepath.Dir(s.ws.Dir()),
		"requests": list,
	})
}

func (s *server) handleGetRequest(w http.ResponseWriter, r *http.Request) {
	path := r.PathValue("path")
	req, err := s.ws.GetRequest(path)
	if err != nil {
		writePathErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, req)
}

func (s *server) handlePutRequest(w http.ResponseWriter, r *http.Request) {
	path := r.PathValue("path")
	var req workspace.Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if err := s.ws.PutRequest(path, req); err != nil {
		writePathErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, req)
}

func (s *server) handleDeleteRequest(w http.ResponseWriter, r *http.Request) {
	path := r.PathValue("path")
	if err := s.ws.DeleteRequest(path); err != nil {
		writePathErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) handlePostRequest(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path    string            `json:"path"`
		Request workspace.Request `json:"request"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if err := s.ws.PutRequest(body.Path, body.Request); err != nil {
		writePathErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, body.Request)
}

func (s *server) handleListEnvironments(w http.ResponseWriter, r *http.Request) {
	list, err := s.ws.ListEnvironments()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if list == nil {
		list = []workspace.Environment{}
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *server) handlePutEnvironment(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	var env workspace.Environment
	if err := json.NewDecoder(r.Body).Decode(&env); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	env.Name = name
	if err := s.ws.PutEnvironment(env); err != nil {
		writePathErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, env)
}

func (s *server) handleGetLocal(w http.ResponseWriter, r *http.Request) {
	local, err := s.ws.GetLocal()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, localJSON{
		Environment: local.Environment,
		Secrets:     local.Secrets,
	})
}

func (s *server) handlePutLocal(w http.ResponseWriter, r *http.Request) {
	var body localJSON
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	local := workspace.Local{
		Environment: body.Environment,
		Secrets:     body.Secrets,
	}
	if err := s.ws.PutLocal(local); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, body)
}

type localJSON struct {
	Environment string            `json:"environment"`
	Secrets     map[string]string `json:"secrets"`
}

func writePathErr(w http.ResponseWriter, err error) {
	if isInvalidPath(err) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if os.IsNotExist(err) || errors.Is(err, os.ErrNotExist) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
}

func isInvalidPath(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "invalid path") || strings.Contains(msg, "invalid environment name")
}
