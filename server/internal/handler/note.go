package handler

import (
	"strings"
	"time"

	"blog-chibarie/server/internal/model"
	"blog-chibarie/server/pkg/response"
	"blog-chibarie/server/pkg/text"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// 单条说说的内容长度上限。说说定位是「随手一写」，
// 真写长了应该去写文章——这里卡住而不是默默容忍。
const maxNoteLength = 2000

type NoteHandler struct {
	db *gorm.DB
}

func NewNoteHandler(db *gorm.DB) *NoteHandler {
	return &NoteHandler{db: db}
}

// fillCommentCounts 批量填充评论数，避免 N+1 查询。
func (h *NoteHandler) fillCommentCounts(notes []model.Note) {
	if len(notes) == 0 {
		return
	}

	ids := make([]uint, 0, len(notes))
	for _, n := range notes {
		ids = append(ids, n.ID)
	}

	type row struct {
		PostID uint
		Total  int64
	}
	rows := make([]row, 0)
	h.db.Model(&model.Comment{}).
		Select("post_id, COUNT(*) AS total").
		Where("type = ? AND status = ? AND post_id IN ?",
			model.CommentTypeNote, model.CommentApproved, ids).
		Group("post_id").
		Scan(&rows)

	counts := make(map[uint]int64, len(rows))
	for _, r := range rows {
		counts[r.PostID] = r.Total
	}
	for i := range notes {
		notes[i].CommentCount = counts[notes[i].ID]
	}
}

// ===== 公开接口 =====

func (h *NoteHandler) List(c *gin.Context) {
	page, pageSize, offset := Pagination(c)

	query := h.db.Model(&model.Note{}).Where("status = ?", model.PostPublished)

	var total int64
	if err := query.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		response.ServerError(c, "统计说说数量失败")
		return
	}

	notes := make([]model.Note, 0)
	// 用 COALESCE(published_at, created_at) 排序：老数据可能 published_at 为空，
	// 直接按它排会让这些说说全部沉底。
	err := query.Session(&gorm.Session{}).
		Order("COALESCE(published_at, created_at) DESC, id DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&notes).Error
	if err != nil {
		response.ServerError(c, "查询说说失败")
		return
	}

	h.fillCommentCounts(notes)
	response.Page(c, notes, total, page, pageSize)
}

func (h *NoteHandler) Detail(c *gin.Context) {
	note, err := h.findNote(c.Param("id"), true)
	if err != nil {
		response.NotFound(c, "说说不存在")
		return
	}

	h.fillCommentCounts([]model.Note{*note})

	response.OK(c, note)
}

func (h *NoteHandler) Like(c *gin.Context) {
	note, err := h.findNote(c.Param("id"), true)
	if err != nil {
		response.NotFound(c, "说说不存在")
		return
	}

	// 用表达式自增而不是先读后写，避免并发点赞丢更新
	h.db.Model(&model.Note{}).
		Where("id = ?", note.ID).
		UpdateColumn("likes", gorm.Expr("likes + 1"))

	response.OK(c, gin.H{"id": note.ID, "likes": note.Likes + 1})
}

func (h *NoteHandler) findNote(id string, onlyPublic bool) (*model.Note, error) {
	query := h.db.Model(&model.Note{})
	if onlyPublic {
		query = query.Where("status = ?", model.PostPublished)
	}

	var note model.Note
	if err := query.First(&note, id).Error; err != nil {
		return nil, err
	}
	return &note, nil
}

// ===== 后台接口 =====

func (h *NoteHandler) AdminList(c *gin.Context) {
	page, pageSize, offset := Pagination(c)

	query := h.db.Model(&model.Note{})
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	if err := query.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		response.ServerError(c, "统计说说数量失败")
		return
	}

	notes := make([]model.Note, 0)
	err := query.Session(&gorm.Session{}).
		Order("COALESCE(published_at, created_at) DESC, id DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&notes).Error
	if err != nil {
		response.ServerError(c, "查询说说失败")
		return
	}

	h.fillCommentCounts(notes)
	response.Page(c, notes, total, page, pageSize)
}

type notePayload struct {
	Content     string   `json:"content"`
	Images      []string `json:"images"`
	Status      string   `json:"status"`
	PublishedAt *string  `json:"publishedAt"`
}

// noteTimes 解析发布时间。前端传的是带时区偏移的 RFC3339，
// 传 null/空串表示「不动」（保持原值，新建时默认当前时间）。
func (h *NoteHandler) noteTimes(raw *string) (*time.Time, error) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*raw))
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func (h *NoteHandler) Create(c *gin.Context) {
	var req notePayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数格式不正确")
		return
	}

	content := strings.TrimSpace(req.Content)
	if content == "" {
		response.BadRequest(c, "说说内容不能为空")
		return
	}
	if len([]rune(content)) > maxNoteLength {
		response.BadRequest(c, "说说不能超过 2000 字")
		return
	}

	publishedAt, err := h.noteTimes(req.PublishedAt)
	if err != nil {
		response.BadRequest(c, "发布时间格式不正确")
		return
	}

	status := normalizeStatus(req.Status)
	note := model.Note{
		Content: content,
		Status:  status,
	}
	if err := note.SetImages(req.Images); err != nil {
		response.ServerError(c, "处理图片列表失败")
		return
	}

	if status == model.PostPublished {
		if publishedAt != nil {
			note.PublishedAt = publishedAt
		} else {
			now := time.Now()
			note.PublishedAt = &now
		}
	} else if publishedAt != nil {
		note.PublishedAt = publishedAt
	}

	if err := h.db.Create(&note).Error; err != nil {
		response.ServerError(c, "保存说说失败")
		return
	}

	response.OK(c, note)
}

