package executor

import (
	"testing"

	"github.com/zhangyw-cn/httptest/internal/workspace"
)

func TestEffectiveSettingsDefaults(t *testing.T) {
	e, err := EffectiveSettings(workspace.RequestSettings{})
	if err != nil {
		t.Fatal(err)
	}
	if e.TimeoutMs != 30000 || !e.FollowRedirects || e.MaxRedirects != 10 || e.InsecureSkipVerify {
		t.Fatalf("%+v", e)
	}
}

func TestEffectiveSettingsRejectsBadTimeoutAndMax(t *testing.T) {
	zero := int64(0)
	if _, err := EffectiveSettings(workspace.RequestSettings{TimeoutMs: &zero}); err == nil {
		t.Fatal("expected error")
	}
	follow := true
	bad := 0
	if _, err := EffectiveSettings(workspace.RequestSettings{FollowRedirects: &follow, MaxRedirects: &bad}); err == nil {
		t.Fatal("expected error")
	}
}
