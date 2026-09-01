package executor

import (
	"regexp"
	"sort"
)

var varPattern = regexp.MustCompile(`\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}`)

func Substitute(s string, vars map[string]string) (out string, missing []string) {
	seen := map[string]struct{}{}
	out = varPattern.ReplaceAllStringFunc(s, func(match string) string {
		name := varPattern.FindStringSubmatch(match)[1]
		if v, ok := vars[name]; ok {
			return v
		}
		seen[name] = struct{}{}
		return match
	})
	for name := range seen {
		missing = append(missing, name)
	}
	sort.Strings(missing)
	return out, missing
}
