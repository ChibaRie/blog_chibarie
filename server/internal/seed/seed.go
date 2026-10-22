package seed

import (
	"log"
	"time"

	"blog-chibarie/server/internal/model"
	"blog-chibarie/server/pkg/hash"
	"blog-chibarie/server/pkg/markdown"
	"blog-chibarie/server/pkg/text"

	"gorm.io/gorm"
)

const (
	defaultAdminUser     = "admin"
	defaultAdminPassword = "admin123"
)

func Run(db *gorm.DB) error {
	if err := seedAdmin(db); err != nil {
		return err
	}
	if err := seedCategories(db); err != nil {
		return err
	}
	if err := seedTags(db); err != nil {
		return err
	}
	if err := seedPosts(db); err != nil {
		return err
	}
	return seedFriendLinks(db)
}

func seedAdmin(db *gorm.DB) error {
	var count int64
	if err := db.Model(&model.User{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	hashed, err := hash.Password(defaultAdminPassword)
	if err != nil {
		return err
	}

	admin := model.User{
		Username: defaultAdminUser,
		Password: hashed,
		Nickname: "chibarie",
		Role:     "admin",
		Bio:      "记录技术与生活",
	}
	if err := db.Create(&admin).Error; err != nil {
		return err
	}

	log.Printf("[seed] 已创建默认管理员：%s / %s（请尽快登录后台修改密码）",
		defaultAdminUser, defaultAdminPassword)
	return nil
}

type categorySeed struct {
	Name        string
	Slug        string
	Description string
	Sort        int
}

var categories = []categorySeed{
	{Name: "技术笔记", Slug: "tech", Description: "语言、框架与工程实践的记录", Sort: 1},
	{Name: "项目复盘", Slug: "projects", Description: "做过的项目与踩过的坑", Sort: 2},
	{Name: "生活随笔", Slug: "life", Description: "日常、阅读与碎碎念", Sort: 3},
}

func seedCategories(db *gorm.DB) error {
	var count int64
	if err := db.Model(&model.Category{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	items := make([]model.Category, 0, len(categories))
	for _, c := range categories {
		items = append(items, model.Category{
			Name:        c.Name,
			Slug:        c.Slug,
			Description: c.Description,
			Sort:        c.Sort,
		})
	}
	return db.Create(&items).Error
}

var tagNames = []string{"Go", "Vue", "TypeScript", "后端", "前端", "数据库", "踩坑", "随笔"}

func seedTags(db *gorm.DB) error {
	var count int64
	if err := db.Model(&model.Tag{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	items := make([]model.Tag, 0, len(tagNames))
	for _, name := range tagNames {
		items = append(items, model.Tag{Name: name, Slug: text.Slugify(name)})
	}
	return db.Create(&items).Error
}

type postSeed struct {
	Title    string
	Slug     string
	Category string
	Tags     []string
	DaysAgo  int
	IsTop    bool
	Content  string
}

func seedPosts(db *gorm.DB) error {
	var count int64
	if err := db.Model(&model.Post{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	categoryMap := map[string]uint{}
	var cats []model.Category
	db.Find(&cats)
	for _, c := range cats {
		categoryMap[c.Slug] = c.ID
	}

	tagMap := map[string]uint{}
	var tags []model.Tag
	db.Find(&tags)
	for _, t := range tags {
		tagMap[t.Name] = t.ID
	}

	for _, item := range posts {
		html, err := markdown.Render(item.Content)
		if err != nil {
			return err
		}

		wordCount := text.CountWords(item.Content)
		published := time.Now().AddDate(0, 0, -item.DaysAgo)

		var categoryID *uint
		if id, ok := categoryMap[item.Category]; ok {
			categoryID = &id
		}

		post := model.Post{
			Title:       item.Title,
			Slug:        item.Slug,
			Summary:     text.Summary(item.Content, 120),
			Content:     item.Content,
			ContentHTML: html,
			Status:      model.PostPublished,
			CategoryID:  categoryID,
			WordCount:   wordCount,
			ReadingTime: text.ReadingTime(wordCount),
			IsTop:       item.IsTop,
			PublishedAt: &published,
		}
		if err := db.Create(&post).Error; err != nil {
			return err
		}

		linked := make([]model.Tag, 0, len(item.Tags))
		for _, name := range item.Tags {
			if id, ok := tagMap[name]; ok {
				linked = append(linked, model.Tag{ID: id})
			}
		}
		if len(linked) > 0 {
			if err := db.Model(&post).Association("Tags").Replace(linked); err != nil {
				return err
			}
		}
	}

	log.Printf("[seed] 已写入 %d 篇示例文章", len(posts))
	return nil
}

// seedFriendLinks 写两条真实存在的博客作为示例友链，让友链页首次打开不空着。
// 只在表为空时执行，用户之后在后台改删都不受影响。头像留空，
// 前台会用「首字母 + 渐变」的占位头像，避免依赖第三方 favicon 服务（国内不稳）。
func seedFriendLinks(db *gorm.DB) error {
	var count int64
	if err := db.Model(&model.FriendLink{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	links := []model.FriendLink{
		{
			Name:        "阮一峰的网络日志",
			URL:         "https://www.ruanyifeng.com/blog/",
			Description: "科技爱好者周刊，每周四更新",
			Sort:        10,
		},
		{
			Name:        "云风的 BLOG",
			URL:         "https://blog.codingnow.com/",
			Description: "游戏引擎与编程随笔",
			Sort:        20,
		},
	}
	if err := db.Create(&links).Error; err != nil {
		return err
	}
	log.Printf("[seed] 已写入 %d 条示例友链", len(links))
	return nil
}
