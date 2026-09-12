package executor

import (
	"net"
	"strings"
)

func mapDialAddress(address string, mappings map[string]string) (string, string, bool) {
	if len(mappings) == 0 {
		return address, "", false
	}
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return address, "", false
	}
	if net.ParseIP(host) != nil {
		return address, "", false
	}
	key := strings.ToLower(host)
	ip, ok := mappings[key]
	if !ok {
		return address, "", false
	}
	return net.JoinHostPort(ip, port), ip, true
}
