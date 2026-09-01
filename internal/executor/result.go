package executor

import "httptest/internal/workspace"

type ErrorClass string

const (
	ClassInvalid  ErrorClass = "invalid"
	ClassCanceled ErrorClass = "canceled"
	ClassTimeout  ErrorClass = "timeout"
	ClassDNS      ErrorClass = "dns"
	ClassConnect  ErrorClass = "connect"
	ClassTLS      ErrorClass = "tls"
	ClassHTTP     ErrorClass = "http"
)

type RedirectHop struct {
	Status   int    `json:"status"`
	URL      string `json:"url"`
	Location string `json:"location"`
}

type Timings struct {
	DNSMs       int64 `json:"dnsMs"`
	ConnectMs   int64 `json:"connectMs"`
	TLSMs       int64 `json:"tlsMs"`
	FirstByteMs int64 `json:"firstByteMs"`
	TotalMs     int64 `json:"totalMs"`
}

type Result struct {
	Status       int                 `json:"status"`
	StatusText   string              `json:"statusText"`
	Headers      map[string][]string `json:"headers"`
	Body         string              `json:"body"`
	Truncated    bool                `json:"truncated"`
	RequestDump  string              `json:"requestDump"`
	ResponseDump string              `json:"responseDump"`
	RequestSize  int64               `json:"requestSize"`
	ResponseSize int64               `json:"responseSize"`
	Redirects    []RedirectHop       `json:"redirects"`
	Timings      Timings             `json:"timings"`
	ErrorClass   ErrorClass          `json:"errorClass"`
	ErrorMessage string              `json:"errorMessage"`
	MissingVars  []string            `json:"missingVars,omitempty"`
	Prepared     workspace.Request   `json:"prepared"`
}
