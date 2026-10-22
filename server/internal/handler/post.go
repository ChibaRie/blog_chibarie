package handler

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"blog-chibarie/server/internal/model"
	"blog-chibarie/server/pkg/markdown"
	"blog-chibarie/server/pkg/response"
	"blog-chibarie/server/pkg/text"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PostHandler struct {
	db *gorm.DB
}

func NewPostHandler(db *gorm.DB) *PostHandler {
	return &PostHandler{db: db}
}

type postQuery struct {
	Page       int
	PageSize   int
	Offset     int
	CategoryID uint
	TagID      uint
	Keyword    string
	OnlyPublic bool
	Sort       string
}

func (h *PostHandler) parseQuery(c *gin.Context, onlyPublic bool) postQuery {
	page, pageSize, offset := Pagination(c)
	return postQuery{
		Page:       page,
		PageSize:   pageSize,
		Offset:     offset,
		CategoryID: queryUint(c, "categoryId"),
		TagID:      queryUint(c, "tagId"),
		Keyword:    strings.TrimSpace(c.Query("keyword")),
		OnlyPublic: onlyPublic,
		Sort:       c.Query("sort"),
	}
}

func (q postQuery) apply(db *gorm.DB) *gorm.DB {
	if q.OnlyPublic {
		db = db.Where("status = ?", model.PostPublished)
	}
	if q.CategoryID > 0 {
		db = db.Where("category_id = ?", q.CategoryID)
	}
	if q.Keyword != "" {
		like := "%" + q.Keyword + "%"
		db = db.Where("title LIKE ? OR summary LIKE ? OR content LIKE ?", like, like, like)
	}
	if q.TagID > 0 {
		db = db.Where("id IN (?)",
			db.Table("post_tags").Select("post_id").Where("tag_id = ?", q.TagID))
	}

	switch q.Sort {
	case "views":
		db = db.Order("is_top DESC, views DESC, id DESC")
	case "oldest":
		db = db.Order("is_top DESC, COALESCE(published_at, created_at) ASC, id ASC")
	default:
		db = db.Order("is_top DESC, COALESCE(published_at, created_at) DESC, id DESC")
	}
	return db
}

func (h *PostHandler) List(c *gin.Context) {
	h.list(c, h.parseQuery(c, true))
}

func (h *PostHandler) AdminList(c *gin.Context) {
	h.list(c, h.parseQuery(c, false))
}

func (h *PostHandler) list(c *gin.Context, q postQuery) {
	var total int64
	if err := q.apply(h.db.Session(&gorm.Session{}).Model(&model.Post{})).Count(&total).Error; err != nil {
		response.ServerError(c, "统计文章数量失败")
		return
	}

	posts := make([]model.Post, 0)
	err := q.apply(h.db.Session(&gorm.Session{}).Model(&model.Post{})).
		Preload("Category").
		Preload("Tags").
		Limit(q.PageSize).
		Offset(q.Offset).
		Find(&posts).Error
	if err != nil {
		response.ServerError(c, "查询文章列表失败")
		return
	}

	for i := range posts {
		posts[i].Content = ""
		posts[i].ContentHTML = ""
	}

	response.Page(c, posts, total, q.Page, q.PageSize)
}

func (h *PostHandler) Detail(c *gin.Context) {
	post, err := h.findPost(c.Param("id"), true)
	if err != nil {
		response.NotFound(c, "文章不存在或尚未发布")
		return
	}

	h.db.Model(&model.Post{}).
		Where("id = ?", post.ID).
		UpdateColumn("views", gorm.Expr("views + 1"))
	post.Views++

	var commentCount int64
	h.db.Model(&model.Comment{}).
		Where("post_id = ? AND status = ?", post.ID, model.CommentApproved).
		Count(&commentCount)
	post.CommentCount = commentCount

	response.OK(c, post)
}

func (h *PostHandler) AdminDetail(c *gin.Context) {
	post, err := h.findPost(c.Param("id"), false)
	if err != nil {
		response.NotFound(c, "文章不存在")
		return
	}
	response.OK(c, post)
}

func (h *PostHandler) Like(c *gin.Context) {
	post, err := h.findPost(c.Param("id"), true)
	if err != nil {
		response.NotFound(c, "文章不存在")
		return
	}

	h.db.Model(&model.Post{}).
		Where("id = ?", post.ID).
		UpdateColumn("likes", gorm.Expr("likes + 1"))

	response.OK(c, gin.H{"id": post.ID, "likes": post.Likes + 1})
}

func (h *PostHandler) findPost(idOrSlug string, onlyPublic bool) (*model.Post, error) {
	query := h.db.Preload("Category").Preload("Tags")
	if onlyPublic {
		query = query.Where("status = ?", model.PostPublished)
	}

	var post model.Post
	var err error
	if n, convErr := strconv.ParseUint(idOrSlug, 10, 64); convErr == nil {
		err = query.First(&post, n).Error
	} else {
		err = query.Where("slug = ?", idOrSlug).First(&post).Error
	}
	if err != nil {
		return nil, err
	}
	return &post, nil
}

type postPayload struct {
	Title       string     `json:"title"`
	Slug        string     `json:"slug"`
	Summary     string     `json:"summary"`
	Content     string     `json:"content"`
	Cover       string     `json:"cover"`
	Status      string     `json:"status"`
	CategoryID  *uint      `json:"categoryId"`
	TagIDs      []uint     `json:"tagIds"`
	IsTop       bool       `json:"isTop"`
	PublishedAt *time.Time `json:"publishedAt"`
}

