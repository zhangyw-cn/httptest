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
	ErrEnvExists   = errors.New("environment exists")
	ErrSameEnvName = errors.New("same environment name")
)

type Environment struct {
	Name      string            `json:"name" yaml:"name"`
	Variables map[string]string `json:"variables" yaml:"variables"`
}

type Local struct {
	Environment string            `json:"environment"`
	Secrets     map[string]string `json:"secrets"`
}

type secretsFile struct {
	Variables map[string]string `yaml:"variables"`
}

type activeFile struct {
	Environment string `yaml:"environment"`
}

func (w *Workspace) envPath(name string) (string, string, error) {
	cleaned, err := CleanRel(name)
	if err != nil {
		return "", "", err
	}
	if strings.Contains(cleaned, "/") {
		return "", "", fmt.Errorf("invalid environment name %q", name)
	}
	return filepath.Join(w.workdir, "environments", cleaned+".yaml"), cleaned, nil
}

func (w *Workspace) PutEnvironment(env Environment) error {
	path, cleaned, err := w.envPath(env.Name)
	if err != nil {
		return err
	}
	env.Name = cleaned
	if env.Variables == nil {
		env.Variables = map[string]string{}
	}
	data, err := yaml.Marshal(&env)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func (w *Workspace) ListEnvironments() ([]Environment, error) {
	root := filepath.Join(w.workdir, "environments")
	entries, err := os.ReadDir(root)
	if err != nil {
		if os.IsNotExist(err) {
			return []Environment{}, nil
		}
		return nil, err
	}
	var list []Environment
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".yaml") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(root, e.Name()))
		if err != nil {
			continue
		}
		var env Environment
		if err := yaml.Unmarshal(data, &env); err != nil {
			continue
		}
		if env.Variables == nil {
			env.Variables = map[string]string{}
		}
		env.Name = strings.TrimSuffix(e.Name(), ".yaml")
		list = append(list, env)
	}
	sort.Slice(list, func(i, j int) bool { return list[i].Name < list[j].Name })
	return list, nil
}

func (w *Workspace) PutLocal(local Local) error {
	localDir := filepath.Join(w.localDir, "local")
	if err := os.MkdirAll(localDir, 0o700); err != nil {
		return err
	}
	_ = os.Chmod(localDir, 0o700)
	secrets := secretsFile{Variables: local.Secrets}
	if secrets.Variables == nil {
		secrets.Variables = map[string]string{}
	}
	sdata, err := yaml.Marshal(&secrets)
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(localDir, "secrets.yaml"), sdata, 0o600); err != nil {
		return err
	}
	_ = os.Chmod(filepath.Join(localDir, "secrets.yaml"), 0o600)
	return w.writeActive(local.Environment)
}

func (w *Workspace) writeActive(environment string) error {
	localDir := filepath.Join(w.localDir, "local")
	if err := os.MkdirAll(localDir, 0o700); err != nil {
		return err
	}
	_ = os.Chmod(localDir, 0o700)
	adata, err := yaml.Marshal(&activeFile{Environment: environment})
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(localDir, "active.yaml"), adata, 0o644)
}

func (w *Workspace) DeleteEnvironment(name string) error {
	path, cleaned, err := w.envPath(name)
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
	if local.Environment != cleaned {
		return nil
	}
	if err := w.writeActive(""); err != nil {
		return wrapRestore(err, os.WriteFile(path, data, perm))
	}
	return nil
}

func (w *Workspace) RenameEnvironment(oldName, newName string) (Environment, error) {
	oldPath, oldClean, err := w.envPath(oldName)
	if err != nil {
		return Environment{}, err
	}
	newPath, newClean, err := w.envPath(newName)
	if err != nil {
		return Environment{}, err
	}
	if oldClean == newClean {
		return Environment{}, ErrSameEnvName
	}
	oldSt, err := os.Stat(oldPath)
	if err != nil {
		return Environment{}, err
	}
	perm := oldSt.Mode().Perm()
	caseOnly := false
	if newSt, err := os.Stat(newPath); err == nil {
		if os.SameFile(oldSt, newSt) {
			caseOnly = true
		} else {
			return Environment{}, ErrEnvExists
		}
	} else if !os.IsNotExist(err) {
		return Environment{}, err
	}
	data, err := os.ReadFile(oldPath)
	if err != nil {
		return Environment{}, err
	}
	var env Environment
	if err := yaml.Unmarshal(data, &env); err != nil {
		return Environment{}, err
	}
	if env.Variables == nil {
		env.Variables = map[string]string{}
	}
	env.Name = newClean
	out, err := rewriteEnvNameYAML(data, newClean)
	if err != nil {
		return Environment{}, err
	}
	if err := os.MkdirAll(filepath.Dir(newPath), 0o755); err != nil {
		return Environment{}, err
	}
	writePath := newPath
	if caseOnly {
		writePath = newPath + ".renaming"
	}
	if err := os.WriteFile(writePath, out, perm); err != nil {
		return Environment{}, err
	}
	if err := os.Remove(oldPath); err != nil {
		_ = os.Remove(writePath)
		return Environment{}, err
	}
	if caseOnly {
		if err := os.Rename(writePath, newPath); err != nil {
			_ = os.WriteFile(oldPath, data, perm)
			_ = os.Remove(writePath)
			return Environment{}, err
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
		return Environment{}, wrapRestore(err, rollback())
	}
	if local.Environment != oldClean {
		return env, nil
	}
	if err := w.writeActive(newClean); err != nil {
		return Environment{}, wrapRestore(err, rollback())
	}
	return env, nil
}

func (w *Workspace) GetLocal() (Local, error) {
	out := Local{
		Secrets: map[string]string{},
	}
	sdata, err := os.ReadFile(filepath.Join(w.localDir, "local", "secrets.yaml"))
	if err == nil {
		var secrets secretsFile
		if err := yaml.Unmarshal(sdata, &secrets); err != nil {
			return Local{}, err
		}
		if secrets.Variables != nil {
			out.Secrets = secrets.Variables
		}
	} else if !os.IsNotExist(err) {
		return Local{}, err
	}
	adata, err := os.ReadFile(filepath.Join(w.localDir, "local", "active.yaml"))
	if err == nil {
		var active activeFile
		if err := yaml.Unmarshal(adata, &active); err != nil {
			return Local{}, err
		}
		out.Environment = active.Environment
	} else if !os.IsNotExist(err) {
		return Local{}, err
	}
	return out, nil
}

func (w *Workspace) ResolvedVars() (map[string]string, error) {
	local, err := w.GetLocal()
	if err != nil {
		return nil, err
	}
	vars := map[string]string{}
	if local.Environment != "" {
		path, _, err := w.envPath(local.Environment)
		if err == nil {
			data, err := os.ReadFile(path)
			if err == nil {
				var env Environment
				if err := yaml.Unmarshal(data, &env); err != nil {
					return nil, err
				}
				for k, v := range env.Variables {
					vars[k] = v
				}
			} else if !os.IsNotExist(err) {
				return nil, err
			}
		}
	}
	for k, v := range local.Secrets {
		vars[k] = v
	}
	return vars, nil
}
