---
id: 25
title: "前端面试题：CSS 布局、Vue 响应式与浏览器渲染"
slug: "frontend-interview-questions"
date: "2026-10-09T09:00:00+08:00"
updated: "2026-10-09T09:00:00+08:00"
summary: "一份前端面试题的知识点整理：块级元素与行内元素、三栏布局、各种居中、sticky footer、Vue 双向绑定与 v-model、keep-alive、nextTick、跨域、闭包、事件流、数组扁平化和数组转树。每道题附一份能直接说出口的答案和常见的追问方向。"
category: "tech"
tags: ["前端","CSS","Vue","JavaScript","面试"]
isTop: false
draft: false
---
这些都是前端面试里高频出现的题，按知识点排过序，每题给一份能直接在面试里说出口的答案。

题目分布很典型：CSS 布局占一半，Vue 占三成，剩下的落在浏览器原理和手写题上。这种比例说明一件事——实习/校招的前端面试，考察重点不在框架 API，而在"你知不知道页面是怎么变成画面的"。

## HTML 与 CSS

### 块级元素和行内元素

块级元素独占一行，可以设 `width`/`height`/`margin` 上下；行内元素跟着文字流排，宽高由内容决定，垂直方向的 `margin` 和 `padding` 不撑开行高。

| 类型 | 常见标签 | 是否独占一行 | 能否设宽高 |
| --- | --- | --- | --- |
| 块级 | `div` `p` `ul` `li` `h1`–`h6` `section` `header` `footer` `form` | 是 | 能 |
| 行内 | `span` `a` `strong` `em` `label` `code` | 否 | 不能 |
| 行内块 | `img` `input` `button` `select` `textarea` | 否 | 能（替换元素） |

`img`、`input` 这类是**替换元素**，行为接近行内块，所以"行内元素不能设宽高"这句话对它们不成立。这一点最容易被追问。

### 平时用得多的是 CSS 属性

可以顺着"布局 → 盒模型 → 视觉"回答：布局用 `display`、`flex-direction`、`justify-content`、`align-items`、`gap`、`position`；盒模型用 `margin`、`padding`、`border`、`box-sizing`；视觉用 `font-size`、`font-weight`、`color`、`background`、`border-radius`、`box-shadow`、`transition`。

这题不是考记忆力，是在探你写过的页面复杂度。只报属性名容易显得单薄，最好补一句"主要是弹性布局，复杂一点会切到 Grid"。

### main 内容少时，footer 仍然贴底

这个叫 sticky footer。三种做法，按推荐顺序：

```css
/* 1. flex：最简单 */
body {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
main {
  flex: 1; /* 撑满剩余空间，footer 自然被推到底 */
}

/* 2. grid：语义更直白 */
body {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr auto;
}

/* 3. absolute：老方案，需要给 footer 预留高度 */
body {
  position: relative;
  min-height: 100vh;
  padding-bottom: 60px;
}
footer {
  position: absolute;
  bottom: 0;
  width: 100%;
  height: 60px;
}
```

给 `main` 设一个 `min-height` 也算对，但要写死具体数值，内容和屏幕高度一变就失效，属于能用但不推荐。

::: warning 常见坑
用 JS 监听 `resize` 再给 footer 切 `position: fixed` 是下策：移动端键盘弹出、地址栏收起都会触发高度变化，滚动时会闪。布局问题优先用布局解决。
:::

另外 `100vh` 在移动端浏览器上会比可视区域高（地址栏算进了 vh），需要精确高度时可以换成 `100dvh`。

### 水平垂直居中

```css
/* flex */
.parent {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* grid */
.parent {
  display: grid;
  place-items: center;
}

/* 绝对定位 + transform，不依赖父元素尺寸 */
.child {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* 绝对定位 + margin: auto，要求元素有确定的宽高 */
.child {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 200px;
  height: 120px;
}

/* 单行文本 */
.parent {
  line-height: 100px;
  text-align: center;
}
```

面试时按"flex → grid → 绝对定位"说，再补一句 `transform` 方案用在弹窗、居中在固定宽高的容器里都合适。`text-align: center` 只管水平，`margin: auto` 单独用也不管垂直，这两个只能算半个答案。

