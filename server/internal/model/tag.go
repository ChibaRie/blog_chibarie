package model

import "time"

type Tag struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:64;uniqueIndex;not null" json:"name"`
	Slug      string    `gorm:"size:64;uniqueIndex" json:"slug"`
	CreatedAt time.Time `json:"createdAt"`

	PostCount int64 `gorm:"-" json:"postCount"`
}
