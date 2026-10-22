package router

import (
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"blog-chibarie/server/internal/config"
	"blog-chibarie/server/internal/handler"
	"blog-chibarie/server/internal/middleware"
	"blog-chibarie/server/pkg/jwt"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Windows 上 Go 的 mime 包会读注册表里的 Content-Type 映射；
// 某些服务器的注册表把 .js/.css 配成了 text/html，导致浏览器拒绝执行
// module 脚本（整站白屏）。这里显式覆盖，不再信任系统配置。
func init() {
	_ = mime.AddExtensionType(".html", "text/html; charset=utf-8")
	_ = mime.AddExtensionType(".js", "text/javascript; charset=utf-8")
	_ = mime.AddExtensionType(".mjs", "text/javascript; charset=utf-8")
	_ = mime.AddExtensionType(".css", "text/css; charset=utf-8")
	_ = mime.AddExtensionType(".json", "application/json; charset=utf-8")
	_ = mime.AddExtensionType(".svg", "image/svg+xml")
	_ = mime.AddExtensionType(".png", "image/png")
	_ = mime.AddExtensionType(".jpg", "image/jpeg")
	_ = mime.AddExtensionType(".jpeg", "image/jpeg")
	_ = mime.AddExtensionType(".gif", "image/gif")
	_ = mime.AddExtensionType(".webp", "image/webp")
	_ = mime.AddExtensionType(".ico", "image/x-icon")
	_ = mime.AddExtensionType(".woff", "font/woff")
	_ = mime.AddExtensionType(".woff2", "font/woff2")
	_ = mime.AddExtensionType(".ttf", "font/ttf")
	_ = mime.AddExtensionType(".md", "text/markdown; charset=utf-8")
}

// New 构建前台引擎：全部 API + web 目录的静态页面（SPA 回退到 index.html）。
// 生产部署里它就是「网站本身」，Nginx 只是可选的加分项而不是必需品。
func New(db *gorm.DB, cfg *config.Config, jwtMgr *jwt.Manager) *gin.Engine {
	return build(db, cfg, jwtMgr, cfg.Static.Web)
}

// NewAdmin 构建后台引擎：同一套 API + admin 目录的静态页面，独立端口监听。
func NewAdmin(db *gorm.DB, cfg *config.Config, jwtMgr *jwt.Manager) *gin.Engine {
	return build(db, cfg, jwtMgr, cfg.Static.Admin)
}

func build(db *gorm.DB, cfg *config.Config, jwtMgr *jwt.Manager, staticDir string) *gin.Engine {
	gin.SetMode(cfg.Server.Mode)

	engine := gin.New()
	engine.Use(gin.Logger(), gin.Recovery(), middleware.CORS())
	engine.MaxMultipartMemory = cfg.Upload.MaxSizeBytes()

	authHandler := handler.NewAuthHandler(db, jwtMgr)
	postHandler := handler.NewPostHandler(db)
	categoryHandler := handler.NewCategoryHandler(db)
	tagHandler := handler.NewTagHandler(db)
	commentHandler := handler.NewCommentHandler(db)
	uploadHandler := handler.NewUploadHandler(cfg.Upload)
	siteHandler := handler.NewSiteHandler(db, cfg)
	linkHandler := handler.NewLinkHandler(db)
	noteHandler := handler.NewNoteHandler(db)

	engine.Static(cfg.Upload.URLPrefix, cfg.Upload.Dir)

	api := engine.Group("/api")

	api.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api.POST("/auth/login", authHandler.Login)

	api.GET("/site/info", siteHandler.Info)
	api.GET("/archive", siteHandler.Archive)

	api.GET("/posts", postHandler.List)
	api.GET("/posts/:id", postHandler.Detail)
	api.POST("/posts/:id/like", postHandler.Like)

	api.GET("/categories", categoryHandler.List)
	api.GET("/tags", tagHandler.List)

	// 说说：短文本时间流，读接口公开，写接口在下面的鉴权组
	api.GET("/notes", noteHandler.List)
	api.GET("/notes/:id", noteHandler.Detail)
	api.POST("/notes/:id/like", noteHandler.Like)

	// 评论按 type 区分宿主：post（文章）/ note（说说）/ guestbook（留言板走下面的独立接口）
	api.GET("/comments", commentHandler.ListByHost)
	api.POST("/comments", commentHandler.Create)

	api.GET("/guestbook", commentHandler.GuestbookList)
	api.POST("/guestbook", commentHandler.GuestbookCreate)

	api.GET("/links", linkHandler.List)

	auth := api.Group("")
	auth.Use(middleware.Auth(jwtMgr))

	auth.GET("/auth/profile", authHandler.Profile)
	auth.PUT("/auth/password", authHandler.ChangePassword)

	auth.GET("/admin/settings", siteHandler.AdminSettings)
	auth.PUT("/admin/settings", siteHandler.UpdateSettings)

	auth.GET("/admin/posts", postHandler.AdminList)
	auth.GET("/admin/posts/:id", postHandler.AdminDetail)
	auth.POST("/admin/posts", postHandler.Create)
	auth.PUT("/admin/posts/:id", postHandler.Update)
	auth.DELETE("/admin/posts/:id", postHandler.Delete)

	auth.POST("/admin/upload", uploadHandler.Upload)

	auth.GET("/admin/notes", noteHandler.AdminList)
	auth.POST("/admin/notes", noteHandler.Create)
	auth.PUT("/admin/notes/:id", noteHandler.Update)
	auth.DELETE("/admin/notes/:id", noteHandler.Delete)

	auth.POST("/admin/categories", categoryHandler.Create)
	auth.PUT("/admin/categories/:id", categoryHandler.Update)
	auth.DELETE("/admin/categories/:id", categoryHandler.Delete)

	auth.POST("/admin/tags", tagHandler.Create)
	auth.PUT("/admin/tags/:id", tagHandler.Update)
	auth.DELETE("/admin/tags/:id", tagHandler.Delete)

	auth.GET("/admin/comments", commentHandler.AdminList)
	auth.PUT("/admin/comments/:id/status", commentHandler.UpdateStatus)
	auth.DELETE("/admin/comments/:id", commentHandler.Delete)

	auth.POST("/admin/links", linkHandler.Create)
	auth.PUT("/admin/links/:id", linkHandler.Update)
	auth.DELETE("/admin/links/:id", linkHandler.Delete)

	// 未匹配路由：API 保持 JSON 404，其余一律回退到静态目录的 index.html（SPA）。
	// 有这一段，后端进程就能独立对外提供完整网站，Nginx 从必需品降级为可选优化。
	engine.NoRoute(func(c *gin.Context) {
		p := c.Request.URL.Path
		if p == "/api" || strings.HasPrefix(p, "/api/") || strings.HasPrefix(p, "/uploads/") {
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
			return
		}
		// Clean("/"+p) 把 .. 等路径消解掉，防目录穿越
		rel := filepath.FromSlash(filepath.Clean("/" + p))
		full := filepath.Join(staticDir, rel)
		if fi, err := os.Stat(full); err == nil && !fi.IsDir() {
			// 双保险：即使 mime 表再被系统配置污染，这里也按扩展名给对类型
			switch strings.ToLower(filepath.Ext(full)) {
			case ".js", ".mjs":
				c.Header("Content-Type", "text/javascript; charset=utf-8")
			case ".css":
				c.Header("Content-Type", "text/css; charset=utf-8")
			case ".html":
				c.Header("Content-Type", "text/html; charset=utf-8")
			case ".json":
				c.Header("Content-Type", "application/json; charset=utf-8")
			case ".svg":
				c.Header("Content-Type", "image/svg+xml")
			}
			c.File(full)
			return
		}
		c.File(filepath.Join(staticDir, "index.html"))
	})

	return engine
}
