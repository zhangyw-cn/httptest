package executor

import (
	"bytes"
	"context"
	"crypto/tls"
	"io"
	"net/http"
	"net/http/httptrace"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"httptest/internal/workspace"
)

const maxBodyBytes = 2 * 1024 * 1024

func Execute(ctx context.Context, req workspace.Request, vars map[string]string) (res Result) {
	start := time.Now()
	var timings Timings
	defer func() {
		timings.TotalMs = time.Since(start).Milliseconds()
		res.Timings = timings
	}()

	prepared, missing, err := Prepare(req, vars)
	res.Prepared = prepared
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

	var dnsStart, connStart, tlsStart time.Time
	trace := &httptrace.ClientTrace{
		DNSStart: func(httptrace.DNSStartInfo) { dnsStart = time.Now() },
		DNSDone: func(httptrace.DNSDoneInfo) {
			if !dnsStart.IsZero() {
				timings.DNSMs = time.Since(dnsStart).Milliseconds()
			}
		},
		ConnectStart: func(_, _ string) { connStart = time.Now() },
		ConnectDone: func(_, _ string, _ error) {
			if !connStart.IsZero() {
				timings.ConnectMs = time.Since(connStart).Milliseconds()
			}
		},
		TLSHandshakeStart: func() { tlsStart = time.Now() },
		TLSHandshakeDone: func(_ tls.ConnectionState, _ error) {
			if !tlsStart.IsZero() {
				timings.TLSMs = time.Since(tlsStart).Milliseconds()
			}
		},
		GotFirstResponseByte: func() {
			timings.FirstByteMs = time.Since(start).Milliseconds()
		},
	}
	httpReq = httpReq.WithContext(httptrace.WithClientTrace(httpReq.Context(), trace))

	dump, _ := httputil.DumpRequestOut(httpReq, true)
	res.RequestDump = string(dump)
	res.RequestSize = int64(len(dump))

	var redirects []RedirectHop
	client := &http.Client{
		CheckRedirect: func(r *http.Request, via []*http.Request) error {
			hop := RedirectHop{}
			if r.Response != nil {
				hop.Status = r.Response.StatusCode
				hop.Location = r.Response.Header.Get("Location")
			}
			if len(via) > 0 && via[len(via)-1].URL != nil {
				hop.URL = via[len(via)-1].URL.String()
			}
			redirects = append(redirects, hop)
			if len(via) >= 10 {
				return http.ErrUseLastResponse
			}
			return nil
		},
	}

	resp, err := client.Do(httpReq)
	res.Redirects = redirects
	if err != nil {
		res.ErrorClass = classify(err)
		res.ErrorMessage = err.Error()
		if ctx.Err() == context.Canceled {
			res.ErrorClass = ClassCanceled
		}
		if res.ErrorClass == "" {
			res.ErrorClass = ClassHTTP
		}
		return res
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, int64(maxBodyBytes)+1))
	if len(bodyBytes) > maxBodyBytes {
		res.Truncated = true
		bodyBytes = bodyBytes[:maxBodyBytes]
	}
	res.Body = string(bodyBytes)
	res.ResponseSize = int64(len(bodyBytes))

	resp.Body = io.NopCloser(bytes.NewReader(bodyBytes))
	respDump, _ := httputil.DumpResponse(resp, true)
	res.ResponseDump = string(respDump)

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
