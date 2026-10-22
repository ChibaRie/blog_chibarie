---
id: 3
title: "用 Vue 3 组合式 API 写一个文章列表"
slug: "vue3-composition-api-post-list"
date: "2026-09-06T11:46:48.926+08:00"
updated: "2026-10-22T16:46:00+08:00"
summary: "把文章列表的请求、分页和加载状态抽成一个 composable，组件只负责渲染。记一下组合式 API 在真实页面里的几个坑。"
cover: "/uploads/2026/09/1789800270-b6357a68092a082e.jpg"
category: "tech"
tags: ["Vue","TypeScript","前端"]
isTop: false
draft: false
---
组合式 API 刚出来的时候我不太习惯，写多了才发现它最大的好处是**逻辑可以按功能聚合，而不是按选项类型散落**。

## 把数据请求抽成 composable

先写一个通用的请求 hook：

```ts
export function usePosts(params: Ref<PostQuery>) {
  const list = ref<Post[]>([])
  const total = ref(0)
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      const res = await api.getPosts(params.value)
      list.value = res.list
      total.value = res.total
    } finally {
      loading.value = false
    }
  }

  watch(params, load, { immediate: true })
  return { list, total, loading, reload: load }
}
```

`watch` 加上 `immediate: true`，参数一变自动重新请求，组件里就不用到处手写 watch 了。

## 组件里就很干净

```vue
<script setup lang="ts">
const params = reactive({ page: 1, pageSize: 10, keyword: '' })
const { list, total, loading } = usePosts(toRef(params))
</script>
```

模板里只管渲染，逻辑都在 composable 里，测试也好写。

## 几个细节

1. `reactive` 对象要用 `toRef` 转一下再传进去，不然解构会丢响应性
2. `loading` 一定要放在 `finally` 里关掉，请求失败也要关
3. 分页参数用 `reactive` 而不是多个 `ref`，`watch` 一次就能覆盖

体验下来，组合式 API 对我最大的帮助不是少写了几行模板，而是把请求参数、加载状态、分页这些容易散在各处的东西抽成了一个能单独修改和测试的模块。组件只管渲染，逻辑坏了好定位，复用的时候也不用复制粘贴。
