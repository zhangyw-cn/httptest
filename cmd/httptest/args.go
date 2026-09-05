package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type cliOptions struct {
	listen  string
	open    bool
	workdir string
}

func flagTakesArg(arg string) bool {
	if strings.Contains(arg, "=") {
		return false
	}
	name := strings.TrimLeft(arg, "-")
	return name == "listen"
}

func splitCLIArgs(args []string) (flagArgs, pos []string) {
	for i := 0; i < len(args); i++ {
		a := args[i]
		if a == "--" {
			pos = append(pos, args[i+1:]...)
			break
		}
		if len(a) > 1 && a[0] == '-' && a != "-" {
			flagArgs = append(flagArgs, a)
			if flagTakesArg(a) && i+1 < len(args) && !strings.HasPrefix(args[i+1], "-") {
				flagArgs = append(flagArgs, args[i+1])
				i++
			}
			continue
		}
		pos = append(pos, a)
	}
	return flagArgs, pos
}

func parseArgs(args []string) (cliOptions, error) {
	flagArgs, pos := splitCLIArgs(args)
	fs, listen, open := newFlagSet()
	if err := fs.Parse(flagArgs); err != nil {
		return cliOptions{}, err
	}
	if len(pos) > 1 {
		return cliOptions{}, fmt.Errorf("unexpected extra arguments")
	}
	opt := cliOptions{listen: *listen, open: *open}
	if len(pos) == 1 {
		opt.workdir = pos[0]
	}
	return opt, nil
}

func resolveWorkdir(dir string) (string, int, error) {
	if dir == "" {
		wd, err := os.Getwd()
		if err != nil {
			return "", 1, err
		}
		return wd, 0, nil
	}
	abs, err := filepath.Abs(dir)
	if err != nil {
		if !filepath.IsAbs(dir) {
			return "", 1, err
		}
		return "", 2, err
	}
	st, err := os.Stat(abs)
	if err != nil {
		return "", 2, err
	}
	if !st.IsDir() {
		return "", 2, fmt.Errorf("not a directory: %s", abs)
	}
	return abs, 0, nil
}
