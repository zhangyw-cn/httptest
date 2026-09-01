package workspace

import (
	"encoding/json"
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
