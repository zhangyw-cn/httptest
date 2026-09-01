package executor

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
