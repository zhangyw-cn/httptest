package workspace

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type HistoryEntry struct {
	ID          string          `json:"id"`
	Time        time.Time       `json:"time"`
	RequestPath string          `json:"requestPath,omitempty"`
	Request     Request         `json:"request"`
	Result      json.RawMessage `json:"result"`
}

func historyFileFor(w *Workspace, t time.Time) string {
	name := t.In(time.Local).Format("2006-01-02") + ".jsonl"
	return filepath.Join(w.dir, "history", name)
}

func (w *Workspace) AppendHistory(e HistoryEntry) error {
	path := historyFileFor(w, e.Time)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	defer f.Close()
	data, err := json.Marshal(e)
	if err != nil {
		return err
	}
	if _, err := f.Write(append(data, '\n')); err != nil {
		return err
	}
	return nil
}

func normalizeHistoryLimit(limit int) int {
	if limit <= 0 {
		return 50
	}
	if limit > 200 {
		return 200
	}
	return limit
}

func (w *Workspace) ListHistory(limit int) ([]HistoryEntry, error) {
	limit = normalizeHistoryLimit(limit)
	dir := filepath.Join(w.dir, "history")
	files, err := historyFilesNewestFirst(dir)
	if err != nil {
		return nil, err
	}
	var entries []HistoryEntry
	for _, name := range files {
		fileEntries, err := readHistoryFile(filepath.Join(dir, name))
		if err != nil {
			return nil, err
		}
		entries = append(entries, fileEntries...)
		if len(entries) >= limit {
			break
		}
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Time.After(entries[j].Time)
	})
	if len(entries) > limit {
		entries = entries[:limit]
	}
	return entries, nil
}

func (w *Workspace) GetHistory(id string) (HistoryEntry, error) {
	dir := filepath.Join(w.dir, "history")
	entries, err := w.readHistoryDir(dir)
	if err != nil {
		return HistoryEntry{}, err
	}
	for _, e := range entries {
		if e.ID == id {
			return e, nil
		}
	}
	return HistoryEntry{}, fmt.Errorf("history entry %q not found", id)
}

func (w *Workspace) readHistoryDir(dir string) ([]HistoryEntry, error) {
	files, err := historyFilesNewestFirst(dir)
	if err != nil {
		return nil, err
	}
	var entries []HistoryEntry
	for _, name := range files {
		fileEntries, err := readHistoryFile(filepath.Join(dir, name))
		if err != nil {
			return nil, err
		}
		entries = append(entries, fileEntries...)
	}
	return entries, nil
}

func historyFilesNewestFirst(dir string) ([]string, error) {
	names, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	var files []string
	for _, n := range names {
		if n.IsDir() || !strings.HasSuffix(n.Name(), ".jsonl") {
			continue
		}
		files = append(files, n.Name())
	}
	sort.Slice(files, func(i, j int) bool {
		return files[i] > files[j]
	})
	return files, nil
}

func readHistoryFile(path string) ([]HistoryEntry, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var entries []HistoryEntry
	r := bufio.NewReader(f)
	for {
		line, err := r.ReadBytes('\n')
		if len(line) > 0 {
			line = bytes.TrimSpace(line)
			if len(line) > 0 {
				var e HistoryEntry
				if uerr := json.Unmarshal(line, &e); uerr == nil {
					entries = append(entries, e)
				}
			}
		}
		if err != nil {
			if err == io.EOF {
				break
			}
			return nil, err
		}
	}
	return entries, nil
}