### 三栏布局：左右固定、中间自适应、等高

```css
/* flex */
.layout {
  display: flex;
  min-height: 300px;
}
.left,
.right {
  width: 200px;
  flex: 0 0 200px;
}
.center {
  flex: 1;
}

/* grid 写法更短，三栏默认等高 */
.layout {
  display: grid;
  grid-template-columns: 200px 1fr 200px;
}

/* 绝对的圣杯：中间栏要留出左右边距 */
.layout {
  position: relative;
  min-height: 300px;
}
.left,
.right {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 200px;
}
.left {
  left: 0;
}
.right {
  right: 0;
}
.center {
  margin: 0 200px;
}
```

等高这一点 flex 和 grid 天生满足（默认 `align-items: stretch`），绝对定位方案靠 `top: 0; bottom: 0` 拉满。如果只要求"内容高度不同但背景等高"，经典的 float 方案是 `padding-bottom: 9999px; margin-bottom: -9999px` 配合父元素 `overflow: hidden` 裁掉，现在没必要了。

## Vue

### 双向绑定的实现原理

**Vue 2 用 `Object.defineProperty` 做数据劫持。**

`Observer` 递归遍历 `data`，把每个属性改写成带 `getter`/`setter` 的形式。`getter` 里做依赖收集：把当前正在执行的 `Watcher` 记到这个属性的 `Dep` 里；`setter` 里调 `dep.notify()`，通知所有 `Watcher` 重新求值，进而触发 `render` 和 patch。

模板里的每个插值和指令在编译阶段对应一个 `Watcher`（渲染 Watcher 只有一个，但求值时会触碰多个属性），所以本质是**发布订阅 + 依赖收集**，而不是"数据一变就全量重渲染"。

数组没法用 `defineProperty` 拦截下标赋值，Vue 2 的做法是重写 `push`、`pop`、`shift`、`unshift`、`splice`、`sort`、`reverse` 七个变异方法，在原型链上包一层并手动 `notify`。

**Vue 3 换成 `Proxy`。**

`new Proxy(target, handler)` 拦截 `get`、`set`、`deleteProperty`、`has`、`ownKeys`，配合 `effect` 和 `track`/`trigger` 收集依赖。好处是不用递归初始化（读到嵌套对象时才代理，懒代理）、能监听属性新增和删除、能覆盖 `Map`/`Set`。

::: tip 追问
Vue 2 里给对象新增属性为什么没反应？因为 `Observer` 初始化时已经遍历完了，新属性上没有 `getter`/`setter`。改用 `this.$set(obj, key, value)` 或 `Vue.set`，内部会补一次 `defineReactive` 并触发通知。删除要用 `this.$delete`。Vue 3 换 `Proxy` 后这个坑就不存在了。
:::

### v-model 到底是什么

语法糖，展开就是"绑值 + 监听更新"。

```vue
<!-- Vue 2：原生元素 -->
<input v-model="msg" />
<input :value="msg" @input="msg = $event.target.value" />

<!-- Vue 2：自定义组件 -->
<MyInput :value="msg" @input="msg = $event" />

<!-- Vue 3：原生元素展开结果和 Vue 2 一样 -->
<input :value="msg" @input="msg = $event.target.value" />

<!-- Vue 3：自定义组件 -->
<MyInput :modelValue="msg" @update:modelValue="msg = $event" />
```

Vue 2 的组件约定是 `value` + `input`，不想要这套命名可以用 `model: { prop, event }` 改。Vue 3 固定为 `modelValue` + `update:modelValue`，并且支持多个 `v-model:title="x"`。修饰符（`.trim`、`.number`、`.lazy`）会通过 `modelModifiers` 传给组件，组件自己决定怎么处理。

### 自定义事件

子组件用 `$emit('change', payload)` 抛事件，父组件用 `@change="handler"` 监听，参数就是 `payload`。

```js
// Vue 2
this.$emit('select', id)

// Vue 3 组合式，显式声明才不会被当成透传属性
const emit = defineEmits(['select'])
emit('select', id)
```

