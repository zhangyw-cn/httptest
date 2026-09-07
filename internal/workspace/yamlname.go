package workspace

import (
	"fmt"

	"gopkg.in/yaml.v3"
)

func wrapRestore(err, restoreErr error) error {
	if restoreErr == nil {
		return err
	}
	return fmt.Errorf("%w (restore: %v)", err, restoreErr)
}

func rewriteNameYAML(data []byte, newName string) ([]byte, error) {
	var doc yaml.Node
	if err := yaml.Unmarshal(data, &doc); err != nil {
		return nil, err
	}
	if !setOrAddMapString(&doc, "name", newName) {
		return nil, fmt.Errorf("invalid yaml: missing name")
	}
	return yaml.Marshal(&doc)
}

// rewriteEnvNameYAML keeps the historical name used by environment rename tests.
func rewriteEnvNameYAML(data []byte, newName string) ([]byte, error) {
	return rewriteNameYAML(data, newName)
}

func setOrAddMapString(n *yaml.Node, key, value string) bool {
	if n == nil {
		return false
	}
	if n.Kind == yaml.DocumentNode {
		if len(n.Content) == 0 {
			return false
		}
		return setOrAddMapString(n.Content[0], key, value)
	}
	if n.Kind != yaml.MappingNode {
		return false
	}
	for i := 0; i+1 < len(n.Content); i += 2 {
		if n.Content[i].Value == key {
			n.Content[i+1].Kind = yaml.ScalarNode
			n.Content[i+1].Tag = "!!str"
			n.Content[i+1].Value = value
			return true
		}
	}
	n.Content = append(n.Content,
		&yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: key},
		&yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: value},
	)
	return true
}
