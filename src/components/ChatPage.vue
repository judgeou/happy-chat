<script setup lang="ts">
import { NInput, NGrid, NGi, NButton, NCard, NInputGroup, NSpace, NLayout, NLayoutFooter, NModal, NList, NListItem, NScrollbar, NSkeleton, NSelect, NInputNumber, NFlex, useMessage } from 'naive-ui'
import { reactive, ref, nextTick, computed, watch, Ref } from 'vue'
import { TrashAlt, CopyRegular, Sync } from '@vicons/fa'
import { Icon } from '@vicons/utils'
import IconOpenAI from '../assets/openai.vue'
import { nanoid } from 'nanoid'
import Markdown from './Markdown.vue'

interface MessagesHistoryItem {
  messagesId: string,
  time: Date,
  messages: ChatMessage[]
}

interface ChatMessage {
  role: string,
  content: string,
  model: string,
  total_tokens?: number
}

const msg_ctl = useMessage()
const main_content = ref<HTMLDivElement>()
const prompt = ref('')
const messages = reactive([
  // { role: 'user', content: '1\n\n1'},
  // { role: 'assistant', content: '作为AI语言模型，我没有人类的身体，所以无法感受到洗澡的必要性。不过，从健康角度来看，人应该每天洗澡，因为洗澡可以清除身体表面的污垢和细菌，保持皮肤清洁和健康。如果一个人一天不洗澡，身体表面的细菌和污垢会积累，可能会导致皮肤瘙痒、感染、发炎等问题。此外，长期不洗澡还会影响个人形象和社交关系。因此，保持身体清洁和卫生是非常重要的。'},
] as ChatMessage[])
const isChating = ref(false)
const isShowHistory = ref(false)
const messagesHistory = ref([] as MessagesHistoryItem[])
const historyFilterWord = ref('')
const model = ref('qwen2.5-72b-instruct')
const max_message_number = ref(5)
const apikey = load_from_localstorage('BAILIAN_API_KEY', ''); watch_save_to_localstorage('BAILIAN_API_KEY', apikey)

let es: EventSource
let messagesId = nanoid()

const messagesHistoryFiltered = computed(() => {
  return messagesHistory.value.filter((item) => {
    const msg = item.messages
    return msg[0].content.includes(historyFilterWord.value)
  }).slice(0, 100)
})
const canRetry = computed(() => {
  return messages.length > 0
})

function load_from_localstorage (name: string, defaultValue: string) {
  return ref(localStorage.getItem('HAPPY_CHAT_WEBAPP_' + name) || defaultValue)
}

function watch_save_to_localstorage (name: string, ref_obj: Ref) {
  watch(ref_obj, newValue => {
    localStorage.setItem('HAPPY_CHAT_WEBAPP_' + name, newValue.toString())
  })
}

function clearMessages () {
  messages.length = 0
  messagesId = nanoid()
}

function pressEnterChat (event: KeyboardEvent) {
  if (event.shiftKey || event.ctrlKey) {
    chat()
    event.preventDefault()
  } else {

  }
}

async function chat () {
  if (!prompt.value) {
    return
  }

  messages.push({
    role: 'user',
    content: prompt.value,
    model: model.value
  })

  prompt.value = ''

  return chatComplete()
}