监听原生事件在 Vue 2 里要用 `.native`，Vue 3 去掉了这个修饰符——没在 `emits` 里声明的事件会自动透传到根节点上。

### keep-alive

一个抽象组件，用来缓存组件实例。被包住的组件切换走时不会销毁，而是进入失活状态，再切回来直接复用 VDOM 和状态，不再走一遍 `created`/`mounted`。

```vue
<keep-alive :include="['GoodsList']" :max="5">
  <component :is="current" />
</keep-alive>
```

涉及两个生命周期：`activated`（激活）和 `deactivated`（失活）。它们和 `mounted`/`beforeDestroy` 的区别是——只有首次挂载和真正销毁时才走后者，来回切换只走这两个。

`include`/`exclude` 按组件的 `name` 匹配，`max` 是 LRU 上限，超了就把最久没用过的实例销毁。典型场景是列表页进详情页再返回，要保持滚动位置和筛选条件。

### $nextTick 的原理和作用

Vue 改数据之后不会立刻更新 DOM，而是把 `Watcher` 塞进队列去重，等同一个事件循环里所有同步修改结束，再统一 patch 一次。这个"统一"发生在微任务里。

`$nextTick(cb)` 就是把回调排到这个 DOM 更新之后执行：

- Vue 2：优先 `Promise.then`，不支持就降级到 `MutationObserver`，再不行用 `setImmediate`，最后是 `setTimeout`。
- Vue 3：直接 `Promise.resolve().then()`，返回一个 Promise。

用途：DOM 更新后要量尺寸、拿滚动高度、调第三方库的 `init`、在 `v-if` 刚为真时拿到元素引用。Vue 3 里更常见的写法是 `await nextTick()`。

```js
visible.value = true
await nextTick()
listRef.value.scrollTop = listRef.value.scrollHeight
```

### 给 data 里的对象加属性会发生什么

Vue 2 里新加的属性不是响应式的：视图不会更新，`watch` 也不会触发，因为属性创建时没有经过 `defineProperty`。

```js
this.obj.newKey = 1        // 不响应
this.$set(this.obj, 'newKey', 1)   // 响应

this.arr[0] = 'x'          // 不响应
this.$set(this.arr, 0, 'x') // 响应
```

替代方案：先把属性在 `data` 里声明成占位值；或者整体替换对象（`this.obj = { ...this.obj, newKey: 1 }`），因为引用变了会触发 setter。Vue 3 用 `Proxy` 拦截 `set`，新增属性天然响应，`$set` 也已经被移除。

## 浏览器与网络

### 页面渲染的完整过程

按顺序说：

1. **URL 到 IP**：浏览器缓存 → 系统 hosts → DNS 服务器递归查询，拿到 IP。
2. **建立连接**：三次握手建 TCP，HTTPS 再走 TLS 握手（TLS 1.3 可以 1-RTT）。
3. **发请求收响应**：HTTP 请求，返回 HTML 字节流；`Content-Encoding` 需要解压，`304` 时直接用缓存。
4. **构建 DOM**：HTML 解析器边下载边解析，遇到 `<script>` 会停下来执行（除非 `defer`/`async`）。
5. **构建 CSSOM**：CSS 不阻塞 HTML 解析，但阻塞渲染，也阻塞后面 JS 的执行，因为 JS 可能要读样式。
6. **合成渲染树**：DOM + CSSOM 生成只含可见节点的 render tree（`display: none` 的不进树，`visibility: hidden` 会进）。
7. **布局（layout / 回流）**：算出每个盒子的位置和尺寸。
8. **分层与绘制（paint）**：生成绘制指令，按图层栅格化。
9. **合成（composite）**：GPU 把图层合成为最终画面。

重排和重绘的区别是这题最常见的追问：

| 变化 | 触发 | 代价 |
| --- | --- | --- |
| `width`、`height`、`margin`、`font-size`、增删节点 | 重排（layout）→ 重绘 → 合成 | 最高 |
| `color`、`background`、`box-shadow`、`visibility` | 重绘 → 合成 | 中 |
| `transform`、`opacity`、`filter` | 只合成 | 最低 |

