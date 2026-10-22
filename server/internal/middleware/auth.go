package middleware

import (
	"strings"

	"blog-chibarie/server/pkg/jwt"
	"blog-chibarie/server/pkg/response"

	"github.com/gin-gonic/gin"
)

const (
	CtxUserID   = "ctxUserID"
	CtxUsername = "ctxUsername"
	CtxRole     = "ctxRole"
)

func Auth(manager *jwt.Manager) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractToken(c)
		if token == "" {
			response.Unauthorized(c, "缺少登录凭证，请先登录")
			return
		}

		claims, err := manager.Parse(token)
		if err != nil {
			response.Unauthorized(c, "登录状态已失效，请重新登录")
			return
		}

		c.Set(CtxUserID, claims.UserID)
		c.Set(CtxUsername, claims.Username)
		c.Set(CtxRole, claims.Role)
		c.Next()
	}
}

func extractToken(c *gin.Context) string {
	header := c.GetHeader("Authorization")
	if header == "" {
		return strings.TrimSpace(c.Query("token"))
	}
	if after, ok := strings.CutPrefix(header, "Bearer "); ok {
		return strings.TrimSpace(after)
	}
	return strings.TrimSpace(header)
}

func CurrentUserID(c *gin.Context) uint {
	raw, ok := c.Get(CtxUserID)
	if !ok {
		return 0
	}
	id, _ := raw.(uint)
	return id
}

func CurrentUsername(c *gin.Context) string {
	raw, ok := c.Get(CtxUsername)
	if !ok {
		return ""
	}
	name, _ := raw.(string)
	return name
}
