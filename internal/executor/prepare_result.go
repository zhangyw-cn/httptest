package executor

import (
	"net"
	"net/url"
	"strings"
	"time"

	"github.com/zhangyw-cn/httptest/internal/workspace"
)

type ResolveSpec struct {
	Host string `json:"host"`
	Port string `json:"port"`
	IP   string `json:"ip"`
}

type PrepareResult struct {
	Prepared       workspace.Request `json:"prepared"`
	Resolve        *ResolveSpec      `json:"resolve,omitempty"`
	TimeoutSeconds float64           `json:"timeoutSeconds,omitempty"`
	ErrorClass     ErrorClass        `json:"errorClass"`
	ErrorMessage   string            `json:"errorMessage"`
	MissingVars    []string          `json:"missingVars,omitempty"`
}

func EffectiveTimeoutSeconds(timeout string) (float64, error) {
	if strings.TrimSpace(timeout) == "" {
		return 30, nil
	}
	d, err := time.ParseDuration(timeout)
	if err != nil {
		return 0, err
	}
	return d.Seconds(), nil
}

func LookupResolve(rawURL string, mappings map[string]string) *ResolveSpec {
	if len(mappings) == 0 {
		return nil
	}
	u, err := url.Parse(rawURL)
	if err != nil || u.Hostname() == "" {
		return nil
	}
	host := u.Hostname()
	if net.ParseIP(host) != nil {
		return nil
	}
	key := strings.ToLower(host)
	ip, ok := mappings[key]
	if !ok {
		return nil
	}
	port := u.Port()
	if port == "" {
		if u.Scheme == "https" {
			port = "443"
		} else {
			port = "80"
		}
	}
	return &ResolveSpec{Host: key, Port: port, IP: ip}
}

func BuildPrepareResult(req workspace.Request, vars, mappings map[string]string) PrepareResult {
	prepared, missing, err := Prepare(req, vars)
	out := PrepareResult{Prepared: prepared}
	if err != nil {
		out.ErrorClass = ClassInvalid
		out.ErrorMessage = err.Error()
		return out
	}
	if len(missing) > 0 {
		out.ErrorClass = ClassInvalid
		out.MissingVars = missing
		return out
	}
	sec, terr := EffectiveTimeoutSeconds(prepared.Timeout)
	if terr != nil {
		out.ErrorClass = ClassInvalid
		out.ErrorMessage = terr.Error()
		return out
	}
	out.TimeoutSeconds = sec
	out.Resolve = LookupResolve(prepared.URL, mappings)
	return out
}
