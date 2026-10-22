package handler

import (
	"net/url"
	"strings"

	"blog-chibarie/server/internal/model"
	"blog-chibarie/server/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type LinkHandler struct {
	db *gorm.DB
}

func NewLinkHandler(db *gorm.DB) *LinkHandler {
	return &LinkHandler{db: db}
}

// List 公开接口：友链页用。Sort 升序，同序号的按创建先后。
func (h *LinkHandler) List(c *gin.Context) {
	links := make([]model.FriendLink, 0)
	if err := h.db.Order("sort ASC, id ASC").Find(&links).Error; err != nil {
		response.ServerError(c, "查询友链失败")
		return
	}
	response.OK(c, links)
}

type linkPayload struct {
	Name        string `json:"name"`
	URL         string `json:"url"`
	Avatar      string `json:"avatar"`
	Description string `json:"description"`
	Sort        *int   `json:"sort"`
}

func (p *linkPayload) normalize() string {
	// 链接没写协议时补 https://，后台少打一截、前台 a 标签也不会变成相对路径
	u := strings.TrimSpace(p.URL)
	if u != "" && !strings.Contains(u, "://") {
		u = "https://" + u
	}
	return u
}

func (p *linkPayload) validate() (string, bool) {
	if strings.TrimSpace(p.Name) == "" {
		return "名称不能为空", false
	}
	u := p.normalize()
	if u == "" {
		return "链接不能为空", false
	}
	parsed, err := url.Parse(u)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return "链接格式不正确，应形如 https://example.com", false
	}
	return "", true
}

func (p *linkPayload) applyTo(link *model.FriendLink) {
	link.Name = strings.TrimSpace(p.Name)
	link.URL = p.normalize()
	link.Avatar = strings.TrimSpace(p.Avatar)
	link.Description = strings.TrimSpace(p.Description)
	if p.Sort != nil {
		link.Sort = *p.Sort
	}
}

func (h *LinkHandler) Create(c *gin.Context) {
	var req linkPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数格式不正确")
		return
	}
	if msg, ok := req.validate(); !ok {
		response.BadRequest(c, msg)
		return
	}
	if req.Sort == nil {
		// 未指定排序时默认排到最后（间隔 10，方便中间插队）
		var maxSort int
		h.db.Model(&model.FriendLink{}).Select("COALESCE(MAX(sort), 0)").Scan(&maxSort)
		req.Sort = intPtr(maxSort + 10)
	}

	link := model.FriendLink{}
	req.applyTo(&link)
	if err := h.db.Create(&link).Error; err != nil {
		response.ServerError(c, "保存友链失败")
		return
	}
	response.OK(c, link)
}

func (h *LinkHandler) Update(c *gin.Context) {
	var link model.FriendLink
	if err := h.db.First(&link, c.Param("id")).Error; err != nil {
		response.NotFound(c, "友链不存在")
		return
	}

	var req linkPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数格式不正确")
		return
	}
	if msg, ok := req.validate(); !ok {
		response.BadRequest(c, msg)
		return
	}

	req.applyTo(&link)
	if err := h.db.Save(&link).Error; err != nil {
		response.ServerError(c, "更新友链失败")
		return
	}
	response.OK(c, link)
}

func (h *LinkHandler) Delete(c *gin.Context) {
	res := h.db.Delete(&model.FriendLink{}, c.Param("id"))
	if res.Error != nil {
		response.ServerError(c, "删除友链失败")
		return
	}
	if res.RowsAffected == 0 {
		response.NotFound(c, "友链不存在")
		return
	}
	response.OK(c, gin.H{"deleted": true})
}

func intPtr(v int) *int { return &v }
