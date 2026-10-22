package handler

import (
	"strings"

	"blog-chibarie/server/internal/model"
	"blog-chibarie/server/pkg/response"
	"blog-chibarie/server/pkg/text"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type TagHandler struct {
	db *gorm.DB
}

func NewTagHandler(db *gorm.DB) *TagHandler {
	return &TagHandler{db: db}
}

func (h *TagHandler) List(c *gin.Context) {
	tags := make([]model.Tag, 0)
	if err := h.db.Order("id ASC").Find(&tags).Error; err != nil {
		response.ServerError(c, "查询标签失败")
		return
	}

	if len(tags) > 0 {
		var rows []struct {
			TagID uint
			Total int64
		}
		h.db.Table("post_tags").
			Select("post_tags.tag_id AS tag_id, COUNT(*) AS total").
			Joins("JOIN posts ON posts.id = post_tags.post_id").
			Where("posts.status = ?", model.PostPublished).
			Group("post_tags.tag_id").
			Scan(&rows)

		counts := make(map[uint]int64, len(rows))
		for _, r := range rows {
			counts[r.TagID] = r.Total
		}
		for i := range tags {
			tags[i].PostCount = counts[tags[i].ID]
		}
	}

	response.OK(c, tags)
}

type tagPayload struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
}

func (h *TagHandler) Create(c *gin.Context) {
	var req tagPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数格式不正确")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		response.BadRequest(c, "标签名称不能为空")
		return
	}

	var exists int64
	h.db.Model(&model.Tag{}).Where("name = ?", name).Count(&exists)
	if exists > 0 {
		response.BadRequest(c, "该标签已存在")
		return
	}

	tag := model.Tag{
		Name: name,
		Slug: text.Slug(req.Slug, name),
	}

	if err := h.db.Create(&tag).Error; err != nil {
		response.ServerError(c, "创建标签失败")
		return
	}
	response.OK(c, tag)
}

func (h *TagHandler) Update(c *gin.Context) {
	var tag model.Tag
	if err := h.db.First(&tag, c.Param("id")).Error; err != nil {
		response.NotFound(c, "标签不存在")
		return
	}

	var req tagPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数格式不正确")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		response.BadRequest(c, "标签名称不能为空")
		return
	}

	tag.Name = name
	tag.Slug = text.Slug(req.Slug, name)

	if err := h.db.Save(&tag).Error; err != nil {
		response.ServerError(c, "更新标签失败")
		return
	}
	response.OK(c, tag)
}

func (h *TagHandler) Delete(c *gin.Context) {
	var tag model.Tag
	if err := h.db.First(&tag, c.Param("id")).Error; err != nil {
		response.NotFound(c, "标签不存在")
		return
	}

	if err := h.db.Exec("DELETE FROM post_tags WHERE tag_id = ?", tag.ID).Error; err != nil {
		response.ServerError(c, "清除标签关联失败")
		return
	}
	if err := h.db.Delete(&model.Tag{}, tag.ID).Error; err != nil {
		response.ServerError(c, "删除标签失败")
		return
	}
	response.OK(c, gin.H{"id": tag.ID, "deleted": true})
}
