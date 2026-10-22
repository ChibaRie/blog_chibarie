package handler

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"blog-chibarie/server/internal/config"
	"blog-chibarie/server/internal/model"
	"blog-chibarie/server/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SiteHandler struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewSiteHandler(db *gorm.DB, cfg *config.Config) *SiteHandler {
	return &SiteHandler{db: db, cfg: cfg}
}

// Setting 表的键名。config.yaml 提供默认值，数据库有值时覆盖。
const (
	keySiteName        = "site.name"
	keySiteDescription = "site.description"
	keySiteKeywords    = "site.keywords"
	keySiteICP         = "site.icp"
	keySiteAvatar      = "site.avatar"

	// 首页头图与全站氛围背景互相独立，可各自单独更换
	keySiteHeroBackground = "site.heroBackground"
	keySitePageBackground = "site.pageBackground"

	// 首页头图轮播列表（JSON 数组），为空时回落到单张 heroBackground
	keySiteHeroBackgrounds = "site.heroBackgrounds"

	// 关于页正文（Markdown，后台可编辑）
	keySiteAboutContent = "site.aboutContent"

	// 博主社交链接与所在地
	keySiteBilibili = "site.bilibili"
	keySiteGithub   = "site.github"
	keySiteSteam    = "site.steam"
	keySiteLocation = "site.location"

	// 早期版本只有一个背景配置，保留此键用于一次性迁移与兜底
	keyLegacyBackground = "site.background"
)

func (h *SiteHandler) loadSettings() map[string]string {
	settings := make(map[string]string)
	rows := make([]model.Setting, 0)
	if err := h.db.Find(&rows).Error; err != nil {
		return settings
	}
	for _, row := range rows {
		settings[row.Key] = row.Value
	}
	return settings
}

// firstNonEmpty 返回第一个「去掉首尾空白后仍非空」的值。
// 注意必须 TrimSpace：后台输入框里只敲了个空格也算有值，
// 会让前台拿到一串看不见的空白（首页签名就只显示一个光标）。
func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

// buildHeroBackgrounds 返回首页头图轮播列表。
// 优先读多图配置，为空或解析失败时回落到单张配置与旧版 background。
func buildHeroBackgrounds(settings map[string]string) []string {
	if raw := strings.TrimSpace(settings[keySiteHeroBackgrounds]); raw != "" {
		var list []string
		if err := json.Unmarshal([]byte(raw), &list); err == nil {
			cleaned := make([]string, 0, len(list))
			for _, item := range list {
				if url := strings.TrimSpace(item); url != "" {
					cleaned = append(cleaned, url)
				}
			}
			if len(cleaned) > 0 {
				return cleaned
			}
		}
	}

	single := firstNonEmpty(
		settings[keySiteHeroBackground],
		settings[keyLegacyBackground],
	)
	if single != "" {
		return []string{single}
	}
	return []string{}
}

// buildSiteInfo：config.yaml 默认值 + 数据库覆盖值
func (h *SiteHandler) buildSiteInfo(settings map[string]string) gin.H {
	// 旧版单一背景作为两个新键的兜底，避免升级后用户已设置的图丢失
	legacy := settings[keyLegacyBackground]

	return gin.H{
		"name":            firstNonEmpty(settings[keySiteName], h.cfg.Site.Name),
		"description":     firstNonEmpty(settings[keySiteDescription], h.cfg.Site.Description),
		"keywords":        firstNonEmpty(settings[keySiteKeywords], h.cfg.Site.Keywords),
		"icp":             firstNonEmpty(settings[keySiteICP], h.cfg.Site.ICP),
		"avatar":          settings[keySiteAvatar],
		"heroBackground":  firstNonEmpty(settings[keySiteHeroBackground], legacy),
		"pageBackground":  firstNonEmpty(settings[keySitePageBackground], legacy),
		"heroBackgrounds": buildHeroBackgrounds(settings),
		"aboutContent":    settings[keySiteAboutContent],
		"socials": gin.H{
			"bilibili": settings[keySiteBilibili],
			"github":   settings[keySiteGithub],
			"steam":    settings[keySiteSteam],
			"location": settings[keySiteLocation],
		},
	}
}

