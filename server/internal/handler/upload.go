package handler

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"blog-chibarie/server/internal/config"
	"blog-chibarie/server/pkg/response"

	"github.com/gin-gonic/gin"
)

var allowedExt = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".gif":  true,
	".webp": true,
	".svg":  true,
	".avif": true,
	".ico":  true,
}

type UploadHandler struct {
	cfg config.UploadConfig
}

func NewUploadHandler(cfg config.UploadConfig) *UploadHandler {
	return &UploadHandler{cfg: cfg}
}

func (h *UploadHandler) Upload(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "请选择要上传的文件")
		return
	}

	if file.Size > h.cfg.MaxSizeBytes() {
		response.BadRequest(c, fmt.Sprintf("文件大小不能超过 %d MB", h.cfg.MaxSizeMB))
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedExt[ext] {
		response.BadRequest(c, "只支持 jpg / png / gif / webp / svg / avif 格式")
		return
	}

	now := time.Now()
	relDir := path.Join(now.Format("2006"), now.Format("01"))
	absDir := filepath.Join(h.cfg.Dir, filepath.FromSlash(relDir))
	if err := os.MkdirAll(absDir, 0o755); err != nil {
		response.ServerError(c, "创建上传目录失败")
		return
	}

	name := randomName() + ext
	absPath := filepath.Join(absDir, name)
	if err := c.SaveUploadedFile(file, absPath); err != nil {
		response.ServerError(c, "保存文件失败")
		return
	}

	response.OK(c, gin.H{
		"url":      path.Join(h.cfg.URLPrefix, relDir, name),
		"filename": file.Filename,
		"size":     file.Size,
	})
}

func randomName() string {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return fmt.Sprintf("%d-%s", time.Now().Unix(), hex.EncodeToString(buf))
}
