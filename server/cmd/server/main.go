package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"blog-chibarie/server/internal/config"
	"blog-chibarie/server/internal/database"
	"blog-chibarie/server/internal/handler"
	"blog-chibarie/server/internal/router"
	"blog-chibarie/server/internal/seed"
	"blog-chibarie/server/pkg/jwt"

	"github.com/gin-gonic/gin"
)

func main() {
	configPath := flag.String("config", "configs/config.yaml", "配置文件路径")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	if err := cfg.EnsureDirs(); err != nil {
		log.Fatalf("初始化目录失败: %v", err)
	}

	db, err := database.Open(cfg)
	if err != nil {
		log.Fatalf("初始化数据库失败: %v", err)
	}

	if err := seed.Run(db); err != nil {
		log.Fatalf("写入种子数据失败: %v", err)
	}

	if err := handler.MigrateLegacySiteSettings(db); err != nil {
		log.Printf("[migrate] 迁移旧背景配置失败: %v", err)
	}

	if err := handler.EnsureDefaultSiteContent(db); err != nil {
		log.Printf("[seed] 写入关于页与社交链接默认值失败: %v", err)
	}

	jwtMgr := jwt.NewManager(cfg.JWT.Secret, cfg.JWT.Expire())

	// 前台引擎（页面 + API + 上传文件）。同一个引擎既服务 HTTP 也服务 HTTPS，
	// 用两个 http.Server 分别监听。
	engine := router.New(db, cfg, jwtMgr)
	adminEngine := router.NewAdmin(db, cfg, jwtMgr)

	// HTTPS 就绪判定：端口、证书、私钥三者齐备且证书文件真实存在。
	// 缺任何一个只记警告、照常以 HTTP 运行——先部署后补证书的流程不需要停机改代码。
	useTLS := cfg.Server.HTTPSPort != 0 &&
		cfg.Server.CertFile != "" && cfg.Server.KeyFile != ""
	if useTLS {
		for _, f := range []string{cfg.Server.CertFile, cfg.Server.KeyFile} {
			if _, err := os.Stat(f); err != nil {
				log.Printf("[server] HTTPS 已配置但证书文件不存在 %s，本次以纯 HTTP 运行", f)
				useTLS = false
				break
			}
		}
	}
	if useTLS {
		log.Printf("[server] HTTPS 已启用，证书 %s", cfg.Server.CertFile)
	}

	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	var server *http.Server

	if useTLS {
		// HTTP(80) 只做一件事：301 跳转到 HTTPS，保留原始路径和查询参数
		redirect := gin.New()
		redirect.Use(func(c *gin.Context) {
			c.Redirect(http.StatusMovedPermanently, "https://"+c.Request.Host+c.Request.RequestURI)
		})
		server = &http.Server{Addr: addr, Handler: redirect}

		httpsAddr := fmt.Sprintf(":%d", cfg.Server.HTTPSPort)
		httpsServer := &http.Server{
			Addr:    httpsAddr,
			Handler: engine,
		}
		go func() {
			log.Printf("[server] HTTPS 已启动 → https://localhost%s", httpsAddr)
			if err := httpsServer.ListenAndServeTLS(cfg.Server.CertFile, cfg.Server.KeyFile); err != nil && !errors.Is(err, http.ErrServerClosed) {
				log.Printf("[server] HTTPS 启动失败: %v（请检查证书/私钥文件与 443 端口占用）", err)
			}
		}()
	} else {
		server = &http.Server{Addr: addr, Handler: engine}
	}

	adminAddr := fmt.Sprintf(":%d", cfg.Server.AdminPort)
	adminServer := &http.Server{
		Addr:    adminAddr,
		Handler: adminEngine,
	}

	go func() {
		log.Printf("[server] 博客后端已启动 → http://localhost%s", addr)
		log.Printf("[server] 数据库驱动 %s，运行模式 %s", cfg.Database.Driver, cfg.Server.Mode)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			// 不退出进程：前台端口被占只影响前台，后台和 API 还能用，
			// 便于排查（比如 Nginx 忘了停导致 80 被占）
			log.Printf("[server] 前台端口监听失败 %s: %v", addr, err)
		}
	}()

	go func() {
		log.Printf("[server] 后台管理入口已启动 → http://localhost%s", adminAddr)
		if err := adminServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("[server] 后台端口监听失败 %s: %v", adminAddr, err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Println("[server] 收到退出信号，正在关闭服务...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	for name, srv := range map[string]*http.Server{"前台": server, "后台": adminServer} {
		if err := srv.Shutdown(ctx); err != nil {
			log.Printf("[server] 关闭%s服务时出错: %v", name, err)
		}
	}
	log.Println("[server] 服务已退出")
}
