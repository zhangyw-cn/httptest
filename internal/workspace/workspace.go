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
	root := filepath.Join(cwd, ".httptest")
	for _, sub := range []string{"collections", "environments", "local", "history"} {
		if err := os.MkdirAll(filepath.Join(root, sub), 0o755); err != nil {
			return nil, err
		}
	}
	gi := filepath.Join(root, ".gitignore")
	if _, err := os.Stat(gi); err != nil {
		if err := os.WriteFile(gi, []byte(gitignoreBody), 0o644); err != nil {
			return nil, err
		}
	}
	return &Workspace{dir: root}, nil
}