所以动画优先用 `transform` 和 `opacity`，避免反复读 `offsetTop`、`getBoundingClientRect` 这类强制同步布局的属性。真要读写混用，把读集中到一处，或者用 `requestAnimationFrame` 分帧。

### 跨域与解决方案

跨域是浏览器的**同源策略**在拦：协议、域名、端口三者有一个不同就算跨域。注意同源策略限制的是"读响应"，不是"发请求"——请求发出去了，只是拿不到结果。

| 方案 | 原理 | 限制 |
| --- | --- | --- |
| CORS | 服务端返回 `Access-Control-Allow-Origin` 等响应头 | 需要服务端配合；带 cookie 时源不能是 `*` |
| 反向代理（Nginx / devServer） | 同源访问代理，代理服务器转发 | 需要部署或开发环境支持 |
| JSONP | `script` 标签不受同源限制，靠 `callback` 回传 | 只能 GET、不安全、需要服务端改造 |
| `postMessage` | 窗口间显式传消息 | 只适合 iframe / 弹窗通信 |
| `document.domain` | 同主域下降低域名严格度 | 只能解决主域相同的情况，已不推荐 |
| WebSocket | 协议本身不受同源策略限制 | 服务端要自己校验 `Origin` |

CORS 要分清两类请求：`GET`/`HEAD`/`POST` 且 `Content-Type` 是 `text/plain`、`application/x-www-form-urlencoded`、`multipart/form-data` 的属于简单请求，直接带上 `Origin` 发；其余（自定义头、`application/json`、`PUT`/`DELETE`）会先发一次 `OPTIONS` 预检，服务端返回允许的方法和头，浏览器才发真实请求。

```http
Access-Control-Allow-Origin: https://example.com
Access-Control-Allow-Methods: GET, POST, PUT
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

带凭证时前端还要设 `withCredentials: true`，同时 `Access-Control-Allow-Origin` 必须是具体域名，不能用 `*`。

::: warning 一个反例
`Access-Control-Allow-Origin: *` 加上 `Access-Control-Allow-Credentials: true` 是无效组合，浏览器会直接拒绝。很多人调半天就是因为这里。
:::

## JavaScript

### 闭包

闭包是函数和它所在的词法环境的组合。只要内部函数引用了外部函数的变量，并且这个内部函数在外部函数返回后还能被访问，闭包就形成了——那些变量不会被回收。

```js
function createCounter() {
  let count = 0
  return {
    inc: () => ++count,
    get: () => count,
  }
}
```

用途：封装私有状态（上面的计数器）、模块化、防抖节流、柯里化和偏函数、缓存计算结果。

代价是引用不会被释放，长生命周期的闭包里如果挂着大对象或 DOM，就容易内存泄漏。另外 `for (var i...)` 里注册的回调共享同一个 `i`，是闭包最经典的表现形式，用 `let` 或 IIFE 各捕获一份。

原题写的是"闭包有哪些解决方案"，其实是问"闭包会带来什么问题、怎么规避"：用完把引用置 `null`、减少闭包持有的变量范围、事件监听在卸载时移除。

### 事件冒泡和事件捕获

事件流分三个阶段：捕获（`window` → 目标）、目标、冒泡（目标 → `window`）。

`addEventListener` 的第三个参数默认 `false`，即冒泡阶段触发；传 `true` 或 `{ capture: true }` 就在捕获阶段触发。所以同一个元素上先注册捕获、后注册冒泡，捕获阶段就会先执行。

```js
el.addEventListener('click', fn, true)  // 捕获
el.addEventListener('click', fn, false) // 冒泡
```

三个容易混的停止方法：

- `stopPropagation()`：阻止事件继续传播，但同元素上的其他监听器照常执行。
- `stopImmediatePropagation()`：连同元素上后续监听器一起拦掉。
- `preventDefault()`：阻止默认行为（链接跳转、表单提交），不影响传播。

事件委托就是把监听器挂在父节点上，用 `event.target` 判断真正点的是谁。好处是监听器少、动态加进来的子节点自动生效；但 `focus`、`blur`、`scroll`、`mouseenter` 不冒泡，委托只能换成 `focusin`/`focusout` 或用捕获阶段，`scroll` 更是必须在捕获阶段才抓得到。

### 数组扁平化

把任意层级嵌套的数组压成一维。

```js
// 1. 原生，Infinity 表示不限层数
arr.flat(Infinity)

