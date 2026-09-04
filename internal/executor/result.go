package executor

import "github.com/zhangyw-cn/httptest/internal/workspace"

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
	DNSMs       float64 `json:"dnsMs"`
	ConnectMs   float64 `json:"connectMs"`
	TLSMs       float64 `json:"tlsMs"`
	FirstByteMs float64 `json:"firstByteMs"`
	TotalMs     float64 `json:"totalMs"`
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
	HistoryError string              `json:"historyError,omitempty"`
	MissingVars  []string            `json:"missingVars,omitempty"`
	Prepared     workspace.Request   `json:"prepared"`
}
