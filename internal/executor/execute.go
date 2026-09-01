package executor

import (
	"context"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"httptest/internal/workspace"
)

func Execute(ctx context.Context, req workspace.Request, vars map[string]string) Result {
	prepared, missing, err := Prepare(req, vars)
	res := Result{Prepared: prepared}
	if err != nil {
		res.ErrorClass = ClassInvalid
		res.ErrorMessage = err.Error()
		return res
	}
	if len(missing) > 0 {
		res.ErrorClass = ClassInvalid
		res.MissingVars = missing
		return res
	}

	timeout := 30 * time.Second
	if prepared.Timeout != "" {
		if d, perr := time.ParseDuration(prepared.Timeout); perr == nil {
			timeout = d
		} else {
			res.ErrorClass = ClassInvalid
			res.ErrorMessage = perr.Error()
			return res
		}
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	bodyReader, contentType, herr := buildBody(prepared)
	if herr != nil {
		res.ErrorClass = ClassInvalid
		res.ErrorMessage = herr.Error()
		return res
	}

	httpReq, err := http.NewRequestWithContext(ctx, prepared.Method, prepared.URL, bodyReader)
	if err != nil {
		res.ErrorClass = ClassInvalid
		res.ErrorMessage = err.Error()
		return res
	}

	if len(prepared.Query) > 0 {
		q := httpReq.URL.Query()
		for k, v := range prepared.Query {
			q.Set(k, v)
		}
		httpReq.URL.RawQuery = q.Encode()
	}

	hasCT := false
	hasUA := false
	for k, v := range prepared.Headers {
		httpReq.Header.Set(k, v)
		lk := strings.ToLower(k)
		if lk == "content-type" {
			hasCT = true
		}
		if lk == "user-agent" {
			hasUA = true
		}
	}
	if !hasCT && contentType != "" {
		httpReq.Header.Set("Content-Type", contentType)
	}
	if !hasUA {
		httpReq.Header.Set("User-Agent", "httptest/0.1")
	}

	dump, _ := httputil.DumpRequestOut(httpReq, true)
	res.RequestDump = string(dump)
	res.RequestSize = int64(len(dump))

	client := &http.Client{
		CheckRedirect: func(_ *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return http.ErrUseLastResponse
			}
			return nil
		},
	}

	resp, err := client.Do(httpReq)
	if err != nil {
		res.ErrorClass = classify(err)
		res.ErrorMessage = err.Error()
		if res.ErrorClass == "" {
			res.ErrorClass = ClassHTTP
		}
		return res
	}
	defer resp.Body.Close()

	respDump, _ := httputil.DumpResponse(resp, true)
	res.ResponseDump = string(respDump)

	bodyBytes, _ := io.ReadAll(resp.Body)
	res.Body = string(bodyBytes)
	res.ResponseSize = int64(len(bodyBytes))
	res.Status = resp.StatusCode
	res.StatusText = resp.Status
	res.Headers = resp.Header
	res.ErrorClass = ClassHTTP
	return res
}

func buildBody(req workspace.Request) (io.Reader, string, error) {
	method := req.Method
	if method == http.MethodGet || method == http.MethodHead {
		return nil, "", nil
	}
	switch req.Body.Type {
	case workspace.BodyJSON:
		return strings.NewReader(req.Body.Text), "application/json", nil
	case workspace.BodyRaw:
		return strings.NewReader(req.Body.Text), "", nil
	case workspace.BodyForm:
		vals := url.Values{}
		for k, v := range req.Body.Form {
			vals.Set(k, v)
		}
		return strings.NewReader(vals.Encode()), "application/x-www-form-urlencoded", nil
	case workspace.BodyNone, "":
		return nil, "", nil
	default:
		return nil, "", nil
	}
}
