package workspace

import (
	"os"
	"path/filepath"
)

const gitignoreBody = "local/\nhistory/\n"

type Workspace struct {
	dir string
}

func (w *Workspace) Dir() string { return w.dir }

func Init(cwd string) (*Workspace, error) {
	abs, err := filepath.Abs(cwd)
	if err != nil {
		return nil, err
	}
	root := filepath.Join(abs, ".httptest")
	for _, sub := range []string{"collections", "environments", "history"} {
		if err := os.MkdirAll(filepath.Join(root, sub), 0o755); err != nil {
			return nil, err
		}
	}
	localDir := filepath.Join(root, "local")
	if err := os.MkdirAll(localDir, 0o700); err != nil {
		return nil, err
	}
	if err := os.Chmod(localDir, 0o700); err != nil {
		return nil, err
	}
	gi := filepath.Join(root, ".gitignore")
	if _, err := os.Stat(gi); err != nil {
		if err := os.WriteFile(gi, []byte(gitignoreBody), 0o644); err != nil {
			return nil, err
		}
	}
	return &Workspace{dir: root}, nil
}
