package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
)

func queryInt(c *gin.Context, key string, fallback int) int {
	raw := c.Query(key)
	if raw == "" {
		return fallback
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return n
}

func queryUint(c *gin.Context, key string) uint {
	n := queryInt(c, key, 0)
	if n < 0 {
		return 0
	}
	return uint(n)
}

func Pagination(c *gin.Context) (page, pageSize, offset int) {
	page = queryInt(c, "page", 1)
	pageSize = queryInt(c, "pageSize", 10)

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}

	offset = (page - 1) * pageSize
	return
}
