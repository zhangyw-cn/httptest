package workspace

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

var (
	ErrOverrideExists   = errors.New("override exists")
	ErrSameOverrideName = errors.New("same override name")
	ErrOverrideNotFound = errors.New("override not found")
)

type Override struct {
	Name      string            `json:"name" yaml:"name"`
	Variables map[string]string `json:"variables" yaml:"variables"`
}

func checkDir(path string) (bool, error) {
	st, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	if !st.IsDir() {
		return false, fmt.Errorf("not a directory: %s", path)
	}
	return true, nil
}

func (w *Workspace) overridePath(name string) (string, string, error) {
	cleaned, err := CleanRel(name)
	if err != nil {
		return "", "", err
	}
	if strings.Contains(cleaned, "/") {
		return "", "", fmt.Errorf("invalid override name %q", name)
	}
	return filepath.Join(w.localDir, "local", "overrides", cleaned+".yaml"), cleaned, nil
}

func (w *Workspace) PutOverride(o Override) error {
	path, cleaned, err := w.overridePath(o.Name)
	if err != nil {
		return err
	}
	o.Name = cleaned
	if o.Variables == nil {
		o.Variables = map[string]string{}
	}
	data, err := yaml.Marshal(&o)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	_ = os.Chmod(filepath.Dir(path), 0o700)
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return err
	}
	return os.Chmod(path, 0o600)
}

func (w *Workspace) ListOverrides() ([]Override, error) {
	root := filepath.Join(w.localDir, "local", "overrides")
	exists, err := checkDir(root)
	if err != nil {
		return nil, err
	}
	if !exists {
		return []Override{}, nil
	}
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, err
	}
	var list []Override
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".yaml") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(root, e.Name()))
		if err != nil {
			continue
		}
		var o Override
		if err := yaml.Unmarshal(data, &o); err != nil {
			continue
		}
		if o.Variables == nil {
			o.Variables = map[string]string{}
		}
		o.Name = strings.TrimSuffix(e.Name(), ".yaml")
		list = append(list, o)
	}
	sort.Slice(list, func(i, j int) bool { return list[i].Name < list[j].Name })
	return list, nil
}

func (w *Workspace) DeleteOverride(name string) error {
	path, cleaned, err := w.overridePath(name)
	if err != nil {
		return err
	}
	local, err := w.GetLocal()
	if err != nil {
		return err
	}
	st, err := os.Stat(path)
	if err != nil {
		return err
	}
	perm := st.Mode().Perm()
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if err := os.Remove(path); err != nil {
		return err
	}
	if local.Override != cleaned {
		return nil
	}
	if err := w.writeActive(local.Environment, ""); err != nil {
		return wrapRestore(err, os.WriteFile(path, data, perm))
	}
	return nil
}

func (w *Workspace) RenameOverride(oldName, newName string) (Override, error) {
	oldPath, oldClean, err := w.overridePath(oldName)
	if err != nil {
		return Override{}, err
	}
	newPath, newClean, err := w.overridePath(newName)
	if err != nil {
		return Override{}, err
	}
	if oldClean == newClean {
		return Override{}, ErrSameOverrideName
	}
	oldSt, err := os.Stat(oldPath)
	if err != nil {
		return Override{}, err
	}
	perm := oldSt.Mode().Perm()
	caseOnly := false
	if newSt, err := os.Stat(newPath); err == nil {
		if os.SameFile(oldSt, newSt) {
			caseOnly = true
		} else {
			return Override{}, ErrOverrideExists
		}
	} else if !os.IsNotExist(err) {
		return Override{}, err
	}
	data, err := os.ReadFile(oldPath)
	if err != nil {
		return Override{}, err
	}
	var o Override
	if err := yaml.Unmarshal(data, &o); err != nil {
		return Override{}, err
	}
	if o.Variables == nil {
		o.Variables = map[string]string{}
	}
	o.Name = newClean
	out, err := yaml.Marshal(&o)
	if err != nil {
		return Override{}, err
	}
	if err := os.MkdirAll(filepath.Dir(newPath), 0o700); err != nil {
		return Override{}, err
	}
	_ = os.Chmod(filepath.Dir(newPath), 0o700)
	writePath := newPath
	if caseOnly {
		writePath = newPath + ".renaming"
	}
	if err := os.WriteFile(writePath, out, 0o600); err != nil {
		return Override{}, err
	}
	if err := os.Chmod(writePath, 0o600); err != nil {
		_ = os.Remove(writePath)
		return Override{}, err
	}
	if err := os.Remove(oldPath); err != nil {
		_ = os.Remove(writePath)
		return Override{}, err
	}
	if caseOnly {
		if err := os.Rename(writePath, newPath); err != nil {
			_ = os.WriteFile(oldPath, data, perm)
			_ = os.Remove(writePath)
			return Override{}, err
		}
	}
	rollback := func() error {
		rerr := os.WriteFile(oldPath, data, perm)
		_ = os.Remove(newPath)
		if caseOnly {
			_ = os.Remove(writePath)
		}
		return rerr
	}
	local, err := w.GetLocal()
	if err != nil {
		return Override{}, wrapRestore(err, rollback())
	}
	if local.Override != oldClean {
		return o, nil
	}
	if err := w.writeActive(local.Environment, newClean); err != nil {
		return Override{}, wrapRestore(err, rollback())
	}
	return o, nil
}
