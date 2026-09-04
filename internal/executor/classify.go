package executor

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/url"
	"strings"
)

// classify maps transport errors to ErrorClass.
func classify(err error) ErrorClass {
	if err == nil {
		return ""
	}
	if errors.Is(err, context.Canceled) {
		return ClassCanceled
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return ClassTimeout
	}
	var ne net.Error
	if errors.As(err, &ne) && ne.Timeout() {
		return ClassTimeout
	}
	var de *net.DNSError
	if errors.As(err, &de) {
		return ClassDNS
	}
	if isTLSError(err) {
		return ClassTLS
	}
	if isUnsupportedScheme(err) {
		return ClassInvalid
	}
	var op *net.OpError
	if errors.As(err, &op) {
		return ClassConnect
	}
	return ClassConnect
}

func isUnsupportedScheme(err error) bool {
	var ue *url.Error
	if errors.As(err, &ue) && ue.Err != nil {
		if strings.Contains(strings.ToLower(ue.Err.Error()), "unsupported protocol scheme") {
			return true
		}
	}
	return strings.Contains(strings.ToLower(err.Error()), "unsupported protocol scheme")
}

func isTLSError(err error) bool {
	for e := err; e != nil; e = errors.Unwrap(e) {
		if matchTLS(e.Error(), fmt.Sprintf("%T", e)) {
			return true
		}
	}
	return matchTLS(err.Error(), "")
}

func matchTLS(msg, typeName string) bool {
	m := strings.ToLower(msg)
	if strings.Contains(m, "tls") || strings.Contains(m, "x509") || strings.Contains(m, "certificate") {
		return true
	}
	// https:// to a plain HTTP server: Go reports this instead of a handshake error.
	if strings.Contains(m, "https client") {
		return true
	}
	tn := strings.ToLower(typeName)
	return strings.Contains(tn, "tls") || strings.Contains(tn, "x509") || strings.Contains(tn, "certificate")
}
