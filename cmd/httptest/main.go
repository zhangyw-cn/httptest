package main

import (
	"flag"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"

	"github.com/zhangyw-cn/httptest/internal/server"
	"github.com/zhangyw-cn/httptest/internal/workspace"
)

const defaultListen = "127.0.0.1:1370"

func main() {
	os.Exit(run(os.Args[1:]))
}

func newFlagSet() (*flag.FlagSet, *string, *bool) {
	fsFlag := flag.NewFlagSet("httptest", flag.ContinueOnError)
	listen := fsFlag.String("listen", defaultListen, "listen address")
	open := fsFlag.Bool("open", false, "open browser")
	return fsFlag, listen, open
}

func run(args []string) int {
	opt, err := parseArgs(args)
	if err != nil {
		return 2
	}

	host, port, err := server.ParseListen(opt.listen)
	if err != nil {
		fmt.Fprintf(os.Stderr, "invalid --listen: %v\n", err)
		return 2
	}

	if w := server.WarnPublicListen(host); w != "" {
		fmt.Fprintln(os.Stderr, w)
	}

	workdir, code, err := resolveWorkdir(opt.workdir)
	if err != nil {
		if opt.workdir == "" {
			fmt.Fprintf(os.Stderr, "getcwd: %v\n", err)
		} else {
			fmt.Fprintf(os.Stderr, "workdir: %v\n", err)
		}
		return code
	}
	ws, err := workspace.Init(workdir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "workspace init: %v\n", err)
		return 1
	}

	ui, err := fs.Sub(server.UI, "ui")
	if err != nil {
		fmt.Fprintf(os.Stderr, "ui embed: %v\n", err)
		return 1
	}

	addr := server.ListenAddr(host, port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "listen: %v\n", err)
		return 1
	}

	url := server.LocalURL(port)
	fmt.Println(url)
	if opt.open {
		_ = server.OpenBrowser(url)
	}

	if err := http.Serve(ln, server.New(ws, ui)); err != nil {
		fmt.Fprintf(os.Stderr, "listen: %v\n", err)
		return 1
	}
	return 0
}
