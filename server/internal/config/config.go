package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"gopkg.in/yaml.v3"
)

type ServerConfig struct {
	Port int    `yaml:"port"`
	Mode string `yaml:"mode"`
	// AdminPort 后台管理页面的独立端口：同一进程会再起一个 HTTP 服务，
	// 提供同一套 API + admin 目录的静态页面。默认 8088。
	AdminPort int `yaml:"admin_port"`
	// HTTPSPort HTTPS 监听端口（一般 443）。0 = 不启用 HTTPS（默认）。
	// 启用还需同时配置 CertFile 和 KeyFile，且证书文件必须存在，
	// 否则只是记一条警告、照常以 HTTP 运行（便于先部署后补证书）。
	HTTPSPort int `yaml:"https_port"`
	// CertFile 证书链文件（PEM 格式，腾讯云证书下载里 Nginx 目录的 .crt/.pem）
	CertFile string `yaml:"cert_file"`
	// KeyFile 私钥文件（PEM 格式，对应证书的 .key）
	KeyFile string `yaml:"key_file"`
}

type StaticConfig struct {
	// Web 前台静态文件目录（相对服务工作目录）
	Web string `yaml:"web"`
	// Admin 后台静态文件目录（相对服务工作目录）
	Admin string `yaml:"admin"`
}

type SQLiteConfig struct {
	Path string `yaml:"path"`
}

type MySQLConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	Database string `yaml:"database"`
	Charset  string `yaml:"charset"`
}

type DatabaseConfig struct {
	Driver string       `yaml:"driver"`
	SQLite SQLiteConfig `yaml:"sqlite"`
	MySQL  MySQLConfig  `yaml:"mysql"`
}

type JWTConfig struct {
	Secret      string `yaml:"secret"`
	ExpireHours int    `yaml:"expire_hours"`
}

type UploadConfig struct {
	Dir       string `yaml:"dir"`
	MaxSizeMB int    `yaml:"max_size_mb"`
	URLPrefix string `yaml:"url_prefix"`
}

type SiteConfig struct {
	Name        string `yaml:"name" json:"name"`
	Description string `yaml:"description" json:"description"`
	Keywords    string `yaml:"keywords" json:"keywords"`
	ICP         string `yaml:"icp" json:"icp"`
}

type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Static   StaticConfig   `yaml:"static"`
	Database DatabaseConfig `yaml:"database"`
	JWT      JWTConfig      `yaml:"jwt"`
	Upload   UploadConfig   `yaml:"upload"`
	Site     SiteConfig     `yaml:"site"`
}

func (j JWTConfig) Expire() time.Duration {
	return time.Duration(j.ExpireHours) * time.Hour
}

func (u UploadConfig) MaxSizeBytes() int64 {
	return int64(u.MaxSizeMB) << 20
}

func (d DatabaseConfig) MySQLDSN() string {
	m := d.MySQL
	return fmt.Sprintf(
		"%s:%s@tcp(%s:%d)/%s?charset=%s&parseTime=True&loc=Local",
		m.User, m.Password, m.Host, m.Port, m.Database, m.Charset,
	)
}

func (d DatabaseConfig) IsMySQL() bool {
	return d.Driver == "mysql"
}

func Load(path string) (*Config, error) {
	cfg := &Config{}

	raw, err := os.ReadFile(path)
	switch {
	case err == nil:
		if err := yaml.Unmarshal(raw, cfg); err != nil {
			return nil, fmt.Errorf("解析配置文件 %s 失败: %w", path, err)
		}
	case os.IsNotExist(err):
		fmt.Printf("[config] 未找到 %s，使用内置默认配置\n", path)
	default:
		return nil, fmt.Errorf("读取配置文件 %s 失败: %w", path, err)
	}

	cfg.applyEnv()
	cfg.applyDefaults()
	return cfg, nil
}

