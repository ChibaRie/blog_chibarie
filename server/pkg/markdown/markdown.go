package markdown

import (
	"bytes"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
)

var engine = goldmark.New(
	goldmark.WithExtensions(extension.GFM),
	goldmark.WithParserOptions(
		parser.WithAutoHeadingID(),
	),
)

func Render(source string) (string, error) {
	var buf bytes.Buffer
	if err := engine.Convert([]byte(source), &buf); err != nil {
		return "", err
	}
	return buf.String(), nil
}