func (h *SiteHandler) Info(c *gin.Context) {
	var postCount, categoryCount, tagCount, commentCount int64
	h.db.Model(&model.Post{}).Where("status = ?", model.PostPublished).Count(&postCount)
	h.db.Model(&model.Category{}).Count(&categoryCount)
	h.db.Model(&model.Tag{}).Count(&tagCount)
	h.db.Model(&model.Comment{}).Where("status = ?", model.CommentApproved).Count(&commentCount)

	var totals struct {
		Words int64
		Views int64
		Likes int64
	}
	h.db.Model(&model.Post{}).
		Select("COALESCE(SUM(word_count),0) AS words, COALESCE(SUM(views),0) AS views, COALESCE(SUM(likes),0) AS likes").
		Where("status = ?", model.PostPublished).
		Scan(&totals)

	response.OK(c, gin.H{
		"site": h.buildSiteInfo(h.loadSettings()),
		"stats": gin.H{
			"postCount":     postCount,
			"categoryCount": categoryCount,
			"tagCount":      tagCount,
			"commentCount":  commentCount,
			"wordCount":     totals.Words,
			"views":         totals.Views,
			"likes":         totals.Likes,
		},
	})
}

type settingsPayload struct {
	Name            string   `json:"name"`
	Description     string   `json:"description"`
	Keywords        string   `json:"keywords"`
	ICP             string   `json:"icp"`
	Avatar          string   `json:"avatar"`
	HeroBackground  string   `json:"heroBackground"`
	HeroBackgrounds []string `json:"heroBackgrounds"`
	PageBackground  string   `json:"pageBackground"`
	AboutContent    string   `json:"aboutContent"`
	Bilibili        string   `json:"bilibili"`
	Github          string   `json:"github"`
	Steam           string   `json:"steam"`
	Location        string   `json:"location"`
}

// AdminSettings 读取当前生效设置与 config 默认值（供后台表单回显）
func (h *SiteHandler) AdminSettings(c *gin.Context) {
	settings := h.loadSettings()

	response.OK(c, gin.H{
		"site": h.buildSiteInfo(settings),
		"defaults": gin.H{
			"name":        h.cfg.Site.Name,
			"description": h.cfg.Site.Description,
			"keywords":    h.cfg.Site.Keywords,
			"icp":         h.cfg.Site.ICP,
		},
	})
}

// UpdateSettings 全量保存设置；空字符串表示清除该项（前台回落到默认值）
func (h *SiteHandler) UpdateSettings(c *gin.Context) {
	var req settingsPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数格式不正确")
		return
	}

	// 头图列表序列化为 JSON 存储；同时把首图写回单张配置，供旧逻辑兜底
	heroList := make([]string, 0, len(req.HeroBackgrounds))
	for _, item := range req.HeroBackgrounds {
		if url := strings.TrimSpace(item); url != "" {
			heroList = append(heroList, url)
		}
	}
	heroJSON, err := json.Marshal(heroList)
	if err != nil {
		response.ServerError(c, "头图列表格式不正确")
		return
	}

	heroCover := ""
	if len(heroList) > 0 {
		heroCover = heroList[0]
	}

	entries := map[string]string{
		keySiteName:            req.Name,
		keySiteDescription:     req.Description,
		keySiteKeywords:        req.Keywords,
		keySiteICP:             req.ICP,
		keySiteAvatar:          req.Avatar,
		keySiteHeroBackground:  heroCover,
		keySiteHeroBackgrounds: string(heroJSON),
		keySitePageBackground:  req.PageBackground,
		keySiteAboutContent:    req.AboutContent,
		keySiteBilibili:        req.Bilibili,
		keySiteGithub:          req.Github,
		keySiteSteam:           req.Steam,
		keySiteLocation:        req.Location,
	}

	for key, value := range entries {
		var existing model.Setting
		err := h.db.Where(&model.Setting{Key: key}).First(&existing).Error

		switch {
		case err == nil:
			existing.Value = value
			if saveErr := h.db.Save(&existing).Error; saveErr != nil {
				response.ServerError(c, "保存设置失败")
				return
			}
		case errors.Is(err, gorm.ErrRecordNotFound):
			setting := model.Setting{Key: key, Value: value}
			if saveErr := h.db.Create(&setting).Error; saveErr != nil {
				response.ServerError(c, "保存设置失败")
				return
			}
		default:
			response.ServerError(c, "查询设置失败")
			return
		}
	}

	response.OK(c, gin.H{"site": h.buildSiteInfo(entries)})
}

