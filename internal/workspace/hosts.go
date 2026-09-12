package workspace

import (
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

var (
	ErrHostsExists         = errors.New("hosts exists")
	ErrSameHostsName       = errors.New("same hosts name")
	ErrInvalidHostsMapping = errors.New("invalid hosts mapping")
)

type HostsFile struct {
	Name     string            `json:"name" yaml:"name"`
	Mappings map[string]string `json:"mappings" yaml:"mappings"`
}

func (w *Workspace) hostsPath(name string) (string, string, error) {
	cleaned, err := CleanRel(name)
	if err != nil {
		return "", "", err
	}
	if strings.Contains(cleaned, "/") {
		return "", "", fmt.Errorf("invalid hosts name %q", name)
	}
	return filepath.Join(w.workdir, "hosts", cleaned+".yaml"), cleaned, nil
}

func normalizeAndValidateMappings(in map[string]string) (map[string]string, error) {
	out := map[string]string{}
	if in == nil {
		return out, nil
	}
	for host, ip := range in {
		h := strings.ToLower(strings.TrimSpace(host))
		ip = strings.TrimSpace(ip)
		if h == "" || ip == "" {
			return nil, fmt.Errorf("%w: empty host or ip", ErrInvalidHostsMapping)
		}
		if strings.Contains(h, "://") || strings.ContainsAny(h, "/:") {
			return nil, fmt.Errorf("%w: bad host %q", ErrInvalidHostsMapping, host)
		}
		if net.ParseIP(ip) == nil {
			return nil, fmt.Errorf("%w: bad ip %q", ErrInvalidHostsMapping, ip)
		}
		if _, dup := out[h]; dup {
			return nil, fmt.Errorf("%w: duplicate host %q", ErrInvalidHostsMapping, h)
		}
		out[h] = ip
	}
	return out, nil
}

func (w *Workspace) PutHosts(h HostsFile) (HostsFile, error) {
	path, cleaned, err := w.hostsPath(h.Name)
	if err != nil {
		return HostsFile{}, err
	}
	mappings, err := normalizeAndValidateMappings(h.Mappings)
	if err != nil {
		return HostsFile{}, err
	}
	h.Name = cleaned
	h.Mappings = mappings
	data, err := yaml.Marshal(&h)
	if err != nil {
		return HostsFile{}, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return HostsFile{}, err
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return HostsFile{}, err
	}
	return h, nil
}

func (w *Workspace) ListHosts() ([]HostsFile, error) {
	root := filepath.Join(w.workdir, "hosts")
	exists, err := checkDir(root)
	if err != nil {
		return nil, err
	}
	if !exists {
		return []HostsFile{}, nil
	}
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, err
	}
	var list []HostsFile
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".yaml") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(root, e.Name()))
		if err != nil {
			continue
		}
		var h HostsFile
		if err := yaml.Unmarshal(data, &h); err != nil {
			continue
		}
		if h.Mappings == nil {
			h.Mappings = map[string]string{}
		}
		if norm, err := normalizeAndValidateMappings(h.Mappings); err == nil {
			h.Mappings = norm
		}
		h.Name = strings.TrimSuffix(e.Name(), ".yaml")
		list = append(list, h)
	}
	sort.Slice(list, func(i, j int) bool { return list[i].Name < list[j].Name })
	return list, nil
}

func (w *Workspace) ActiveHostsMappings() (map[string]string, error) {
	local, err := w.GetLocal()
	if err != nil {
		return nil, err
	}
	if local.Hosts == "" {
		return nil, nil
	}
	path, _, err := w.hostsPath(local.Hosts)
	if err != nil {
		return nil, nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var h HostsFile
	if err := yaml.Unmarshal(data, &h); err != nil {
		// Corrupt YAML: degrade like a missing file so execute is not blocked.
		return nil, nil
	}
	mappings, err := normalizeAndValidateMappings(h.Mappings)
	if err != nil {
		// Invalid mappings on disk: degrade to system DNS (same as missing).
		return nil, nil
	}
	return mappings, nil
}

func (w *Workspace) DeleteHosts(name string) error {
	path, cleaned, err := w.hostsPath(name)
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
	if local.Hosts != cleaned {
		return nil
	}
	if err := w.writeActive(local.Environment, local.Override, ""); err != nil {
		return wrapRestore(err, os.WriteFile(path, data, perm))
	}
	return nil
}

func (w *Workspace) RenameHosts(oldName, newName string) (HostsFile, error) {
	oldPath, oldClean, err := w.hostsPath(oldName)
	if err != nil {
		return HostsFile{}, err
	}
	newPath, newClean, err := w.hostsPath(newName)
	if err != nil {
		return HostsFile{}, err
	}
	if oldClean == newClean {
		return HostsFile{}, ErrSameHostsName
	}
	oldSt, err := os.Stat(oldPath)
	if err != nil {
		return HostsFile{}, err
	}
	perm := oldSt.Mode().Perm()
	caseOnly := false
	if newSt, err := os.Stat(newPath); err == nil {
		if os.SameFile(oldSt, newSt) {
			caseOnly = true
		} else {
			return HostsFile{}, ErrHostsExists
		}
	} else if !os.IsNotExist(err) {
		return HostsFile{}, err
	}
	data, err := os.ReadFile(oldPath)
	if err != nil {
		return HostsFile{}, err
	}
	var h HostsFile
	if err := yaml.Unmarshal(data, &h); err != nil {
		return HostsFile{}, err
	}
	if h.Mappings == nil {
		h.Mappings = map[string]string{}
	}
	h.Name = newClean
	out, err := rewriteNameYAML(data, newClean)
	if err != nil {
		return HostsFile{}, err
	}
	if err := os.MkdirAll(filepath.Dir(newPath), 0o755); err != nil {
		return HostsFile{}, err
	}
	writePath := newPath
	if caseOnly {
		writePath = newPath + ".renaming"
	}
	if err := os.WriteFile(writePath, out, perm); err != nil {
		return HostsFile{}, err
	}
	if err := os.Remove(oldPath); err != nil {
		_ = os.Remove(writePath)
		return HostsFile{}, err
	}
	if caseOnly {
		if err := os.Rename(writePath, newPath); err != nil {
			_ = os.WriteFile(oldPath, data, perm)
			_ = os.Remove(writePath)
			return HostsFile{}, err
		}
	}
	rollback := func() error {
		rerr := os.WriteFile(oldPath, data, perm)
		if !caseOnly {
			_ = os.Remove(newPath)
		} else {
			_ = os.Remove(writePath)
		}
		return rerr
	}
	local, err := w.GetLocal()
	if err != nil {
		return HostsFile{}, wrapRestore(err, rollback())
	}
	if local.Hosts != oldClean {
		return h, nil
	}
	if err := w.writeActive(local.Environment, local.Override, newClean); err != nil {
		return HostsFile{}, wrapRestore(err, rollback())
	}
	return h, nil
}
