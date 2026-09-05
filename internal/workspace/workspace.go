package workspace

import (
	"os"
	"path/filepath"
)

const gitignoreBody = "*\n"

type Workspace struct {
	workdir  string
	localDir string
}

func (w *Workspace) Workdir() string  { return w.workdir }
func (w *Workspace) LocalDir() string { return w.localDir }

func Init(workdir string) (*Workspace, error) {
	abs, err := filepath.Abs(workdir)
	if err != nil {
		return nil, err
	}
	local := filepath.Join(abs, ".httptest")
	if err := os.MkdirAll(filepath.Join(local, "history"), 0o755); err != nil {
		return nil, err
	}
	sec := filepath.Join(local, "local")
	if err := os.MkdirAll(sec, 0o700); err != nil {
		return nil, err
	}
	if err := os.Chmod(sec, 0o700); err != nil {
		return nil, err
	}
	gi := filepath.Join(local, ".gitignore")
	if _, err := os.Stat(gi); err != nil {
		if err := os.WriteFile(gi, []byte(gitignoreBody), 0o644); err != nil {
			return nil, err
		}
	}
	return &Workspace{workdir: abs, localDir: local}, nil
}
