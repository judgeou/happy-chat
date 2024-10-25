<script setup lang="ts">
import ChatPage from './components/ChatPage.vue'
import { NMessageProvider } from 'naive-ui'
</script>

<template>
  <div class="main">
    <NMessageProvider>
      <ChatPage />
    </NMessageProvider>
  </div>
</template>

<style scoped>
.main {
  padding-top: 12px;
  padding-bottom: 12px;
}
</style>
