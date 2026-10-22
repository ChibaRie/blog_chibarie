package model

import "time"

type CommentStatus string

const (
	CommentPending  CommentStatus = "pending"
	CommentApproved CommentStatus = "approved"
	CommentRejected CommentStatus = "rejected"
)

// CommentType 区分文章评论、留言板留言与说说评论，三者共用一张表以复用审核流程。
// 注意 PostID 字段名虽然带 Post，实际承载的是「宿主内容 ID」：
// post 类型指向 posts.id，note 类型指向 notes.id，guestbook 固定为 0。
type CommentType string

const (
	CommentTypePost      CommentType = "post"
	CommentTypeGuestbook CommentType = "guestbook"
	CommentTypeNote      CommentType = "note"
)

type Comment struct {
	ID        uint          `gorm:"primaryKey" json:"id"`
	Type      CommentType   `gorm:"size:16;index;default:post" json:"type"`
	PostID    uint          `gorm:"index;not null" json:"postId"`
	ParentID  *uint         `gorm:"index" json:"parentId"`
	Nickname  string        `gorm:"size:64;not null" json:"nickname"`
	Email     string        `gorm:"size:128" json:"-"`
	Website   string        `gorm:"size:255" json:"website"`
	Avatar    string        `gorm:"size:512" json:"avatar"`
	Content   string        `gorm:"type:text;not null" json:"content"`
	Status    CommentStatus `gorm:"size:16;index" json:"status"`
	IP        string        `gorm:"size:64" json:"-"`
	UserAgent string        `gorm:"size:512" json:"-"`
	CreatedAt time.Time     `json:"createdAt"`

	Children []*Comment `gorm:"-" json:"children,omitempty"`
}
