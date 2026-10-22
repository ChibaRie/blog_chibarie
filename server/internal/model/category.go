package model

import "time"

type Category struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:64;uniqueIndex;not null" json:"name"`
	Slug        string    `gorm:"size:64;uniqueIndex" json:"slug"`
	Description string    `gorm:"size:255" json:"description"`
	Sort        int       `json:"sort"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`

	PostCount int64 `gorm:"-" json:"postCount"`
}
