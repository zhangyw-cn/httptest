package executor

import (
	"net"
	"strings"
)

// lookupHostMapping returns the mapped IP for a hostname (exact, lowercased).
// IP literals never match. Shared by Dial and LookupResolve.
func lookupHostMapping(host string, mappings map[string]string) (string, bool) {
	if len(mappings) == 0 || host == "" {
		return "", false
	}
	if net.ParseIP(host) != nil {
		return "", false
	}
	ip, ok := mappings[strings.ToLower(host)]
	return ip, ok
}

func mapDialAddress(address string, mappings map[string]string) (string, string, bool) {
	if len(mappings) == 0 {
		return address, "", false
	}
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return address, "", false
	}
	ip, ok := lookupHostMapping(host, mappings)
	if !ok {
		return address, "", false
	}
	return net.JoinHostPort(ip, port), ip, true
}
