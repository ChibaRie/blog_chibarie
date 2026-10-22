package model

import "time"

type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Username  string    `gorm:"size:64;uniqueIndex;not null" json:"username"`
	Password  string    `gorm:"size:255;not null" json:"-"`
	Nickname  string    `gorm:"size:64" json:"nickname"`
	Email     string    `gorm:"size:128" json:"email"`
	Avatar    string    `gorm:"size:512" json:"avatar"`
	Bio       string    `gorm:"size:512" json:"bio"`
	Role      string    `gorm:"size:32" json:"role"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}
