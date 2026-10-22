package model

import (
	"encoding/json"
	"strings"
	"time"
)

// Note 说说：短文本时间流，用于日常随记。
// 与 Post 的区别是刻意做出来的——没有标题、没有 slug、没有分类标签，
// 正文就是纯文本（前台直接按纯文本渲染，不走 Markdown），
// 保留「随手一写」的轻量感，不让人纠结排版。
type Note struct {
	ID      uint   `gorm:"primaryKey" json:"id"`
	Content string `gorm:"type:text;not null" json:"content"`
	// Images 存 JSON 数组字符串（如 ["/uploads/2026/09/a.jpg"]）。
	// 用序列化列而不是独立的图片表：说说图片永远整体读写、不会单独查询，
	// 建成关联表只会让增删改多出几次事务，收益为零。
	Images string `gorm:"type:text" json:"-"`

	Likes int64 `json:"likes"`

	// Status 复用 PostStatus（draft / published），后台可以先写后发
	Status      PostStatus `gorm:"size:16;index" json:"status"`
	PublishedAt *time.Time `json:"publishedAt"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`

	// CommentCount 评论数，与 Post 一样是查询时填充的派生值
	CommentCount int64 `gorm:"-" json:"commentCount"`
}

// imageList 是 Images 反序列化后的结果类型
type imageList []string

// ImageList 解析出图片列表。数据损坏（非法 JSON）时返回空数组而不是报错——
// 一条说说的图片存坏了不应该让整个列表接口 500。
func (n *Note) ImageList() imageList {
	raw := strings.TrimSpace(n.Images)
	if raw == "" || raw == "null" {
		return imageList{}
	}
	var images []string
	if err := json.Unmarshal([]byte(raw), &images); err != nil {
		return imageList{}
	}
	out := make(imageList, 0, len(images))
	for _, img := range images {
		if trimmed := strings.TrimSpace(img); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

// MarshalJSON 把 Images 序列化列展开成前台期望的数组形式。
// 前台只认 note.images 数组，不关心库里是怎么存的。
func (n Note) MarshalJSON() ([]byte, error) {
	type alias Note
	return json.Marshal(struct {
		alias
		Images imageList `json:"images"`
	}{
		alias:  alias(n),
		Images: n.ImageList(),
	})
}

// SetImages 把图片列表规范化为 JSON 写回 Images 字段。
func (n *Note) SetImages(images []string) error {
	cleaned := make([]string, 0, len(images))
	for _, img := range images {
		if trimmed := strings.TrimSpace(img); trimmed != "" {
			cleaned = append(cleaned, trimmed)
		}
	}
	raw, err := json.Marshal(cleaned)
	if err != nil {
		return err
	}
	n.Images = string(raw)
	return nil
}
