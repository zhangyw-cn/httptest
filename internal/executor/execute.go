package executor

import (
	"bytes"
	"context"
	"crypto/tls"
	"io"
	"net"
	"net/http"
	"net/http/httptrace"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/zhangyw-cn/httptest/internal/workspace"
)

const maxBodyBytes = 2 * 1024 * 1024

func Execute(ctx context.Context, req workspace.Request, vars map[string]string, hosts map[string]string) (res Result) {
	start := time.Now()
	var timings Timings
	defer func() {
		timings.TotalMs = elapsedMs(start, time.Now())
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
	if bodyReader != nil {
		bodyBytes, rerr := io.ReadAll(bodyReader)
		if rerr != nil {
			res.ErrorClass = ClassInvalid
			res.ErrorMessage = rerr.Error()
			return res
		}
		res.RequestSize = int64(len(bodyBytes))
		bodyReader = bytes.NewReader(bodyBytes)
	}

	httpReq, err := http.NewRequestWithContext(ctx, prepared.Method, prepared.URL, bodyReader)
	if err != nil {
		res.ErrorClass = ClassInvalid
		res.ErrorMessage = err.Error()
		return res
	}
	scheme := ""
	if httpReq.URL != nil {
		scheme = strings.ToLower(httpReq.URL.Scheme)
	}
	if scheme != "http" && scheme != "https" {
		res.ErrorClass = ClassInvalid
		if scheme == "" {
			res.ErrorMessage = "unsupported protocol scheme"
		} else {
			res.ErrorMessage = "unsupported protocol scheme " + scheme
		}
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
			timings.DNSMs = elapsedMs(dnsStart, time.Now())
		},
		ConnectStart: func(_, _ string) { connStart = time.Now() },
		ConnectDone: func(_, _ string, _ error) {
			timings.ConnectMs = elapsedMs(connStart, time.Now())
		},
		TLSHandshakeStart: func() { tlsStart = time.Now() },
		TLSHandshakeDone: func(_ tls.ConnectionState, _ error) {
			timings.TLSMs = elapsedMs(tlsStart, time.Now())
		},
		GotFirstResponseByte: func() {
			timings.FirstByteMs = elapsedMs(start, time.Now())
		},
	}
	httpReq = httpReq.WithContext(httptrace.WithClientTrace(httpReq.Context(), trace))

	dump, _ := httputil.DumpRequestOut(httpReq, true)
	res.RequestDump = string(dump)

	var redirects []RedirectHop
	redirectLimit := false
	var lastResolved string
	client := &http.Client{
		Transport: newExecuteTransport(hosts, &lastResolved),
		CheckRedirect: func(r *http.Request, via []*http.Request) error {
			if len(via) > 10 {
				redirectLimit = true
				return http.ErrUseLastResponse
			}
			hop := RedirectHop{}
			if r.Response != nil {
				hop.Status = r.Response.StatusCode
				hop.Location = r.Response.Header.Get("Location")
			}
			if len(via) > 0 && via[len(via)-1].URL != nil {
				hop.URL = via[len(via)-1].URL.String()
			}
			redirects = append(redirects, hop)
			return nil
		},
	}

	resp, err := client.Do(httpReq)
	res.Redirects = redirects
	res.ResolvedIP = lastResolved
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

	bodyBytes, readErr := io.ReadAll(io.LimitReader(resp.Body, int64(maxBodyBytes)+1))
	if len(bodyBytes) > maxBodyBytes {
		res.Truncated = true
		bodyBytes = bodyBytes[:maxBodyBytes]
		readErr = nil
	}
	res.ResponseSize = int64(len(bodyBytes))

	wireBody := bodyBytes
	decoded, decErr := decodeHTTPBody(resp.Header.Get("Content-Encoding"), wireBody)
	if decErr != nil {
		if readErr == nil {
			readErr = decErr
		}
		decoded = wireBody
	} else if len(decoded) > maxBodyBytes {
		res.Truncated = true
		decoded = decoded[:maxBodyBytes]
	}
	res.Body = string(decoded)

	resp.Body = io.NopCloser(bytes.NewReader(wireBody))
	respDump, _ := httputil.DumpResponse(resp, true)
	res.ResponseDump = string(respDump)

	res.Status = resp.StatusCode
	res.StatusText = resp.Status
	res.Headers = resp.Header
	res.ErrorClass = ClassHTTP
	if redirectLimit {
		res.ErrorMessage = "redirect limit reached (10)"
	}
	if readErr != nil {
		res.ErrorMessage = readErr.Error()
	}
	return res
}

func elapsedMs(start, end time.Time) float64 {
	if start.IsZero() || end.IsZero() || end.Before(start) {
		return 0
	}
	return float64(end.Sub(start)) / float64(time.Millisecond)
}

func newExecuteTransport(mappings map[string]string, lastResolved *string) *http.Transport {
	t := http.DefaultTransport.(*http.Transport).Clone()
	// Ignore HTTP_PROXY/HTTPS_PROXY so a company proxy cannot silently
	// intercept or block this local debugger. Documented in the design spec.
	t.Proxy = nil
	t.DisableKeepAlives = true
	t.DisableCompression = true
	if len(mappings) == 0 {
		return t
	}
	dialer := &net.Dialer{}
	t.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		addr, ip, hit := mapDialAddress(address, mappings)
		if hit {
			address = addr
			if lastResolved != nil {
				*lastResolved = ip
			}
		}
		return dialer.DialContext(ctx, network, address)
	}
	return t
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