func (c *Config) applyEnv() {
	if v := os.Getenv("BLOG_PORT"); v != "" {
		if p, err := strconv.Atoi(v); err == nil {
			c.Server.Port = p
		}
	}
	if v := os.Getenv("BLOG_MODE"); v != "" {
		c.Server.Mode = v
	}
	if v := os.Getenv("BLOG_DB_DRIVER"); v != "" {
		c.Database.Driver = v
	}
	if v := os.Getenv("BLOG_SQLITE_PATH"); v != "" {
		c.Database.SQLite.Path = v
	}
	if v := os.Getenv("BLOG_DB_HOST"); v != "" {
		c.Database.MySQL.Host = v
	}
	if v := os.Getenv("BLOG_DB_USER"); v != "" {
		c.Database.MySQL.User = v
	}
	if v := os.Getenv("BLOG_DB_PASSWORD"); v != "" {
		c.Database.MySQL.Password = v
	}
	if v := os.Getenv("BLOG_DB_NAME"); v != "" {
		c.Database.MySQL.Database = v
	}
	if v := os.Getenv("BLOG_JWT_SECRET"); v != "" {
		c.JWT.Secret = v
	}
	if v := os.Getenv("BLOG_UPLOAD_DIR"); v != "" {
		c.Upload.Dir = v
	}
	if v := os.Getenv("BLOG_ADMIN_PORT"); v != "" {
		if p, err := strconv.Atoi(v); err == nil {
			c.Server.AdminPort = p
		}
	}
	if v := os.Getenv("BLOG_STATIC_WEB"); v != "" {
		c.Static.Web = v
	}
	if v := os.Getenv("BLOG_STATIC_ADMIN"); v != "" {
		c.Static.Admin = v
	}
	if v := os.Getenv("BLOG_HTTPS_PORT"); v != "" {
		if p, err := strconv.Atoi(v); err == nil {
			c.Server.HTTPSPort = p
		}
	}
	if v := os.Getenv("BLOG_TLS_CERT"); v != "" {
		c.Server.CertFile = v
	}
	if v := os.Getenv("BLOG_TLS_KEY"); v != "" {
		c.Server.KeyFile = v
	}
}

func (c *Config) applyDefaults() {
	if c.Server.Port == 0 {
		c.Server.Port = 8080
	}
	if c.Server.Mode == "" {
		c.Server.Mode = "debug"
	}
	if c.Server.AdminPort == 0 {
		c.Server.AdminPort = 8088
	}
	if c.Static.Web == "" {
		c.Static.Web = "web"
	}
	if c.Static.Admin == "" {
		c.Static.Admin = "admin"
	}
	if c.Database.Driver == "" {
		c.Database.Driver = "sqlite"
	}
	if c.Database.SQLite.Path == "" {
		c.Database.SQLite.Path = "./data/blog.db"
	}
	if c.Database.MySQL.Host == "" {
		c.Database.MySQL.Host = "127.0.0.1"
	}
	if c.Database.MySQL.Port == 0 {
		c.Database.MySQL.Port = 3306
	}
	if c.Database.MySQL.Charset == "" {
		c.Database.MySQL.Charset = "utf8mb4"
	}
	if c.JWT.ExpireHours == 0 {
		c.JWT.ExpireHours = 168
	}
	if c.JWT.Secret == "" {
		c.JWT.Secret = "blog-chibarie-dev-secret"
	}
	if c.Upload.Dir == "" {
		c.Upload.Dir = "./uploads"
	}
	if c.Upload.MaxSizeMB == 0 {
		c.Upload.MaxSizeMB = 10
	}
	if c.Upload.URLPrefix == "" {
		c.Upload.URLPrefix = "/uploads"
	}
	if c.Site.Name == "" {
		c.Site.Name = "chibarie"
	}
}

func (c *Config) EnsureDirs() error {
	targets := []string{filepath.Dir(c.Database.SQLite.Path), c.Upload.Dir}
	for _, dir := range targets {
		if dir == "" || dir == "." {
			continue
		}
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("创建目录 %s 失败: %w", dir, err)
		}
	}
	return nil
}
