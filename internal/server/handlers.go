package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
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
		"workdir":  s.ws.Workdir(),
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
		writeEnvErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, env)
}

func (s *server) handleDeleteEnvironment(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if err := s.ws.DeleteEnvironment(name); err != nil {
		writeEnvErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) handleRenameEnvironment(w http.ResponseWriter, r *http.Request) {
	oldName := r.PathValue("name")
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	env, err := s.ws.RenameEnvironment(oldName, body.Name)
	if err != nil {
		writeEnvErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, env)
}

func (s *server) handleListOverrides(w http.ResponseWriter, r *http.Request) {
	list, err := s.ws.ListOverrides()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if list == nil {
		list = []workspace.Override{}
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *server) handlePutOverride(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	var override workspace.Override
	if err := json.NewDecoder(r.Body).Decode(&override); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	override.Name = name
	saved, err := s.ws.PutOverride(override)
	if err != nil {
		writeOverrideErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *server) handleDeleteOverride(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if err := s.ws.DeleteOverride(name); err != nil {
		writeOverrideErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) handleRenameOverride(w http.ResponseWriter, r *http.Request) {
	oldName := r.PathValue("name")
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	override, err := s.ws.RenameOverride(oldName, body.Name)
	if err != nil {
		writeOverrideErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, override)
}

func (s *server) handleGetLocal(w http.ResponseWriter, r *http.Request) {
	local, err := s.ws.GetLocal()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, localJSON{
		Environment: local.Environment,
		Override:    local.Override,
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
		Override:    body.Override,
	}
	saved, err := s.ws.PutLocal(local)
	if err != nil {
		writePathErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, localJSON{
		Environment: saved.Environment,
		Override:    saved.Override,
	})
}

type localJSON struct {
	Environment string `json:"environment"`
	Override    string `json:"override"`
}

func writeEnvErr(w http.ResponseWriter, err error) {
	if errors.Is(err, workspace.ErrEnvExists) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
		return
	}
	if errors.Is(err, workspace.ErrSameEnvName) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writePathErr(w, err)
}

func writeOverrideErr(w http.ResponseWriter, err error) {
	if errors.Is(err, workspace.ErrOverrideExists) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
		return
	}
	if errors.Is(err, workspace.ErrSameOverrideName) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writePathErr(w, err)
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
	return strings.Contains(msg, "invalid path") ||
		strings.Contains(msg, "invalid environment name") ||
		strings.Contains(msg, "invalid override name")
}
