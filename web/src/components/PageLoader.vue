<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const visible = ref(true)
const fading = ref(false)

let hideTimer: ReturnType<typeof setTimeout> | undefined
let removeTimer: ReturnType<typeof setTimeout> | undefined
let fallbackTimer: ReturnType<typeof setTimeout> | undefined

const MIN_SHOW = 700

function hide() {
  if (fading.value || !visible.value) return
  fading.value = true
  removeTimer = setTimeout(() => {
    visible.value = false
  }, 520)
}

onMounted(() => {
  const start = performance.now()

  const trigger = () => {
    const wait = Math.max(0, MIN_SHOW - (performance.now() - start))
    hideTimer = setTimeout(hide, wait)
  }

  if (document.readyState === 'complete') {
    trigger()
  } else {
    window.addEventListener('load', trigger, { once: true })
  }

  // 兜底：即使资源加载异常，也不让遮罩卡住页面
  fallbackTimer = setTimeout(hide, 4000)
})

onUnmounted(() => {
  clearTimeout(hideTimer)
  clearTimeout(removeTimer)
  clearTimeout(fallbackTimer)
})
</script>

<template>
  <Transition name="loader">
    <div
      v-if="visible"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-night-950"
    >
      <div class="flex flex-col items-center">
        <svg
          class="loader-star"
          width="46"
          height="46"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="loaderStarGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" style="stop-color: rgb(var(--c-sakura-200))" />
              <stop offset="100%" style="stop-color: rgb(var(--c-cosmos-400))" />
            </linearGradient>
          </defs>
          <path
            d="M12 1.6 L14.6 9.1 L22 12 L14.6 14.9 L12 22.4 L9.4 14.9 L2 12 L9.4 9.1 Z"
            fill="url(#loaderStarGrad)"
          />
        </svg>

        <p class="mt-5 text-sm tracking-[0.3em] text-mist-400">chibarie</p>

        <div class="loader-bar mt-5">
          <span />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.loader-enter-active,
.loader-leave-active {
  transition: opacity 0.5s ease;
}
.loader-leave-to {
  opacity: 0;
}

.loader-star {
  animation: loaderPulse 1.6s ease-in-out infinite;
  filter: drop-shadow(0 0 14px rgb(var(--c-sakura-400) / 0.45));
}

@keyframes loaderPulse {
  0%,
  100% {
    transform: scale(0.88) rotate(0deg);
    opacity: 0.75;
  }
  50% {
    transform: scale(1.06) rotate(180deg);
    opacity: 1;
  }
}

.loader-bar {
  position: relative;
  width: 128px;
  height: 2px;
  overflow: hidden;
  border-radius: 2px;
  background: rgb(var(--c-mist-400) / 0.22);
}

.loader-bar span {
  position: absolute;
  inset: 0 auto 0 0;
  width: 40%;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    rgb(var(--c-sakura-400)),
    rgb(var(--c-cosmos-400))
  );
  animation: loaderSlide 1.1s ease-in-out infinite;
}

@keyframes loaderSlide {
  0% {
    transform: translateX(-110%);
  }
  100% {
    transform: translateX(360%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .loader-star,
  .loader-bar span {
    animation: none;
  }
  .loader-bar span {
    width: 100%;
  }
}
</style>
