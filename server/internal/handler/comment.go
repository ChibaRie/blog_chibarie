package handler

import (
	"regexp"
	"strings"

	"blog-chibarie/server/internal/model"
	"blog-chibarie/server/pkg/response"
	"blog-chibarie/server/pkg/text"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CommentHandler struct {
	db *gorm.DB
}

func NewCommentHandler(db *gorm.DB) *CommentHandler {
	return &CommentHandler{db: db}
}

type commentPayload struct {
	PostID   uint   `json:"postId"`
	NoteID   uint   `json:"noteId"`
	ParentID *uint  `json:"parentId"`
	Nickname string `json:"nickname"`
	Email    string `json:"email"`
	Website  string `json:"website"`
	Content  string `json:"content"`
}

func (h *CommentHandler) Create(c *gin.Context) {
	var req commentPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数格式不正确")
		return
	}

	nickname := strings.TrimSpace(req.Nickname)
	content := strings.TrimSpace(req.Content)
	if nickname == "" {
		response.BadRequest(c, "请填写昵称")
		return
	}
	if content == "" {
		response.BadRequest(c, "评论内容不能为空")
		return
	}
	if len([]rune(content)) > 1000 {
		response.BadRequest(c, "评论内容不能超过 1000 字")
		return
	}

	// 评论宿主：文章（post）或说说（note）。
	// 两者共用 Comment 表，靠 type 区分，hostID 落到 PostID 字段上。
	commentType := model.CommentTypePost
	hostID := req.PostID
	if hostID == 0 && req.NoteID > 0 {
		commentType = model.CommentTypeNote
		hostID = req.NoteID
	}
	if hostID == 0 {
		response.BadRequest(c, "缺少评论目标")
		return
	}

	// 宿主存在性校验。
	// 注意这里必须用 Count 而不是 First(&host)：First 的目标变量是 model.Post，
	// GORM 会按目标变量推断表名（posts），Model(&model.Note{}) 会被忽略掉，
	// 结果就是拿 notes.id 去 posts 里查，永远查不到、永远报「说说不存在」。
	// Count 只认 Model()，不会被目标变量带偏。
	hostModel := h.db.Model(&model.Post{})
	notFoundMessage := "文章不存在"
	if commentType == model.CommentTypeNote {
		hostModel = h.db.Model(&model.Note{})
		notFoundMessage = "说说不存在"
	}

	var hostCount int64
	if err := hostModel.
		Where("id = ? AND status = ?", hostID, model.PostPublished).
		Count(&hostCount).Error; err != nil || hostCount == 0 {
		response.NotFound(c, notFoundMessage)
		return
	}

	if req.ParentID != nil && *req.ParentID > 0 {
		var parentCount int64
		h.db.Model(&model.Comment{}).
			Where("id = ? AND type = ? AND post_id = ?", *req.ParentID, commentType, hostID).
			Count(&parentCount)
		if parentCount == 0 {
			response.BadRequest(c, "回复的评论不存在")
			return
		}
	} else {
		req.ParentID = nil
	}

	comment := model.Comment{
		Type:      commentType,
		PostID:    hostID,
		ParentID:  req.ParentID,
		Nickname:  nickname,
		Email:     strings.TrimSpace(req.Email),
		Website:   strings.TrimSpace(req.Website),
		Content:   content,
		Status:    model.CommentPending,
		IP:        c.ClientIP(),
		UserAgent: c.GetHeader("User-Agent"),
	}

	if err := h.db.Create(&comment).Error; err != nil {
		response.ServerError(c, "提交评论失败")
		return
	}

	response.OK(c, gin.H{
		"id":      comment.ID,
		"status":  comment.Status,
		"message": "评论已提交，通过审核后展示",
	})
}

