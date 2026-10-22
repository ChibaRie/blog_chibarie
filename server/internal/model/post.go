package model

import "time"

type PostStatus string

const (
	PostDraft     PostStatus = "draft"
	PostPublished PostStatus = "published"
)

type Post struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	Title       string     `gorm:"size:255;not null" json:"title"`
	Slug        string     `gorm:"size:255;uniqueIndex" json:"slug"`
	Summary     string     `gorm:"size:512" json:"summary"`
	Content     string     `gorm:"type:text" json:"content"`
	ContentHTML string     `gorm:"type:text" json:"contentHtml"`
	Cover       string     `gorm:"size:512" json:"cover"`
	Status      PostStatus `gorm:"size:16;index" json:"status"`
	CategoryID  *uint      `gorm:"index" json:"categoryId"`
	Category    *Category  `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Tags        []Tag      `gorm:"many2many:post_tags" json:"tags"`

	Views       int64      `json:"views"`
	Likes       int64      `json:"likes"`
	WordCount   int        `json:"wordCount"`
	ReadingTime int        `json:"readingTime"`
	IsTop       bool       `json:"isTop"`
	PublishedAt *time.Time `json:"publishedAt"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`

	CommentCount int64 `gorm:"-" json:"commentCount"`
}

func (p *Post) IsPublished() bool {
	return p.Status == PostPublished
}
