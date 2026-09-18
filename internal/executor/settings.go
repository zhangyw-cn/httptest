package executor

import (
	"fmt"

	"github.com/zhangyw-cn/httptest/internal/workspace"
)

type Effective struct {
	TimeoutMs          int64
	FollowRedirects    bool
	MaxRedirects       int
	InsecureSkipVerify bool
}

func EffectiveSettings(s workspace.RequestSettings) (Effective, error) {
	e := Effective{
		TimeoutMs: 30000, FollowRedirects: true, MaxRedirects: 10,
	}
	if s.TimeoutMs != nil {
		if *s.TimeoutMs <= 0 {
			return Effective{}, fmt.Errorf("timeoutMs must be positive")
		}
		e.TimeoutMs = *s.TimeoutMs
	}
	if s.FollowRedirects != nil {
		e.FollowRedirects = *s.FollowRedirects
	}
	if s.MaxRedirects != nil {
		e.MaxRedirects = *s.MaxRedirects
	}
	if s.InsecureSkipVerify != nil {
		e.InsecureSkipVerify = *s.InsecureSkipVerify
	}
	if e.FollowRedirects && (e.MaxRedirects < 1 || e.MaxRedirects > 50) {
		return Effective{}, fmt.Errorf("maxRedirects must be between 1 and 50")
	}
	return e, nil
}
