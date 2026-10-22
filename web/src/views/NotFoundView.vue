<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
    <div class="relative">
      <span
        class="block text-[92px] font-medium leading-none text-night-700 select-none"
      >
        404
      </span>
      <span
        class="absolute inset-0 flex items-center justify-center text-[92px] font-medium leading-none text-sakura-400/25 blur-[2px] select-none"
      >
        404
      </span>
    </div>

    <h1 class="mt-6 text-lg font-medium text-mist-100">这里什么都没有</h1>
    <p class="mt-2 text-sm text-mist-500">
      页面可能被移动过，或者链接输错了。
    </p>

    <div class="mt-8 flex items-center gap-3">
      <RouterLink to="/" class="btn-primary">回到首页</RouterLink>
      <RouterLink to="/archive" class="btn-ghost">看看归档</RouterLink>
    </div>
  </div>
</template>
