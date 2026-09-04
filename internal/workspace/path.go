package workspace

import (
	"fmt"
	"path"
	"strings"
)

func isDriveAbsPath(rel string) bool {
	if len(rel) < 2 || rel[1] != ':' {
		return false
	}
	c := rel[0]
	if (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') {
		if len(rel) == 2 {
			return true
		}
		return rel[2] == '/' || rel[2] == '\\'
	}
	return false
}

func CleanRel(rel string) (string, error) {
	rel = strings.TrimSpace(rel)
	rel = strings.ReplaceAll(rel, "\\", "/")
	if rel == "" || strings.HasPrefix(rel, "/") || isDriveAbsPath(rel) {
		return "", fmt.Errorf("invalid path %q", rel)
	}
	cleaned := path.Clean(rel)
	if cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, "../") || path.IsAbs(cleaned) {
		return "", fmt.Errorf("invalid path %q", rel)
	}
	for _, seg := range strings.Split(cleaned, "/") {
		if seg == ".." {
			return "", fmt.Errorf("invalid path %q", rel)
		}
	}
	return cleaned, nil
}
