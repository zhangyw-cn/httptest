package workspace

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"
)

func TestHistoryAppendListGet(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t0 := time.Date(2026, 9, 1, 12, 0, 0, 0, time.Local)
	t1 := t0.Add(time.Minute)
	a := HistoryEntry{ID: "id-a", Time: t0, Request: Request{Name: "A", Method: "GET", URL: "http://a"}, Result: json.RawMessage(`{"status":200}`)}
	b := HistoryEntry{ID: "id-b", Time: t1, Request: Request{Name: "B", Method: "GET", URL: "http://b"}, Result: json.RawMessage(`{"status":404}`)}
	if err := ws.AppendHistory(a); err != nil {
		t.Fatal(err)
	}
	if err := ws.AppendHistory(b); err != nil {
		t.Fatal(err)
	}
	list, err := ws.ListHistory(50)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 || list[0].ID != "id-b" || list[1].ID != "id-a" {
		t.Fatalf("%+v", list)
	}
	got, err := ws.GetHistory("id-a")
	if err != nil {
		t.Fatal(err)
	}
	if got.Request.Name != "A" {
		t.Fatalf("%+v", got)
	}
}

func TestHistoryLargeResultRoundTrip(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	body := strings.Repeat("x", 70*1024)
	result, err := json.Marshal(map[string]string{"body": body})
	if err != nil {
		t.Fatal(err)
	}
	if len(result) <= 64*1024 {
		t.Fatalf("result size %d, want > 64KiB", len(result))
	}
	t0 := time.Date(2026, 9, 1, 12, 0, 0, 0, time.Local)
	e := HistoryEntry{
		ID: "large-id", Time: t0,
		Request: Request{Name: "Large", Method: "GET", URL: "http://large"},
		Result: result,
	}
	if err := ws.AppendHistory(e); err != nil {
		t.Fatal(err)
	}
	list, err := ws.ListHistory(50)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 {
		t.Fatalf("list len=%d, want 1", len(list))
	}
	if string(list[0].Result) != string(result) {
		t.Fatal("list result mismatch")
	}
	got, err := ws.GetHistory("large-id")
	if err != nil {
		t.Fatal(err)
	}
	if string(got.Result) != string(result) {
		t.Fatal("get result mismatch")
	}
}

func TestListHistorySkipsCorruptLines(t *testing.T) {
	ws, err := Init(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t0 := time.Date(2026, 9, 2, 8, 0, 0, 0, time.Local)
	good := HistoryEntry{
		ID: "good-id", Time: t0,
		Request: Request{Name: "Good", Method: "GET", URL: "http://good"},
		Result:  json.RawMessage(`{"status":200}`),
	}
	if err := ws.AppendHistory(good); err != nil {
		t.Fatal(err)
	}
	path := historyFileFor(ws, t0)
	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.WriteString("this is not json\n"); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	list, err := ws.ListHistory(50)
	if err != nil {
		t.Fatalf("ListHistory should skip corrupt lines: %v", err)
	}
	if len(list) != 1 || list[0].ID != "good-id" {
		t.Fatalf("want only valid entry, got %+v", list)
	}
}
