<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="shell">
    <div class="notfound">
      <span class="page-head__en">// Not found · 404</span>
      <p class="notfound__code" aria-hidden="true">4<b>0</b>4</p>
      <div class="notfound__body">
        <h1>这个位置没有记录</h1>
        <p>页面可能被移动过，或者链接少了一段。从下面的入口继续找。</p>
        <div class="notfound__actions">
          <RouterLink to="/" class="arc-btn arc-btn--primary">回到首页</RouterLink>
          <RouterLink to="/gallery" class="arc-btn">看看图库</RouterLink>
          <RouterLink to="/archive" class="arc-btn">全部归档</RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>