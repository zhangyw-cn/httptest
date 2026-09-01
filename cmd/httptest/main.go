package main

import (
	"flag"
	"fmt"
	"io/fs"
	"net/http"
	"os"

	"httptest/internal/server"
	"httptest/internal/workspace"
)

func main() {
	os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
	fsFlag := flag.NewFlagSet("httptest", flag.ContinueOnError)
	listen := fsFlag.String("listen", "127.0.0.1:1370", "listen address")
	open := fsFlag.Bool("open", false, "open browser")
	if err := fsFlag.Parse(args); err != nil {
		return 2
	}

	host, port, err := server.ParseListen(*listen)
	if err != nil {
		fmt.Fprintf(os.Stderr, "invalid --listen: %v\n", err)
		return 2
	}

	url := server.LocalURL(port)
	fmt.Println(url)

	if w := server.WarnPublicListen(host); w != "" {
		fmt.Fprintln(os.Stderr, w)
	}

	ws, err := workspace.Init(".")
	if err != nil {
		fmt.Fprintf(os.Stderr, "workspace init: %v\n", err)
		return 1
	}

	ui, err := fs.Sub(server.UI, "ui")
	if err != nil {
		fmt.Fprintf(os.Stderr, "ui embed: %v\n", err)
		return 1
	}

	if *open {
		_ = server.OpenBrowser(url)
	}

	addr := server.ListenAddr(host, port)
	if err := http.ListenAndServe(addr, server.New(ws, ui)); err != nil {
		fmt.Fprintf(os.Stderr, "listen: %v\n", err)
		return 1
	}
	return 0
}