func (h *SiteHandler) Archive(c *gin.Context) {
	type archiveItem struct {
		ID          uint       `json:"id"`
		Title       string     `json:"title"`
		Slug        string     `json:"slug"`
		PublishedAt *time.Time `json:"publishedAt"`
		CreatedAt   time.Time  `json:"createdAt"`
	}

	items := make([]archiveItem, 0)
	err := h.db.Model(&model.Post{}).
		Select("id, title, slug, published_at, created_at").
		Where("status = ?", model.PostPublished).
		Order("COALESCE(published_at, created_at) DESC").
		Scan(&items).Error
	if err != nil {
		response.ServerError(c, "查询归档失败")
		return
	}

	response.OK(c, items)
}

// MigrateLegacySiteSettings 把旧的单一背景配置复制到「首页头图」与「全站背景」两个独立键，
// 仅在目标键为空时执行，重复调用安全。
func MigrateLegacySiteSettings(db *gorm.DB) error {
	var legacy model.Setting
	if err := db.Where(&model.Setting{Key: keyLegacyBackground}).First(&legacy).Error; err != nil {
		return nil
	}
	if legacy.Value == "" {
		return nil
	}

	for _, key := range []string{keySiteHeroBackground, keySitePageBackground} {
		var existing model.Setting
		err := db.Where(&model.Setting{Key: key}).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			setting := model.Setting{Key: key, Value: legacy.Value}
			if createErr := db.Create(&setting).Error; createErr != nil {
				return createErr
			}
		}
	}
	return nil
}

const defaultAboutContent = `欢迎来到这里。这里是站长的一点自我介绍，下面这段话可以直接在后台「站点设置 → 关于页内容」里改。

## 关于这个站

内容主要分两条线 —— 技术笔记偏工程实践，尽量写清楚「为什么这么做」而不只是「怎么做」；生活随笔则随意一些，读书、天气，以及一些没什么用但想留住的瞬间。

## 本站怎么搭的

前后端分离架构，后端提供 REST API，前台通过 JWT 与服务端通信，写作、上传、评论审核都在独立的管理后台完成。

- **后端**：Go / Gin / GORM / JWT
- **前台**：Vue 3 / TypeScript / Vite / Tailwind CSS
- **数据**：SQLite（开发）/ MySQL（生产）

## 写些什么

技术笔记、项目复盘、读书笔记，以及一些生活记录。

## 联系

有想聊的，欢迎在留言板留言，或者通过上面的链接找到我。
`

var defaultSiteContent = map[string]string{
	keySiteAboutContent: defaultAboutContent,
	keySiteBilibili:     "https://space.bilibili.com/24233835",
	keySiteGithub:       "https://github.com/ChibaRie",
	keySiteSteam:        "https://steamcommunity.com/id/chibarie-/",
	keySiteLocation:     "广东广州",
}

// EnsureDefaultSiteContent 首次启动时写入关于页与社交链接的初始值，并把旧的单张头图
// 升级为多图列表。只在键不存在时写入，不会覆盖用户后来改过的内容。
func EnsureDefaultSiteContent(db *gorm.DB) error {
	for key, value := range defaultSiteContent {
		var existing model.Setting
		err := db.Where(&model.Setting{Key: key}).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			setting := model.Setting{Key: key, Value: value}
			if createErr := db.Create(&setting).Error; createErr != nil {
				return createErr
			}
		}
	}

	// 头图从单张升级为多张：把已有单图包成数组，用户上传更多后自动进入轮播
	var heroList model.Setting
	err := db.Where(&model.Setting{Key: keySiteHeroBackgrounds}).First(&heroList).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		var single model.Setting
		if findErr := db.Where(&model.Setting{Key: keySiteHeroBackground}).First(&single).Error; findErr == nil && single.Value != "" {
			payload, marshalErr := json.Marshal([]string{single.Value})
			if marshalErr != nil {
				return marshalErr
			}
			setting := model.Setting{Key: keySiteHeroBackgrounds, Value: string(payload)}
			if createErr := db.Create(&setting).Error; createErr != nil {
				return createErr
			}
		}
	}

	return nil
}