func (h *PostHandler) Create(c *gin.Context) {
	var req postPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数格式不正确")
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		response.BadRequest(c, "标题不能为空")
		return
	}

	status := normalizeStatus(req.Status)

	contentHTML, err := markdown.Render(req.Content)
	if err != nil {
		response.ServerError(c, "Markdown 解析失败")
		return
	}

	wordCount := text.CountWords(req.Content)
	summary := strings.TrimSpace(req.Summary)
	if summary == "" {
		summary = text.Summary(req.Content, 120)
	}

	post := model.Post{
		Title:       title,
		Slug:        h.uniqueSlug(req.Slug, title, 0),
		Summary:     summary,
		Content:     req.Content,
		ContentHTML: contentHTML,
		Cover:       strings.TrimSpace(req.Cover),
		Status:      status,
		CategoryID:  req.CategoryID,
		Tags:        h.resolveTags(req.TagIDs),
		WordCount:   wordCount,
		ReadingTime: text.ReadingTime(wordCount),
		IsTop:       req.IsTop,
	}

	if status == model.PostPublished {
		switch {
		case req.PublishedAt != nil:
			post.PublishedAt = req.PublishedAt
		case post.PublishedAt == nil:
			now := time.Now()
			post.PublishedAt = &now
		}
	}

	if err := h.db.Create(&post).Error; err != nil {
		response.ServerError(c, "保存文章失败")
		return
	}

	response.OK(c, post)
}

func (h *PostHandler) Update(c *gin.Context) {
	post, err := h.findPost(c.Param("id"), false)
	if err != nil {
		response.NotFound(c, "文章不存在")
		return
	}

	var req postPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数格式不正确")
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		response.BadRequest(c, "标题不能为空")
		return
	}

	contentHTML, err := markdown.Render(req.Content)
	if err != nil {
		response.ServerError(c, "Markdown 解析失败")
		return
	}

	wordCount := text.CountWords(req.Content)
	summary := strings.TrimSpace(req.Summary)
	if summary == "" {
		summary = text.Summary(req.Content, 120)
	}

	status := normalizeStatus(req.Status)

	post.Title = title
	post.Summary = summary
	post.Content = req.Content
	post.ContentHTML = contentHTML
	post.Cover = strings.TrimSpace(req.Cover)
	post.Status = status
	post.CategoryID = req.CategoryID
	post.WordCount = wordCount
	post.ReadingTime = text.ReadingTime(wordCount)
	post.IsTop = req.IsTop
	post.Slug = h.uniqueSlug(req.Slug, title, post.ID)

	if req.PublishedAt != nil {
		post.PublishedAt = req.PublishedAt
	} else if status == model.PostPublished && post.PublishedAt == nil {
		now := time.Now()
		post.PublishedAt = &now
	}

	tx := h.db.Begin()
	if err := tx.Save(post).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "更新文章失败")
		return
	}
	if err := tx.Model(post).Association("Tags").Replace(h.resolveTags(req.TagIDs)); err != nil {
		tx.Rollback()
		response.ServerError(c, "更新文章标签失败")
		return
	}
	tx.Commit()

	response.OK(c, post)
}

func (h *PostHandler) Delete(c *gin.Context) {
	post, err := h.findPost(c.Param("id"), false)
	if err != nil {
		response.NotFound(c, "文章不存在")
		return
	}

	tx := h.db.Begin()
	if err := tx.Model(post).Association("Tags").Clear(); err != nil {
		tx.Rollback()
		response.ServerError(c, "清除标签关联失败")
		return
	}
	if err := tx.Where("post_id = ?", post.ID).Delete(&model.Comment{}).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "删除关联评论失败")
		return
	}
	if err := tx.Delete(&model.Post{}, post.ID).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "删除文章失败")
		return
	}
	tx.Commit()

	response.OK(c, gin.H{"id": post.ID, "deleted": true})
}

func (h *PostHandler) resolveTags(tagIDs []uint) []model.Tag {
	if len(tagIDs) == 0 {
		return []model.Tag{}
	}
	tags := make([]model.Tag, 0, len(tagIDs))
	h.db.Where("id IN ?", tagIDs).Find(&tags)
	return tags
}

func (h *PostHandler) uniqueSlug(input, title string, excludeID uint) string {
	base := text.Slugify(input)
	if base == "" {
		base = text.Slugify(title)
	}
	if base == "" {
		base = "post-" + strconv.FormatInt(time.Now().Unix(), 36)
	}

	slug := base
	for i := 2; i <= 200; i++ {
		var count int64
		query := h.db.Model(&model.Post{}).Where("slug = ?", slug)
		if excludeID > 0 {
			query = query.Where("id <> ?", excludeID)
		}
		if err := query.Count(&count).Error; err != nil {
			break
		}
		if count == 0 {
			return slug
		}
		slug = fmt.Sprintf("%s-%d", base, i)
	}
	return fmt.Sprintf("%s-%s", base, strconv.FormatInt(time.Now().UnixNano(), 36))
}

func normalizeStatus(raw string) model.PostStatus {
	switch model.PostStatus(raw) {
	case model.PostDraft:
		return model.PostDraft
	case model.PostPublished:
		return model.PostPublished
	default:
		return model.PostPublished
	}
}
