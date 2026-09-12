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
		return nil, err
	}
	return normalizeAndValidateMappings(h.Mappings)
}
