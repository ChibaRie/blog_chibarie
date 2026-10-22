package model

import "time"

// FriendLink 友链。公开接口只返回 Sort 升序的全部记录，
// 增删改走 /api/admin/links。
type FriendLink struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:64;not null" json:"name"`
	URL         string    `gorm:"size:255;not null;index" json:"url"`
	Avatar      string    `gorm:"size:255" json:"avatar"`
	Description string    `gorm:"size:200" json:"description"`
	Sort        int       `json:"sort"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}
