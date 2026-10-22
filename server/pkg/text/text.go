package text

import (
	"regexp"
	"strings"
	"unicode"
)

var (
	reImage      = regexp.MustCompile(`!\[[^\]]*\]\([^)]*\)`)
	reLink       = regexp.MustCompile(`\[([^\]]*)\]\([^)]*\)`)
	reBoldStar   = regexp.MustCompile(`\*\*([^*]+)\*\*`)
	reBoldUnder  = regexp.MustCompile(`__([^_]+)__`)
	reItalicStar = regexp.MustCompile(`\*([^*]+)\*`)
	reCode       = regexp.MustCompile("`([^`]+)`")
	reStrike     = regexp.MustCompile(`~~([^~]+)~~`)
	reListMark   = regexp.MustCompile(`^[-*+]\s+`)
	reOrderMark  = regexp.MustCompile(`^\d+\.\s+`)
)

func CountWords(source string) int {
	total := 0
	inLatinWord := false

	for _, r := range source {
		switch {
		case unicode.Is(unicode.Han, r):
			total++
			inLatinWord = false
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			if !inLatinWord {
				total++
				inLatinWord = true
			}
		default:
			inLatinWord = false
		}
	}
	return total
}

func ReadingTime(wordCount int) int {
	if wordCount <= 0 {
		return 0
	}
	minutes := (wordCount + 399) / 400
	if minutes < 1 {
		minutes = 1
	}
	return minutes
}

// StripInline 去掉行内的 Markdown 标记，只保留可读文字。
func StripInline(source string) string {
	out := reImage.ReplaceAllString(source, "")
	out = reLink.ReplaceAllString(out, "$1")
	out = reBoldStar.ReplaceAllString(out, "$1")
	out = reBoldUnder.ReplaceAllString(out, "$1")
	out = reItalicStar.ReplaceAllString(out, "$1")
	out = reCode.ReplaceAllString(out, "$1")
	out = reStrike.ReplaceAllString(out, "$1")
	out = reListMark.ReplaceAllString(out, "")
	out = reOrderMark.ReplaceAllString(out, "")
	return strings.TrimSpace(out)
}

// Summary 从 Markdown 正文中提取一段纯文本摘要。
func Summary(content string, limit int) string {
	cleaned := strings.ReplaceAll(strings.TrimSpace(content), "\r\n", "\n")

	var plain strings.Builder
	for _, line := range strings.Split(cleaned, "\n") {
		trimmed := strings.TrimSpace(line)

		if trimmed == "" ||
			strings.HasPrefix(trimmed, "#") ||
			strings.HasPrefix(trimmed, "```") ||
			strings.HasPrefix(trimmed, "~~~") ||
			strings.HasPrefix(trimmed, "|") ||
			strings.HasPrefix(trimmed, "![") {
			continue
		}

		trimmed = strings.TrimPrefix(trimmed, "> ")
		trimmed = StripInline(trimmed)
		if trimmed == "" {
			continue
		}

		plain.WriteString(trimmed)
		plain.WriteString(" ")

		if plain.Len() >= limit*2 {
			break
		}
	}

	runes := []rune(strings.TrimSpace(plain.String()))
	if len(runes) <= limit {
		return string(runes)
	}
	return string(runes[:limit]) + "…"
}

func Slugify(source string) string {
	lowered := strings.ToLower(strings.TrimSpace(source))

	var b strings.Builder
	prevDash := false

	for _, r := range lowered {
		switch {
		case (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9'):
			b.WriteRune(r)
			prevDash = false
		case unicode.Is(unicode.Han, r):
			b.WriteRune(r)
			prevDash = false
		case r == '-' || r == '_' || r == ' ' || r == '.':
			if !prevDash && b.Len() > 0 {
				b.WriteByte('-')
				prevDash = true
			}
		}
	}

	return strings.Trim(b.String(), "-")
}

func Slug(input, fallback string) string {
	if s := Slugify(input); s != "" {
		return s
	}
	return Slugify(fallback)
}
