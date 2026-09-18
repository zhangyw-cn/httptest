package server

import (
	"encoding/json"

	"github.com/zhangyw-cn/httptest/internal/workspace"
)

func decodeWorkspaceRequest(data []byte, dest *workspace.Request) error {
	if err := workspace.RejectLegacyTimeoutJSON(data); err != nil {
		return err
	}
	return json.Unmarshal(data, dest)
}