async function chatComplete () {
  if (!prompt.value && messages.length === 0) {
    return
  }
  if (isChating.value) {
    return
  }

  isChating.value = true

  try {
    const postMessages = messages.map(msg => {
      return {
        role: msg.role,
        content: msg.content
      }
    })
    const res = await fetch(`https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apikey.value
      },
      body: JSON.stringify({
        model: model.value,
        messages: postMessages.slice(-max_message_number.value),
        max_tokens: 2048,
        stream: true,
        stream_options: {"include_usage": true}
      })
    })
    
    const reader = res.body?.getReader()
    const decoder = new TextDecoder('utf-8')

    messages.push({
      role: 'assistant',
      content: '',
      model: model.value
    })
    
    while (1) {
      const read_result = await reader?.read()
      if (read_result!.done) {
        break
      }

      const text = decoder.decode(read_result!.value, { stream: true })
      const lines = text.split('\n').filter(line => line)

      for (let line of lines) {
        const text_body = line.slice(6)

        try {
          const json = JSON.parse(text_body)
          const { choices, usage } = json
          const [ cho ] = choices
          const msg = messages[messages.length - 1]
          
          if (cho) {
            const { delta } = cho
          
            if (delta.content) {
              msg.content += delta.content

              await nextTick()
              if (main_content.value) {
                main_content.value.scrollTop = main_content.value?.scrollHeight
              }
            }
          } else if (usage) {
            const { total_tokens } = usage
            msg.total_tokens = total_tokens
            msg_ctl.success(`使用了 ${total_tokens} 个token`)
          }

        } catch (err) {
          console.log(line)
        }
      }

    }

    isChating.value = false
    saveMessages()

  } catch (err) {
    isChating.value = false
  }
}

async function stop () {
  if (es) {
    es.close()
    isChating.value = false
  }
}

function readMessages () {
  const key = 'HAPPY_CHAT_MESSAGES_HISTORY'
  const json = JSON.parse(localStorage.getItem(key) || '[]')

  return json
}

function saveMessages () {
  const key = 'HAPPY_CHAT_MESSAGES_HISTORY'
  const json = readMessages()
  const first = json[0]

  if (first && first.messagesId === messagesId) {
    first.messages = messages
  } else {
    json.unshift({
      messagesId,
      time: new Date(),
      messages
    })
  }
  
  localStorage.setItem(key, JSON.stringify(json))
}

function openHistory () {
  isShowHistory.value = true
  messagesHistory.value = readMessages()
}

function clickHistoryItem (item: MessagesHistoryItem) {
  clearMessages()
  messages.splice(0, messages.length, ...item.messages)
  isShowHistory.value = false
  messagesId = item.messagesId
}

function deleteHistoryItem (item: MessagesHistoryItem) {
  const index = messagesHistory.value.indexOf(item)
  messagesHistory.value.splice(index, 1)

  const key = 'HAPPY_CHAT_MESSAGES_HISTORY'
  localStorage.setItem(key, JSON.stringify(messagesHistory.value))
}

async function copyMessageItem (item: ChatMessage) {
  try {
    await navigator.clipboard.writeText(item.content)
    msg_ctl.success('复制成功')
  } catch (err) {
    msg_ctl.error('复制失败' + err)
  }
}

function retry (msg: ChatMessage) {
  const index = messages.indexOf(msg)
  messages.splice(index)
  // if (messages[messages.length - 1].role === 'assistant') {
  //   messages.pop()
  // }

  chatComplete()
}

function deleteMessageItem (msg: ChatMessage) {
  const index = messages.indexOf(msg)
  messages.splice(index, 1)
}
</script>

<template>
  <n-modal v-model:show="isShowHistory">
    <n-card :size="'small'">
      <n-grid :cols="24">
        <n-gi :span="24">
          <n-input v-model:value="historyFilterWord" placeholder="关键字搜索, 最多显示100条"></n-input>
        </n-gi>

        <n-gi :span="24">
          <n-scrollbar style="max-height: 70vh;">
            <n-list hoverable>
              <n-list-item v-for="item in messagesHistoryFiltered">
                <n-space>
                  <n-button ghost type="error" size="small" @click="deleteHistoryItem(item)">删除</n-button> 
                  <a style="cursor: pointer;" @click="clickHistoryItem(item)">{{ item.messages[0].content }}</a>
                </n-space>
                
              </n-list-item>
            </n-list>
          </n-scrollbar>
        </n-gi>
      </n-grid>
    </n-card>
  </n-modal>

  <NLayout :position="'absolute'">
    <n-space :size="'large'" vertical v-if="messages.length === 0">
      <n-space style="margin-top: 40px;" :justify="'center'">
        <Icon style="font-size: 100px; opacity: 0.5;"><IconOpenAI></IconOpenAI></Icon>
      </n-space>

      <n-space :justify="'center'">
        <b style="font-size: 24px;">按 Shift + Enter 提交</b>
      </n-space>

      <n-space :justify="'center'">
        <n-button type="info" ghost @click="openHistory">历史记录</n-button>
      </n-space>

      <n-space :justify="'center'">
        <n-select style="width: 200px;" v-model:value="model" :options="[
          { label: '通义千问 qwen2.5-72b', value: 'qwen2.5-72b-instruct' },
          { label: '通义千问 qwen2-72b', value: 'qwen2-72b-instruct' },
          { label: '通义千问 turbo', value: 'qwen-turbo' },
          { label: '通义千问 plus', value: 'qwen-plus' },
          { label: '通义千问 max', value: 'qwen-max' }
        ]"></n-select>
      </n-space>

      <n-space :justify="'center'">
        <n-input type="password" placeholder="API Key" v-model:value="apikey" ></n-input>
        <a href="https://bailian.console.aliyun.com/?apiKey=1#/api-key" target="_blank">获取 API KEY</a>
      </n-space>

      <n-space :justify="'center'">
        <n-input-number style="" placeholder="最大上下文个数，默认：5" :show-button="false" v-model:value="max_message_number"></n-input-number>
      </n-space>
    </n-space>

    <div v-if="messages.length > 0" ref="main_content" class="main-content" has-sider>
      <n-grid :cols="24" :x-gap="12" :y-gap="12">
        <n-gi v-for="msg in messages" :span="24">
          <NCard :size="'small'" hoverable :embedded="msg.role !== 'user'">
            <n-space :wrap="false" :justify="'start'" :size="'large'">
              <n-space v-if="msg.role === 'user'" vertical>
                <div>
                  <span class="role">🤔</span>
                </div>
              </n-space>
              
              <div v-if="msg.content.length === 0">
                <n-skeleton text :repeat="2" :width="'200px'"></n-skeleton>
              </div>
              <Markdown v-if="msg.role === 'assistant'" class="message-item" :source="msg.content"></Markdown>
              <div v-if="msg.role == 'user'" class="message-item">
                {{ msg.content }}
              </div>
            </n-space>
            
            <n-flex v-if="!isChating">
              <n-button type="error" ghost size="small" @click="deleteMessageItem(msg)">
                <Icon><TrashAlt></TrashAlt></Icon>
              </n-button>
              
              <n-button ghost size="small" @click="copyMessageItem(msg)">
                <Icon><CopyRegular></CopyRegular></Icon>
              </n-button>

              <n-button v-if="msg.role === 'assistant'" ghost size="small" @click="retry(msg)">
                <Icon><Sync></Sync></Icon>
              </n-button>
              
              <div v-if="msg.total_tokens" style="color: gray">
                total_tokens: <b>{{ msg.total_tokens }}</b>
              </div>
            </n-flex>
          </NCard>
        </n-gi>

        <n-gi v-if="isChating && messages[messages.length - 1].role === 'user'" :span="24">
          <NCard :size="'small'">
            <n-space :wrap="false" :justify="'start'" :size="'large'">
              <p>
                <Icon class="role"><IconOpenAI></IconOpenAI></Icon>
              </p>
              <n-skeleton :width="400" text :repeat="4"></n-skeleton>
            </n-space>
          </NCard>
        </n-gi>
      </n-grid>
    </div>


    <n-layout-footer
    position="absolute"
    style="height: 64px; padding: 12px">
      <div class="chat-bar">
        <n-input-group>
          <n-button style="height: 35.4px;" ghost @click="clearMessages"><Icon><TrashAlt></TrashAlt></Icon></n-button>
          <n-input
          placeholder="你想问什么"
          :style="{ width: '100%' }"
          :loading="isChating"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 3 }"
          v-model:value="prompt"
          @keydown.enter="pressEnterChat"></n-input>

          <n-button style="height: 35.4px;" v-if="!isChating" type="primary" @click="chat">Chat</n-button>
          <n-button style="height: 35.4px;" v-if="isChating" :type="'error'" @click="stop">Stop</n-button>
        </n-input-group>
      </div>
    </n-layout-footer>

  </NLayout>
</template>

<style scoped>
.bg1 {
  background-color: rgb(247,247,248);
}
.role {
  font-size: 28px;
}
.main-content {
  position: absolute; 
  top: 0px; 
  bottom: 64px; 
  overflow-y: scroll; 
  width: 100%;
}
.message-item {
  font-size: 16px;
  height: 100%;
}
</style>
