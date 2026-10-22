package seed

var posts = []postSeed{
	{
		Title:    "你好，世界",
		Slug:     "hello-world",
		Category: "life",
		Tags:     []string{"随笔"},
		DaysAgo:  1,
		IsTop:    true,
		Content: "# 你好，世界\n\n" +
			"折腾了几天，博客终于跑起来了。\n\n" +
			"## 为什么想写博客\n\n" +
			"理由其实很朴素：**把学到的东西讲清楚，才知道自己是不是真懂了**。\n\n" +
			"看教程的时候总觉得自己会了，真动手写起来才发现到处是坑。" +
			"写下来逼着自己把逻辑理顺，顺便留个记录，以后再遇到同样的问题就不必重新踩一遍。\n\n" +
			"## 这里会写什么\n\n" +
			"- 技术笔记：Go、前端、数据库，以及各种踩过的坑\n" +
			"- 项目复盘：做过的项目，哪里做得好，哪里做得烂\n" +
			"- 生活随笔：读书、天气，还有一些没什么用的碎碎念\n\n" +
			"## 关于这个博客\n\n" +
			"前后端分离，后端是 Go + Gin + GORM，前端是 Vue 3 + TypeScript。" +
			"风格上参考了几个喜欢的站点，做成了现在这个样子。\n\n" +
			"> 慢一点没关系，写下去就行。\n\n" +
			"欢迎常来。\n",
	},
	{
		Title:    "Go 并发入门：goroutine 与 channel",
		Slug:     "go-concurrency-basics",
		Category: "tech",
		Tags:     []string{"Go", "后端"},
		DaysAgo:  6,
		Content: "# Go 并发入门：goroutine 与 channel\n\n" +
			"Go 最让人上头的地方就是并发。启动一个 goroutine 只要一个关键字，比开线程轻太多。\n\n" +
			"## 启动 goroutine\n\n" +
			"```go\n" +
			"func main() {\n" +
			"    go func() {\n" +
			"        fmt.Println(\"我在另一个 goroutine 里\")\n" +
			"    }()\n" +
			"    time.Sleep(time.Second)\n" +
			"}\n" +
			"```\n\n" +
			"注意那个 `time.Sleep`。main 函数一旦返回，所有 goroutine 都会被直接掐掉，" +
			"所以这里必须等一等。但用 sleep 来同步是很糟糕的做法——正确的方式是 channel。\n\n" +
			"## 用 channel 通信\n\n" +
			"Go 的信条是：**不要通过共享内存来通信，而要通过通信来共享内存。**\n\n" +
			"```go\n" +
			"func worker(id int, jobs <-chan int, results chan<- int) {\n" +
			"    for job := range jobs {\n" +
			"        results <- job * job\n" +
			"    }\n" +
			"}\n" +
			"```\n\n" +
			"`<-chan` 是只读，`chan<-` 是只写。类型系统直接把「谁能读谁能写」写死在签名里，" +
			"想写错都难。\n\n" +
			"## 一个容易踩的坑\n\n" +
			"无缓冲 channel 的发送和接收是**同时阻塞**的。下面这段代码会死锁：\n\n" +
			"```go\n" +
			"ch := make(chan int)\n" +
			"ch <- 1      // 阻塞在这里，没人接收\n" +
			"fmt.Println(<-ch)\n" +
			"```\n\n" +
			"解决办法是要么开个 goroutine，要么给 channel 加缓冲：`make(chan int, 1)`。\n\n" +
			"## 小结\n\n" +
			"- `go` 关键字启动 goroutine，开销极小\n" +
			"- channel 是 goroutine 之间的通信管道\n" +
			"- 无缓冲 channel 会阻塞，注意别写出死锁\n\n" +
			"下一节写 `select` 和 `context`，那才是真正处理超时和取消的地方。\n",
	},
	{
		Title:    "用 Vue 3 组合式 API 写一个文章列表",
		Slug:     "vue3-composition-api-post-list",
		Category: "tech",
		Tags:     []string{"Vue", "前端", "TypeScript"},
		DaysAgo:  12,
		Content: "# 用 Vue 3 组合式 API 写一个文章列表\n\n" +
			"组合式 API 刚出来的时候我不太习惯，写多了才发现它最大的好处是" +
			"**逻辑可以按功能聚合，而不是按选项类型散落**。\n\n" +
			"## 把数据请求抽成 composable\n\n" +
			"先写一个通用的请求 hook：\n\n" +
			"```ts\n" +
			"export function usePosts(params: Ref<PostQuery>) {\n" +
			"  const list = ref<Post[]>([])\n" +
			"  const total = ref(0)\n" +
			"  const loading = ref(false)\n\n" +
			"  async function load() {\n" +
			"    loading.value = true\n" +
			"    try {\n" +
			"      const res = await api.getPosts(params.value)\n" +
			"      list.value = res.list\n" +
			"      total.value = res.total\n" +
			"    } finally {\n" +
			"      loading.value = false\n" +
			"    }\n" +
			"  }\n\n" +
			"  watch(params, load, { immediate: true })\n" +
			"  return { list, total, loading, reload: load }\n" +
			"}\n" +
			"```\n\n" +
			"`watch` 加上 `immediate: true`，参数一变自动重新请求，组件里就不用到处手写 watch 了。\n\n" +
			"## 组件里就很干净\n\n" +
			"```vue\n" +
			"<script setup lang=\"ts\">\n" +
			"const params = reactive({ page: 1, pageSize: 10, keyword: '' })\n" +
			"const { list, total, loading } = usePosts(toRef(params))\n" +
			"</script>\n" +
			"```\n\n" +
			"模板里只管渲染，逻辑都在 composable 里，测试也好写。\n\n" +
			"## 几个细节\n\n" +
			"1. `reactive` 对象要用 `toRef` 转一下再传进去，不然解构会丢响应性\n" +
			"2. `loading` 一定要放在 `finally` 里关掉，请求失败也要关\n" +
			"3. 分页参数用 `reactive` 而不是多个 `ref`，`watch` 一次就能覆盖\n\n" +
			"体验下来的结论：组合式 API 不是「另一种写法」，" +
			"它更像是把逻辑从组件里抽出来单独维护的工具。\n",
	},
	{
		Title:    "项目复盘：从零搭一个博客后端",
		Slug:     "blog-backend-retrospective",
		Category: "projects",
		Tags:     []string{"Go", "后端", "踩坑"},
		DaysAgo:  20,
		Content: "# 项目复盘：从零搭一个博客后端\n\n" +
			"这个博客的后端从建目录到跑通接口，前后花了几个晚上。记一下过程里的判断和坑。\n\n" +
			"## 技术选型\n\n" +
			"| 部分 | 选择 | 原因 |\n" +
			"| --- | --- | --- |\n" +
			"| Web 框架 | Gin | 生态成熟，中间件多，中文资料全 |\n" +
			"| ORM | GORM | 迁移和关联查询省事 |\n" +
			"| 数据库 | SQLite / MySQL | 开发用前者，上线切后者 |\n" +
			"| 鉴权 | JWT | 前后端分离，无状态最简单 |\n\n" +
			"## 踩到的坑\n\n" +
			"### 1. Windows 上的 SQLite 需要 CGO\n\n" +
			"`gorm.io/driver/sqlite` 底层是 C 实现，Windows 上得装 gcc。" +
			"换成纯 Go 实现的 `github.com/glebarez/sqlite` 之后，直接 `go build` 就过了。\n\n" +
			"### 2. 树形结构的指针问题\n\n" +
			"组装评论树的时候，一开始用值类型存子节点，结果子节点的子节点永远挂不上去——" +
			"存进去的是拷贝，后面再改原对象，拷贝不会跟着变。改成存指针才对。\n\n" +
			"### 3. 列表接口别返回正文\n\n" +
			"一开始列表接口把 `content` 和 `content_html` 全带上了，" +
			"十篇文章的响应就有几百 KB。列表只需要展示摘要，正文留给详情接口。\n\n" +
			"## 做得还行的地方\n\n" +
			"- 数据库驱动做成可切换，本地跑 SQLite，上线改一行配置切 MySQL\n" +
			"- 响应格式统一，前端拿到的结构永远是 `{ code, message, data }`\n" +
			"- 文章的字数和阅读时长在保存时就算好存库，不用每次查询都算\n\n" +
			"## 下一步\n\n" +
			"- [ ] 前台页面\n" +
			"- [ ] 后台管理界面\n" +
			"- [ ] RSS 和站点地图\n" +
			"- [x] 后端接口跑通\n",
	},
}
