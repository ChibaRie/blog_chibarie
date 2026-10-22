package handler

import (
	"errors"
	"strings"

	"blog-chibarie/server/internal/middleware"
	"blog-chibarie/server/internal/model"
	"blog-chibarie/server/pkg/hash"
	"blog-chibarie/server/pkg/jwt"
	"blog-chibarie/server/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AuthHandler struct {
	db     *gorm.DB
	jwtMgr *jwt.Manager
}

func NewAuthHandler(db *gorm.DB, jwtMgr *jwt.Manager) *AuthHandler {
	return &AuthHandler{db: db, jwtMgr: jwtMgr}
}

type loginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请输入用户名和密码")
		return
	}

	var user model.User
	err := h.db.Where("username = ?", strings.TrimSpace(req.Username)).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		response.Unauthorized(c, "用户名或密码错误")
		return
	}
	if err != nil {
		response.ServerError(c, "查询用户失败")
		return
	}

	if !hash.Check(user.Password, req.Password) {
		response.Unauthorized(c, "用户名或密码错误")
		return
	}

	token, err := h.jwtMgr.Generate(user.ID, user.Username, user.Role)
	if err != nil {
		response.ServerError(c, "生成登录凭证失败")
		return
	}

	response.OK(c, gin.H{
		"token": token,
		"user":  user,
	})
}

func (h *AuthHandler) Profile(c *gin.Context) {
	var user model.User
	if err := h.db.First(&user, middleware.CurrentUserID(c)).Error; err != nil {
		response.NotFound(c, "用户不存在")
		return
	}
	response.OK(c, user)
}

type changePasswordRequest struct {
	OldPassword string `json:"oldPassword" binding:"required"`
	NewPassword string `json:"newPassword" binding:"required"`
}

func (h *AuthHandler) ChangePassword(c *gin.Context) {
	var req changePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请填写原密码和新密码")
		return
	}
	if len([]rune(req.NewPassword)) < 6 {
		response.BadRequest(c, "新密码长度不能少于 6 位")
		return
	}

	var user model.User
	if err := h.db.First(&user, middleware.CurrentUserID(c)).Error; err != nil {
		response.NotFound(c, "用户不存在")
		return
	}

	if !hash.Check(user.Password, req.OldPassword) {
		response.BadRequest(c, "原密码不正确")
		return
	}

	hashed, err := hash.Password(req.NewPassword)
	if err != nil {
		response.ServerError(c, "加密新密码失败")
		return
	}

	if err := h.db.Model(&user).Update("password", hashed).Error; err != nil {
		response.ServerError(c, "更新密码失败")
		return
	}

	response.OK(c, gin.H{"updated": true})
}
