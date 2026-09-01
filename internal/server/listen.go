package server

import (
	"fmt"
	"net"
	"os/exec"
	"runtime"
)

// ParseListen splits a listen address into host and port.
// Invalid forms (no host/port separator, empty port) return an error.
func ParseListen(s string) (host, port string, err error) {
	host, port, err = net.SplitHostPort(s)
	if err != nil {
		return "", "", err
	}
	if port == "" {
		return "", "", fmt.Errorf("empty port")
	}
	return host, port, nil
}

// WarnPublicListen returns a non-empty warning when binding publicly
// (0.0.0.0 or ::), reminding that httptest acts as an HTTP 代理.
func WarnPublicListen(host string) string {
	switch host {
	case "", "0.0.0.0", "::":
		return "警告: 正在监听所有网络接口，httptest 将作为 HTTP 代理对外暴露，请确认网络安全。"
	default:
		return ""
	}
}

// OpenBrowser best-effort opens url in the default browser.
func OpenBrowser(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "linux":
		cmd = exec.Command("xdg-open", url)
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("cmd.exe", "/c", "start", url)
	default:
		return fmt.Errorf("unsupported platform %s", runtime.GOOS)
	}
	return cmd.Start()
}

// LocalURL returns the loopback URL for the given port (for stdout).
func LocalURL(port string) string {
	return "http://127.0.0.1:" + port
}

// ListenAddr joins host and port for ListenAndServe.
func ListenAddr(host, port string) string {
	return net.JoinHostPort(host, port)
}