// ListByHost 同时服务文章评论与说说评论：按 type + postId 取已审核评论树。
func (h *CommentHandler) ListByHost(c *gin.Context) {
	hostID := queryUint(c, "postId")
	commentType := model.CommentType(strings.TrimSpace(c.Query("type")))
	if commentType != model.CommentTypeNote {
		commentType = model.CommentTypePost
	}
	if hostID == 0 {
		response.BadRequest(c, "缺少 postId 参数")
		return
	}

	comments := make([]model.Comment, 0)
	err := h.db.
		Where("type = ? AND post_id = ? AND status = ?",
			commentType, hostID, model.CommentApproved).
		Order("created_at ASC").
		Find(&comments).Error
	if err != nil {
		response.ServerError(c, "查询评论失败")
		return
	}

	response.OK(c, gin.H{
		"list":  buildCommentTree(comments),
		"total": len(comments),
	})
}

// ===== 留言板 =====
// 与文章评论共用 Comment 表：type=guestbook，post_id 固定为 0。
// 留言者只需填邮箱，展示昵称由邮箱前缀派生；完整邮箱只在后台可见（模型里是 json:"-"）。

var emailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

type guestbookPayload struct {
	Email   string `json:"email"`
	Content string `json:"content"`
}

func nicknameFromEmail(email string) string {
	name := email
	if idx := strings.Index(email, "@"); idx > 0 {
		name = email[:idx]
	}
	name = strings.TrimSpace(name)

	runes := []rune(name)
	if len(runes) == 0 {
		return "访客"
	}
	if len(runes) > 24 {
		return string(runes[:24])
	}
	return name
}

func (h *CommentHandler) GuestbookCreate(c *gin.Context) {
	var req guestbookPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数格式不正确")
		return
	}

	email := strings.TrimSpace(req.Email)
	content := strings.TrimSpace(req.Content)

	if email == "" {
		response.BadRequest(c, "请填写邮箱")
		return
	}
	if len([]rune(email)) > 128 || !emailPattern.MatchString(email) {
		response.BadRequest(c, "邮箱格式不正确")
		return
	}
	if content == "" {
		response.BadRequest(c, "留言内容不能为空")
		return
	}
	if len([]rune(content)) > 500 {
		response.BadRequest(c, "留言不能超过 500 字")
		return
	}

	message := model.Comment{
		Type:      model.CommentTypeGuestbook,
		PostID:    0,
		Nickname:  nicknameFromEmail(email),
		Email:     email,
		Content:   content,
		Status:    model.CommentPending,
		IP:        c.ClientIP(),
		UserAgent: c.GetHeader("User-Agent"),
	}

	if err := h.db.Create(&message).Error; err != nil {
		response.ServerError(c, "留言提交失败")
		return
	}

	response.OK(c, gin.H{
		"id":      message.ID,
		"status":  message.Status,
		"message": "留言已提交，通过审核后展示",
	})
}

func (h *CommentHandler) GuestbookList(c *gin.Context) {
	page, pageSize, offset := Pagination(c)

	query := h.db.Model(&model.Comment{}).
		Where("type = ? AND status = ?", model.CommentTypeGuestbook, model.CommentApproved)

	var total int64
	if err := query.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		response.ServerError(c, "查询留言失败")
		return
	}

	messages := make([]model.Comment, 0)
	err := query.Session(&gorm.Session{}).
		Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&messages).Error
	if err != nil {
		response.ServerError(c, "查询留言失败")
		return
	}

	response.Page(c, messages, total, page, pageSize)
}

