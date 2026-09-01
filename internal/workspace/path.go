package workspace

import (
	"fmt"
	"path"
	"strings"
)

func isDriveAbsPath(rel string) bool {
	return len(rel) >= 2 && rel[1] == ':'
}

func CleanRel(rel string) (string, error) {
	rel = strings.TrimSpace(rel)
	rel = strings.ReplaceAll(rel, "\\", "/")
	if rel == "" || strings.HasPrefix(rel, "/") || strings.Contains(rel, "..") || isDriveAbsPath(rel) {
		return "", fmt.Errorf("invalid path %q", rel)
	}
	cleaned := path.Clean(rel)
	if cleaned == "." || strings.HasPrefix(cleaned, "../") || path.IsAbs(cleaned) {
		return "", fmt.Errorf("invalid path %q", rel)
	}
	return cleaned, nil
}
