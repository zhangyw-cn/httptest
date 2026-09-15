package workspace

import (
	"fmt"
	"net"
	"strings"
)

// ParseHostsContent parses classic hosts text into hostname→IP (aliases expanded).
func ParseHostsContent(content string) (map[string]string, error) {
	out := map[string]string{}
	for _, raw := range strings.Split(content, "\n") {
		line := raw
		if i := strings.IndexByte(line, '#'); i >= 0 {
			line = line[:i]
		}
		fields := strings.Fields(line)
		if len(fields) == 0 {
			continue
		}
		if len(fields) < 2 {
			return nil, fmt.Errorf("%w: need IP and hostname", ErrInvalidHostsMapping)
		}
		ip := fields[0]
		if net.ParseIP(ip) == nil {
			return nil, fmt.Errorf("%w: bad ip %q", ErrInvalidHostsMapping, ip)
		}
		for _, name := range fields[1:] {
			h := strings.ToLower(strings.TrimSpace(name))
			if h == "" {
				return nil, fmt.Errorf("%w: empty host", ErrInvalidHostsMapping)
			}
			if strings.Contains(h, "://") || strings.ContainsAny(h, "/:") {
				return nil, fmt.Errorf("%w: bad host %q", ErrInvalidHostsMapping, name)
			}
			if _, dup := out[h]; dup {
				return nil, fmt.Errorf("%w: duplicate host %q", ErrInvalidHostsMapping, h)
			}
			out[h] = ip
		}
	}
	return out, nil
}
