package database

import (
	"fmt"
	"log"

	"blog-chibarie/server/internal/config"
	"blog-chibarie/server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Open(cfg *config.Config) (*gorm.DB, error) {
	level := logger.Warn
	if cfg.Server.Mode == "debug" {
		level = logger.Error
	}

	gormCfg := &gorm.Config{
		Logger: logger.Default.LogMode(level),
	}

	var (
		db  *gorm.DB
		err error
	)

	if cfg.Database.IsMySQL() {
		db, err = gorm.Open(mysql.Open(cfg.Database.MySQLDSN()), gormCfg)
		if err != nil {
			return nil, fmt.Errorf("连接 MySQL 失败: %w", err)
		}
		log.Printf("[db] 已连接 MySQL %s:%d/%s",
			cfg.Database.MySQL.Host, cfg.Database.MySQL.Port, cfg.Database.MySQL.Database)
	} else {
		db, err = gorm.Open(sqlite.Open(cfg.Database.SQLite.Path), gormCfg)
		if err != nil {
			return nil, fmt.Errorf("打开 SQLite 失败: %w", err)
		}
		log.Printf("[db] 已连接 SQLite %s", cfg.Database.SQLite.Path)
	}

	if err := Migrate(db); err != nil {
		return nil, err
	}
	return db, nil
}

func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&model.User{},
		&model.Category{},
		&model.Tag{},
		&model.Post{},
		&model.Note{},
		&model.Comment{},
		&model.Setting{},
		&model.FriendLink{},
	); err != nil {
		return fmt.Errorf("数据库迁移失败: %w", err)
	}
	log.Println("[db] 数据表迁移完成")
	return nil
}
