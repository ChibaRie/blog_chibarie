import MarkdownIt from 'markdown-it'
import type { TocItem } from '../src/api/types'
export type { TocItem }
import container from 'markdown-it-container'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import go from 'highlight.js/lib/languages/go'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

const languages: Record<string, unknown> = {
  go,
  javascript,
  typescript,
  xml,
  html: xml,
  vue: xml,
  css,
  json,
  bash,
  shell: bash,
  sh: bash,
  sql,
  python,
  java,
  yaml,
  yml: yaml,
  markdown,
  md: markdown,
  ini,
  toml: ini,
  diff,
}

for (const [name, lang] of Object.entries(languages)) {
  hljs.registerLanguage(name, lang as never)
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false,
  highlight(code: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const result = hljs.highlight(code, {
          language: lang,
          ignoreIllegals: true,
        })
        return `<pre class="hljs"><code class="language-${lang}">${result.value}</code></pre>`
      } catch {
        // 落到下面的兜底
      }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(code)}</code></pre>`
  },
})

md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const inline = tokens[idx + 1]
  const level = Number(token.tag.slice(1))
  const text = (inline?.content || '').trim()

  const toc = (env as { toc?: TocItem[] })?.toc
  if (toc && text && level >= 2 && level <= 3) {
    const id = `heading-${toc.length + 1}`
    toc.push({ id, text, level })
    token.attrSet('id', id)
  }
  return self.renderToken(tokens, idx, options)
}

const defaultLinkOpen =
  md.renderer.rules.link_open ||
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('target', '_blank')
  tokens[idx].attrSet('rel', 'noopener noreferrer')
  return defaultLinkOpen(tokens, idx, options, env, self)
}

// 提示块：::: tip [自定义标题] ... :::
const CALLOUTS: Record<string, { label: string }> = {
  tip: { label: '提示' },
  info: { label: '说明' },
  warning: { label: '注意' },
  danger: { label: '警告' },
  quote: { label: '摘录' },
}

for (const [type, meta] of Object.entries(CALLOUTS)) {
  container(md, type, {
    render(tokens, idx) {
      const token = tokens[idx]
      if (token.nesting === 1) {
        const custom = token.info.trim().slice(type.length).trim()
        const title = custom || meta.label
        return `<div class="callout callout-${type}"><p class="callout-title">${md.utils.escapeHtml(title)}</p>\n`
      }
      return '</div>\n'
    },
  })
}

export interface RenderedMarkdown {
  html: string
  toc: TocItem[]
  wordCount: number
}

/** 允许在正文里使用的行内标签（白名单，且不接受任何属性） */
const INLINE_TAGS = [
  'u',
  'b',
  'i',
  's',
  'em',
  'strong',
  'mark',
  'sub',
  'sup',
  'kbd',
  'small',
  'br',
]

const inlineTagRe = new RegExp(`&lt;(/?)(${INLINE_TAGS.join('|')})\\s*(/?)&gt;`, 'gi')

/**
 * markdown-it 关闭了原始 HTML —— 因为知识库导入的材料是外部文章全文存档，
 * 直接放行 HTML 等于把第三方脚本引进正文。但博主自己写内容时用 <u>、<br> 这类
 * 行内标签是合理需求，所以这里把白名单标签的「转义形式」还原回来。
 *
 * 两条边界：
 * 1. 带属性的标签不还原（&lt;u onclick=&quot;…&quot;&gt; 不匹配），故无法借此注入；
 * 2. <pre> / <code> 内的内容原样保留 —— 技术文章经常贴 HTML 示例，
 *    那里的 &lt;br&gt; 必须继续显示成字面量，不能变成真换行。
 */
function restoreInlineTags(html: string): string {
  return html
    .split(/(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>)/g)
    .map((part, i) =>
      i % 2 === 1 ? part : part.replace(inlineTagRe, '<$1$2$3>'),
    )
    .join('')
}

export function renderMarkdown(source: string): RenderedMarkdown {
  const toc: TocItem[] = []
  const html = restoreInlineTags(md.render(source || '', { toc }))
  return { html, toc, wordCount: countWords(source || '') }
}

function countWords(source: string): number {
  let total = 0
  let inLatin = false
  for (const ch of source) {
    const code = ch.codePointAt(0) ?? 0
    if (code >= 0x4e00 && code <= 0x9fff) {
      total++
      inLatin = false
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      if (!inLatin) {
        total++
        inLatin = true
      }
    } else {
      inLatin = false
    }
  }
  return total
}

export default md
