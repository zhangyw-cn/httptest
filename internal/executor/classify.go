package executor

import (
	"context"
	"errors"
	"fmt"
	"net"
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
	var op *net.OpError
	if errors.As(err, &op) {
		return ClassConnect
	}
	return ClassConnect
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