func (h *NoteHandler) Update(c *gin.Context) {
	note, err := h.findNote(c.Param("id"), false)
	if err != nil {
		response.NotFound(c, "说说不存在")
		return
	}

	var req notePayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数格式不正确")
		return
	}

	content := strings.TrimSpace(req.Content)
	if content == "" {
		response.BadRequest(c, "说说内容不能为空")
		return
	}
	if len([]rune(content)) > maxNoteLength {
		response.BadRequest(c, "说说不能超过 2000 字")
		return
	}

	publishedAt, err := h.noteTimes(req.PublishedAt)
	if err != nil {
		response.BadRequest(c, "发布时间格式不正确")
		return
	}
	status := normalizeStatus(req.Status)

	note.Content = content
	note.Status = status
	if err := note.SetImages(req.Images); err != nil {
		response.ServerError(c, "处理图片列表失败")
		return
	}

	// 传 null 表示不动：已发布的保留原值，草稿等真正发布时才填当前时间
	if publishedAt != nil {
		note.PublishedAt = publishedAt
	} else if status == model.PostPublished && note.PublishedAt == nil {
		now := time.Now()
		note.PublishedAt = &now
	}

	if err := h.db.Save(note).Error; err != nil {
		response.ServerError(c, "更新说说失败")
		return
	}

	response.OK(c, note)
}

func (h *NoteHandler) Delete(c *gin.Context) {
	note, err := h.findNote(c.Param("id"), false)
	if err != nil {
		response.NotFound(c, "说说不存在")
		return
	}

	tx := h.db.Begin()
	// 说说删了，挂在它下面的评论就没有宿主了，一并清掉，
	// 否则这些评论会在后台评论管理里变成找不到来源的孤儿记录
	if err := tx.Where("type = ? AND post_id = ?", model.CommentTypeNote, note.ID).
		Delete(&model.Comment{}).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "删除关联评论失败")
		return
	}
	if err := tx.Delete(&model.Note{}, note.ID).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "删除说说失败")
		return
	}
	tx.Commit()

	response.OK(c, gin.H{"id": note.ID, "deleted": true})
}

// 说说正文只是短文本，字数统计直接复用 text 包，
// 让后台列表能显示每条的字数，和文章保持同一套口径。
func noteWordCount(content string) int {
	return text.CountWords(content)
}
