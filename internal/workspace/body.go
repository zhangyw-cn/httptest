package workspace

import (
	"encoding/json"
	"fmt"

	"gopkg.in/yaml.v3"
)

type BodyType string

const (
	BodyNone BodyType = "none"
	BodyJSON BodyType = "json"
	BodyRaw  BodyType = "raw"
	BodyForm BodyType = "form"
)

type Body struct {
	Type BodyType          `json:"type" yaml:"type"`
	Text string            `json:"-" yaml:"-"`
	Form map[string]string `json:"-" yaml:"-"`
}

type bodyWire struct {
	Type    BodyType    `json:"type" yaml:"type"`
	Content interface{} `json:"content,omitempty" yaml:"content,omitempty"`
}

func (b Body) toWire() (bodyWire, error) {
	w := bodyWire{Type: b.Type}
	switch b.Type {
	case BodyNone, "":
		w.Type = BodyNone
	case BodyJSON, BodyRaw:
		w.Content = b.Text
	case BodyForm:
		if b.Form == nil {
			w.Content = map[string]string{}
		} else {
			w.Content = b.Form
		}
	default:
		return bodyWire{}, fmt.Errorf("invalid body type %q", b.Type)
	}
	return w, nil
}

func (b *Body) fromWire(w bodyWire) error {
	b.Type = w.Type
	b.Text = ""
	b.Form = nil
	switch w.Type {
	case BodyNone, "":
		b.Type = BodyNone
		return nil
	case BodyJSON, BodyRaw:
		if w.Content == nil {
			return nil
		}
		s, ok := w.Content.(string)
		if !ok {
			return fmt.Errorf("body content must be string for type %q", w.Type)
		}
		b.Text = s
		return nil
	case BodyForm:
		b.Form = map[string]string{}
		if w.Content == nil {
			return nil
		}
		switch m := w.Content.(type) {
		case map[string]string:
			for k, v := range m {
				b.Form[k] = v
			}
		case map[string]interface{}:
			for k, v := range m {
				s, ok := v.(string)
				if !ok {
					return fmt.Errorf("form value for %q must be string", k)
				}
				b.Form[k] = s
			}
		default:
			return fmt.Errorf("body content must be map for type form")
		}
		return nil
	default:
		return fmt.Errorf("invalid body type %q", w.Type)
	}
}

func (b Body) MarshalYAML() (interface{}, error) {
	return b.toWire()
}

func (b *Body) UnmarshalYAML(value *yaml.Node) error {
	var w bodyWire
	if err := value.Decode(&w); err != nil {
		return err
	}
	return b.fromWire(w)
}

func (b Body) MarshalJSON() ([]byte, error) {
	w, err := b.toWire()
	if err != nil {
		return nil, err
	}
	return json.Marshal(w)
}

func (b *Body) UnmarshalJSON(data []byte) error {
	var w bodyWire
	if err := json.Unmarshal(data, &w); err != nil {
		return err
	}
	return b.fromWire(w)
}