// 2. reduce 递归
const flatten = (arr) =>
  arr.reduce(
    (acc, cur) => acc.concat(Array.isArray(cur) ? flatten(cur) : cur),
    [],
  )

// 3. 栈迭代，避免深嵌套爆栈
function flattenStack(arr) {
  const stack = [...arr]
  const result = []
  while (stack.length) {
    const cur = stack.pop()
    if (Array.isArray(cur)) stack.push(...cur)
    else result.push(cur)
  }
  return result.reverse()
}
```

递归写法最直观，但嵌套很深时会爆调用栈；`flat` 是标准方法，面试时先说它，再补手写实现。注意原题括号里写的是"一维数组转二维数组"，方向和扁平化相反，属于笔误——真遇到要说清楚是哪个方向再动手。

### 数组转树

后端返回的是扁平数组，每个元素带 `id` 和 `parentId`，要转成嵌套结构。一次遍历建索引，第二次遍历挂 `children`，复杂度 O(n)。

```js
function listToTree(list, rootId = null) {
  const map = new Map()
  for (const item of list) map.set(item.id, { ...item, children: [] })

  const roots = []
  for (const node of map.values()) {
    const parent = node.parentId === rootId ? null : map.get(node.parentId)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}
```

要点有三个：子节点先压进 `Map` 保证顺序无关；父节点不存在（脏数据）时降级成根节点，不要丢数据；如果树要渲染成组件，记得 `children` 为空数组时不要渲染成空文件夹。如果允许改写原对象，`{ ...item }` 那一步可以省掉，但会污染入参。

## 项目与工程

### 登录模块里做了什么

按"校验 → 请求 → 存凭证 → 带凭证 → 拦截路由"这条线说：

1. **表单预校验**：Element UI / Element Plus 的 `el-form` 规则校验，必填、长度、格式在提交前挡掉，减少无效请求。
2. **发请求**：`axios` 提交账号密码，用返回的 `code`/`status` 判断成功与否，失败时 `ElMessage` 提示。
3. **存 token**：登录成功把 token 存进 `localStorage`（或存在 store 里再持久化）。
4. **带凭证**：`axios` 请求拦截器统一加 `Authorization: Bearer <token>`。
5. **路由守卫**：`router.beforeEach` 里检查 token，没有就 `next('/login')`，顺便把原始路径塞进 query 以便登录后跳回。
6. **过期处理**：响应拦截器里统一处理 401，清 token 并跳登录；有 refresh token 的话先静默刷新再重放请求。

### 本地伪造 token 能不能进后台

前端能做的拦截只有"挡界面"，本质是体验优化。`localStorage` 的值用户随时能改，改完路由守卫就放行了，页面也能渲染出来。

真正的权限判断必须落在后端：校验 JWT 签名、检查过期时间、按角色查接口权限。伪造的 token 签名对不上，接口直接返回 401，前端拿不到任何数据，能看到的只是一个空壳页面。

所以安全的存储方式不是 `localStorage` 而是 `HttpOnly` + `Secure` + `SameSite` 的 Cookie（JS 读不到，XSS 也偷不走），代价是要配 CSRF 防护（同源校验或 CSRF token）。

## 复盘

最容易被追问的是三处：一是 sticky footer 和等高布局，能不能从"设个 min-height"说到 flex/grid；二是 Vue 响应式，能不能讲清"依赖收集"而不只是背 `defineProperty`；三是渲染流程，能不能区分重排、重绘和只走合成的场景。

手写的两道题（扁平化、数组转树）都不难，但都有 O(n) 和边界处理两个考点，写的时候顺手说出复杂度，比闷头敲完更有说服力。
