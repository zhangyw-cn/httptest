package executor

import (
	"bytes"
	"compress/flate"
	"compress/gzip"
	"io"
	"strings"
)

func decodeHTTPBody(encoding string, raw []byte) ([]byte, error) {
	enc := strings.ToLower(strings.TrimSpace(encoding))
	if i := strings.IndexByte(enc, ','); i >= 0 {
		enc = strings.TrimSpace(enc[:i])
	}
	switch enc {
	case "", "identity":
		return raw, nil
	case "gzip", "x-gzip":
		zr, err := gzip.NewReader(bytes.NewReader(raw))
		if err != nil {
			return nil, err
		}
		defer zr.Close()
		return io.ReadAll(io.LimitReader(zr, int64(maxBodyBytes)+1))
	case "deflate":
		fr := flate.NewReader(bytes.NewReader(raw))
		defer fr.Close()
		return io.ReadAll(io.LimitReader(fr, int64(maxBodyBytes)+1))
	default:
		return raw, nil
	}
}
