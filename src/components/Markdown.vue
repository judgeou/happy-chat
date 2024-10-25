<script setup lang="ts">
import { marked } from 'marked'
import { watch, ref, nextTick } from 'vue'
import katex from '../assets/katex/katex.mjs'
import '../assets/katex/katex.min.css'
import hljs from 'highlight.js/lib/core';
import 'highlight.js/styles/github.css'

const props = defineProps<{
  source: string
}>()
const html = ref('')
const el = ref<HTMLDivElement>()

const hljslangLoaderMap = {
  'javascript': () => import('highlight.js/lib/languages/javascript'),
  'typescript': () => import('highlight.js/lib/languages/typescript'),
  'json': () => import('highlight.js/lib/languages/json'),
  'bash': () => import('highlight.js/lib/languages/bash'),
  'python': () => import('highlight.js/lib/languages/python'),
  'java': () => import('highlight.js/lib/languages/java'),
  'cpp': () => import('highlight.js/lib/languages/cpp'),
  'csharp': () => import('highlight.js/lib/languages/csharp'),
  'c': () => import('highlight.js/lib/languages/c'),
  'sh': () => import('highlight.js/lib/languages/bash'),
  'html': () => import('highlight.js/lib/languages/xml'),
  'css': () => import('highlight.js/lib/languages/css')
}

watch(props, async () => {
  render()
})

function renderMath (htmlContent: string) {
  let htmlOut = htmlContent
  const mathPatterns = [
    { regex: /\\\[\n(.+)\n.*\\\]/g, displayMode: true },
    { regex: /\\\[ (.+) \\\]/g, displayMode: false },
    { regex: /\\\( (.+?) \\\)/g, displayMode: false },
    { regex: /\\\((.+?)\\\)/g, displayMode: false }
  ]
  
  for (let pattern of mathPatterns) {
    htmlOut = htmlOut.replace(pattern.regex, (r: string, capture: string, index: number, s: string) => {
      return katex.renderToString(capture, { displayMode: pattern.displayMode })
    })
  }

  return htmlOut
}

async function render () {
  const htmlParsed = await marked.parse(renderMath(props.source))
  html.value = htmlParsed
  
  await nextTick()
  await loadLanguage()
  hljs.highlightAll()
}

async function loadLanguage () {
  const codeEls = [...el.value!.querySelectorAll('code[class]:not([class=""])')]
  const classNames = codeEls.map(item => item.className)

  for (let className of classNames) {
    const langName = className.split('language-')[1]
    if (langName) {
      {
        const resolver = (hljslangLoaderMap as any)[langName]
        if (resolver) {
          const langModule = await resolver()
          hljs.registerLanguage(langName, langModule.default) 
        }
      }
    }
  }
}

render()
</script>

<template>
  <div ref="el" v-html="html"></div>
</template>