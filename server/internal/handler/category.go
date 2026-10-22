package handler

import (
	"strings"

	"blog-chibarie/server/internal/model"
	"blog-chibarie/server/pkg/response"
	"blog-chibarie/server/pkg/text"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CategoryHandler struct {
	db *gorm.DB
}

func NewCategoryHandler(db *gorm.DB) *CategoryHandler {
	return &CategoryHandler{db: db}
}

func (h *CategoryHandler) List(c *gin.Context) {
	categories := make([]model.Category, 0)
	if err := h.db.Order("sort ASC, id ASC").Find(&categories).Error; err != nil {
		response.ServerError(c, "查询分类失败")
		return
	}

	counts := h.postCounts(categories)
	for i := range categories {
		categories[i].PostCount = counts[categories[i].ID]
	}

	response.OK(c, categories)
}

func (h *CategoryHandler) postCounts(categories []model.Category) map[uint]int64 {
	if len(categories) == 0 {
		return nil
	}

	var rows []struct {
		CategoryID uint
		Total      int64
	}
	h.db.Model(&model.Post{}).
		Select("category_id, COUNT(*) AS total").
		Where("status = ? AND category_id IS NOT NULL", model.PostPublished).
		Group("category_id").
		Scan(&rows)

	counts := make(map[uint]int64, len(rows))
	for _, r := range rows {
		counts[r.CategoryID] = r.Total
	}
	return counts
}

type categoryPayload struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Sort        int    `json:"sort"`
}

func (h *CategoryHandler) Create(c *gin.Context) {
	var req categoryPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数格式不正确")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		response.BadRequest(c, "分类名称不能为空")
		return
	}

	var exists int64
	h.db.Model(&model.Category{}).Where("name = ?", name).Count(&exists)
	if exists > 0 {
		response.BadRequest(c, "该分类已存在")
		return
	}

	category := model.Category{
		Name:        name,
		Slug:        text.Slug(req.Slug, name),
		Description: strings.TrimSpace(req.Description),
		Sort:        req.Sort,
	}

	if err := h.db.Create(&category).Error; err != nil {
		response.ServerError(c, "创建分类失败")
		return
	}
	response.OK(c, category)
}

func (h *CategoryHandler) Update(c *gin.Context) {
	var category model.Category
	if err := h.db.First(&category, c.Param("id")).Error; err != nil {
		response.NotFound(c, "分类不存在")
		return
	}

	var req categoryPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数格式不正确")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		response.BadRequest(c, "分类名称不能为空")
		return
	}

	category.Name = name
	category.Slug = text.Slug(req.Slug, name)
	category.Description = strings.TrimSpace(req.Description)
	category.Sort = req.Sort

	if err := h.db.Save(&category).Error; err != nil {
		response.ServerError(c, "更新分类失败")
		return
	}
	response.OK(c, category)
}

func (h *CategoryHandler) Delete(c *gin.Context) {
	var category model.Category
	if err := h.db.First(&category, c.Param("id")).Error; err != nil {
		response.NotFound(c, "分类不存在")
		return
	}

	var total int64
	h.db.Model(&model.Post{}).Where("category_id = ?", category.ID).Count(&total)
	if total > 0 {
		response.BadRequest(c, "该分类下还有文章，请先移动或删除这些文章")
		return
	}

	if err := h.db.Delete(&model.Category{}, category.ID).Error; err != nil {
		response.ServerError(c, "删除分类失败")
		return
	}
	response.OK(c, gin.H{"id": category.ID, "deleted": true})
}