func (h *CommentHandler) AdminList(c *gin.Context) {
	page, pageSize, offset := Pagination(c)

	query := h.db.Model(&model.Comment{})
	if postID := queryUint(c, "postId"); postID > 0 {
		query = query.Where("post_id = ?", postID)
	}
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		query = query.Where("status = ?", status)
	}
	if commentType := strings.TrimSpace(c.Query("type")); commentType != "" {
		query = query.Where("type = ?", commentType)
	}

	var total int64
	if err := query.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		response.ServerError(c, "统计评论数量失败")
		return
	}

	comments := make([]model.Comment, 0)
	err := query.Session(&gorm.Session{}).
		Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&comments).Error
	if err != nil {
		response.ServerError(c, "查询评论失败")
		return
	}

	type postBrief struct {
		ID    uint   `json:"id"`
		Title string `json:"title"`
	}
	// 评论宿主可能是文章或说说，分别查标题做展示。
	// 说说没有标题，用正文前 20 字当标识，免得后台只显示一个空字符串。
	titles := make(map[uint]string)
	if len(comments) > 0 {
		postIDs := make([]uint, 0, len(comments))
		noteIDs := make([]uint, 0, len(comments))
		for _, cm := range comments {
			if cm.Type == model.CommentTypeNote {
				noteIDs = append(noteIDs, cm.PostID)
			} else {
				postIDs = append(postIDs, cm.PostID)
			}
		}
		if len(postIDs) > 0 {
			briefs := make([]postBrief, 0)
			h.db.Model(&model.Post{}).Select("id, title").Where("id IN ?", postIDs).Scan(&briefs)
			for _, b := range briefs {
				titles[b.ID] = b.Title
			}
		}
		if len(noteIDs) > 0 {
			notes := make([]model.Note, 0)
			h.db.Select("id, content").Where("id IN ?", noteIDs).Find(&notes)
			for _, n := range notes {
				titles[n.ID] = text.Summary(n.Content, 20)
			}
		}
	}

	type commentItem struct {
		model.Comment
		PostTitle string `json:"postTitle"`
	}
	items := make([]commentItem, 0, len(comments))
	for _, cm := range comments {
		items = append(items, commentItem{Comment: cm, PostTitle: titles[cm.PostID]})
	}

	response.Page(c, items, total, page, pageSize)
}

type commentStatusPayload struct {
	Status string `json:"status"`
}

func (h *CommentHandler) UpdateStatus(c *gin.Context) {
	var comment model.Comment
	if err := h.db.First(&comment, c.Param("id")).Error; err != nil {
		response.NotFound(c, "评论不存在")
		return
	}

	var req commentStatusPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数格式不正确")
		return
	}

	status := model.CommentStatus(strings.TrimSpace(req.Status))
	switch status {
	case model.CommentApproved, model.CommentRejected, model.CommentPending:
	default:
		response.BadRequest(c, "状态值不合法")
		return
	}

	if err := h.db.Model(&comment).Update("status", status).Error; err != nil {
		response.ServerError(c, "更新评论状态失败")
		return
	}

	response.OK(c, gin.H{"id": comment.ID, "status": status})
}

func (h *CommentHandler) Delete(c *gin.Context) {
	var comment model.Comment
	if err := h.db.First(&comment, c.Param("id")).Error; err != nil {
		response.NotFound(c, "评论不存在")
		return
	}

	if err := h.db.Where("parent_id = ?", comment.ID).Delete(&model.Comment{}).Error; err != nil {
		response.ServerError(c, "删除子评论失败")
		return
	}
	if err := h.db.Delete(&model.Comment{}, comment.ID).Error; err != nil {
		response.ServerError(c, "删除评论失败")
		return
	}

	response.OK(c, gin.H{"id": comment.ID, "deleted": true})
}

func buildCommentTree(comments []model.Comment) []*model.Comment {
	index := make(map[uint]*model.Comment, len(comments))
	ordered := make([]*model.Comment, 0, len(comments))

	for i := range comments {
		comments[i].Children = []*model.Comment{}
		node := &comments[i]
		index[node.ID] = node
		ordered = append(ordered, node)
	}

	roots := make([]*model.Comment, 0, len(comments))
	for _, node := range ordered {
		if node.ParentID != nil {
			if parent, ok := index[*node.ParentID]; ok && parent.ID != node.ID {
				parent.Children = append(parent.Children, node)
				continue
			}
		}
		roots = append(roots, node)
	}

	return roots
}
