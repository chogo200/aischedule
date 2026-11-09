<script setup>
import { ref, nextTick } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue'])
const { $api } = useNuxtApp()

// Model Selection: โมเดลที่รองรับบน Groq, OpenRouter และ Gemini
const availableModels = [
  { value: 'groq-gpt-120b', label: 'GPT-120B (แนะนำ)', provider: 'Groq', desc: 'ฉลาดสุด เสถียร จัดการข้อมูลได้แม่นยำ' },
  { value: 'groq-gpt-20b', label: 'GPT-20B', provider: 'Groq', desc: 'เร็ว เบา เสถียร' },
  { value: 'openrouter-nemotron', label: 'Nemotron 3.5 (OpenRouter ฟรี)', provider: 'OpenRouter', desc: 'ฟรี 50 ครั้ง/วัน รองรับ Tool Calling' },
  { value: 'groq-qwen-27b', label: 'Qwen 3.8 27B', provider: 'Groq', desc: 'ภาษาไทยดี' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', provider: 'Google', desc: 'Google AI Studio' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', provider: 'Google', desc: 'Google AI Studio' },
]
const selectedModel = ref('groq-gpt-120b')

const inputMessage = ref('')
const isSending = ref(false)
const chatContainer = ref(null)

// File Upload State
const fileInput = ref(null)
const selectedFile = ref(null)
const isExtracting = ref(false)
const extractResult = ref(null)
const isImporting = ref(false)
const importSuccessMsg = ref('')
const importErrorMsg = ref('')

const messages = ref([
  {
    id: 1,
    role: 'assistant',
    text: 'สวัสดีครับ! ผมคือ AI Agent ผู้ช่วยจัดการระบบและจัดตารางสอน\n• สั่งให้ Mock ข้อมูล (เช่น "ช่วย mock โครงการ 2568/1 มี 3 ชั้นเรียน 4 วิชา")\n• สั่งเพิ่ม/แก้ไขข้อมูลในระบบ\n• หรือกดปุ่ม 📎 แนบไฟล์ Excel/CSV ให้ผมแกะข้อมูลนำเข้าระบบได้ทันทีครับ',
    time: 'ตอนนี้',
    logs: []
  }
])

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

// ส่งคำสั่งแชท & Agent Tool Calling
async function sendMessage() {
  const text = inputMessage.value.trim()
  if (!text || isSending.value) return

  const now = new Date()
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  messages.value.push({
    id: Date.now(),
    role: 'user',
    text,
    time: timeStr
  })

  inputMessage.value = ''
  isSending.value = true
  scrollToBottom()

  try {
    const { data } = await $api.post('/api/agent/chat', {
      message: text,
      model: selectedModel.value,
    })

    messages.value.push({
      id: Date.now() + 1,
      role: 'assistant',
      text: data.reply || 'ดำเนินการเรียบร้อยแล้วครับ',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: data.modelUsed,
      logs: data.logs || []
    })
  } catch (err) {
    messages.value.push({
      id: Date.now() + 1,
      role: 'assistant',
      text: 'เกิดข้อผิดพลาด: ' + (err.response?.data?.message || err.message),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      error: true,
      logs: []
    })
  } finally {
    isSending.value = false
    scrollToBottom()
  }
}

// Quick Mock Prompt
function triggerQuickMock(type) {
  if (type === 'project') {
    inputMessage.value = 'ช่วย Mock ข้อมูลโครงการ 2569/1 มี 3 ชั้นเรียน 5 รายวิชา และครู 3 คนพร้อมกำหนดความเชี่ยวชาญให้ครบ'
  } else if (type === 'subjects') {
    inputMessage.value = 'ช่วย Mock รายวิชาหมวดคอมพิวเตอร์ 4 วิชา พร้อมรหัสวิชาและระดับชั้น ปวส.'
  } else if (type === 'rooms') {
    inputMessage.value = 'ช่วยสร้างห้องปฏิบัติการคอมพิวเตอร์ 3 ห้อง พร้อมระบุคุณสมบัติห้อง'
  }
  sendMessage()
}

// File Selection & Extraction
function onFileSelect(e) {
  const files = e.target.files
  if (files && files[0]) {
    selectedFile.value = files[0]
    uploadAndExtractFile()
  }
}

async function uploadAndExtractFile() {
  if (!selectedFile.value) return

  isExtracting.value = true
  importSuccessMsg.value = ''
  importErrorMsg.value = ''
  extractResult.value = null

  const formData = new FormData()
  formData.append('file', selectedFile.value)
  formData.append('model', selectedModel.value)
  formData.append('prompt', 'วิเคราะห์และสกัดข้อมูลเพื่อนำเข้าสู่ระบบจัดตารางสอน')

  try {
    const { data } = await $api.post('/api/agent/upload-extract', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    extractResult.value = data.data

    messages.value.push({
      id: Date.now(),
      role: 'assistant',
      text: `📂 วิเคราะห์ไฟล์ "${selectedFile.value.name}" สำเร็จ!\n${data.data?.summary || ''}\nสามารถกดยืนยันเพื่อบันทึกข้อมูลเข้าระบบได้เลยครับ`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isExtractPreview: true,
      data: data.data
    })
    scrollToBottom()
  } catch (err) {
    importErrorMsg.value = err.response?.data?.message || err.message || 'วิเคราะห์ไฟล์ไม่สำเร็จ'
  } finally {
    isExtracting.value = false
  }
}

// ยืนยันบันทึกข้อมูลที่สกัดจากไฟล์
async function confirmImport(itemData) {
  const target = itemData || extractResult.value
  if (!target) return

  isImporting.value = true
  try {
    const { data } = await $api.post('/api/agent/execute-import', {
      subjects: target.subjects || [],
      teachers: target.teachers || [],
      rooms: target.rooms || [],
      classes: target.classes || [],
    })
    messages.value.push({
      id: Date.now(),
      role: 'assistant',
      text: `✅ ${data.message || 'นำเข้าข้อมูลสู่ระบบสำเร็จเรียบร้อยแล้ว'}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    })
    extractResult.value = null
    selectedFile.value = null
    scrollToBottom()
  } catch (err) {
    alert(err.response?.data?.message || err.message || 'นำเข้าไม่สำเร็จ')
  } finally {
    isImporting.value = false
  }
}
</script>

<template>
  <aside class="chat-sidebar border-s border-gray-200 bg-white flex flex-col h-full w-[400px] max-w-[460px] shrink-0 shadow-sm z-30">
    <!-- Header -->
    <div class="chat-header px-4 py-2.5 border-b border-gray-200 flex flex-col gap-2 bg-gray-50/80">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-xs">
            <v-icon icon="mdi-robot-excited-outline" size="18" />
          </div>
          <div>
            <h3 class="text-xs font-bold text-gray-800 leading-none flex items-center gap-1.5">
              <span>AI Agent Assistant</span>
              <span class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700">LangChain</span>
            </h3>
            <span class="text-[10px] text-green-600 font-medium flex items-center gap-1 mt-0.5">
              <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> พร้อมปฏิบัติงาน
            </span>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <!-- ปุ่มล้างแชท -->
          <v-btn
            icon="mdi-delete-sweep-outline"
            size="x-small"
            variant="text"
            title="ล้างแชท"
            @click="messages = []"
          />
          <!-- ปุ่มปิด Drawer -->
          <v-btn
            icon="mdi-close"
            size="x-small"
            variant="text"
            title="ปิดหน้าต่าง AI"
            @click="emit('update:modelValue', false)"
          />
        </div>
      </div>

      <!-- Model Selector & Quick Mock Actions -->
      <div class="flex items-center justify-between pt-1 border-t border-gray-200/50 gap-1.5">
        <!-- Model Dropdown -->
        <div class="relative flex-1 max-w-[210px]">
          <select
            v-model="selectedModel"
            class="w-full bg-white text-gray-800 text-[11px] font-medium px-2 py-1 rounded-lg border border-gray-300 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs"
          >
            <option
              v-for="m in availableModels"
              :key="m.value"
              :value="m.value"
            >
              [{{ m.provider }}] {{ m.label }}
            </option>
          </select>
        </div>

        <!-- Quick Mock -->
        <div class="flex items-center gap-1 shrink-0">
          <button
            type="button"
            class="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 cursor-pointer"
            title="Mock โครงการใหม่พร้อมวิชาและครู"
            @click="triggerQuickMock('project')"
          >
            +Mock โครงการ
          </button>
          <button
            type="button"
            class="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 cursor-pointer"
            title="Mock รายวิชาใหม่"
            @click="triggerQuickMock('subjects')"
          >
            +Mock วิชา
          </button>
        </div>
      </div>
    </div>

    <!-- Message List -->
    <div ref="chatContainer" class="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-gray-50/50">
      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="['flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start']"
      >
        <div class="text-[10px] text-gray-400 mb-0.5 px-1 flex items-center gap-1.5">
          <span>{{ msg.role === 'user' ? 'คุณ' : 'AI Agent' }}</span>
          <span v-if="msg.modelUsed" class="px-1 py-0.2 bg-purple-50 text-purple-600 rounded text-[9px] font-medium border border-purple-100">
            {{ msg.modelUsed }}
          </span>
          <span>• {{ msg.time }}</span>
        </div>

        <!-- Message Bubble -->
        <div
          :class="[
            'rounded-2xl px-3.5 py-2.5 max-w-[90%] text-xs shadow-xs leading-relaxed break-words whitespace-pre-wrap',
            msg.role === 'user'
              ? 'bg-purple-600 text-white rounded-tr-none'
              : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
          ]"
        >
          {{ msg.text }}
        </div>

        <!-- Tool Execution Logs -->
        <div v-if="msg.logs && msg.logs.length > 0" class="mt-1.5 max-w-[90%] space-y-1 w-full">
          <div
            v-for="(lg, lidx) in msg.logs"
            :key="lidx"
            class="bg-white border border-purple-200 rounded-lg p-2 text-[10px] font-mono text-gray-600 flex items-center justify-between shadow-xs"
          >
            <div class="flex items-center gap-1.5 truncate">
              <v-icon icon="mdi-tools" size="12" class="text-purple-600 shrink-0" />
              <span class="font-bold text-purple-700">{{ lg.tool }}</span>
              <span class="truncate text-gray-400">({{ JSON.stringify(lg.args) }})</span>
            </div>
            <v-icon icon="mdi-check-circle" size="14" class="text-green-500 shrink-0 ml-1.5" />
          </div>
        </div>

        <!-- Extracted File Preview Card -->
        <div v-if="msg.isExtractPreview && msg.data" class="mt-2 w-[90%] bg-purple-50/60 border border-purple-200 rounded-xl p-3 text-xs space-y-2">
          <!-- รายการวิชา -->
          <div v-if="msg.data.subjects && msg.data.subjects.length > 0">
            <span class="font-bold text-purple-900 text-[11px]">พบวิชา ({{ msg.data.subjects.length }})</span>
            <div class="max-h-24 overflow-y-auto space-y-0.5 mt-1 bg-white p-1.5 rounded border border-purple-100">
              <div v-for="(s, sidx) in msg.data.subjects" :key="sidx" class="flex justify-between text-[10px]">
                <span class="truncate font-medium">{{ s.name }}</span>
                <span class="text-gray-400">{{ s.level || '-' }}</span>
              </div>
            </div>
          </div>

          <!-- รายการอาจารย์ -->
          <div v-if="msg.data.teachers && msg.data.teachers.length > 0">
            <span class="font-bold text-purple-900 text-[11px]">พบอาจารย์ ({{ msg.data.teachers.length }})</span>
            <div class="max-h-20 overflow-y-auto space-y-0.5 mt-1 bg-white p-1.5 rounded border border-purple-100 text-[10px]">
              <div v-for="(t, tidx) in msg.data.teachers" :key="tidx">{{ t.name }}</div>
            </div>
          </div>

          <!-- ปุ่มกดยืนยันบันทึก -->
          <button
            type="button"
            :disabled="isImporting"
            class="w-full mt-2 py-1.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-1 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            @click="confirmImport(msg.data)"
          >
            <v-progress-circular v-if="isImporting" indeterminate size="12" width="2" color="white" />
            <v-icon v-else icon="mdi-database-import" size="14" />
            <span>{{ isImporting ? 'กำลังบันทึกข้อมูล...' : 'ยืนยันนำเข้าข้อมูลลงระบบ' }}</span>
          </button>
        </div>
      </div>

      <!-- Thinking Indicator -->
      <div v-if="isSending" class="flex items-center gap-2 text-xs text-purple-600 pl-2 py-1">
        <v-progress-circular indeterminate size="14" width="2" color="primary" />
        <span>AI Agent กำลังคิดและประมวลผลคำสั่ง...</span>
      </div>

      <div v-if="isExtracting" class="flex items-center gap-2 text-xs text-emerald-600 pl-2 py-1">
        <v-progress-circular indeterminate size="14" width="2" color="success" />
        <span>กำลังแกะและวิเคราะห์โครงสร้างไฟล์...</span>
      </div>
    </div>

    <!-- Input Footer -->
    <div class="p-2.5 border-t border-gray-200 bg-white">
      <div class="relative flex items-center gap-1.5">
        <!-- Hidden File Input -->
        <input
          ref="fileInput"
          type="file"
          accept=".xlsx,.xls,.csv"
          class="hidden"
          @change="onFileSelect"
        />

        <!-- ปุ่มแนบไฟล์ Excel/CSV -->
        <button
          type="button"
          class="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors shrink-0 cursor-pointer"
          title="โยนไฟล์ Excel / CSV ให้ Agent แกะข้อมูล"
          :disabled="isExtracting || isSending"
          @click="$refs.fileInput.click()"
        >
          <v-icon icon="mdi-paperclip" size="18" />
        </button>

        <!-- ช่องพิมพ์คำสั่ง -->
        <input
          v-model="inputMessage"
          type="text"
          placeholder="พิมพ์สั่ง Agent เช่น 'ช่วย mock วิชา 3 วิชา'..."
          class="flex-1 px-3 py-2 text-xs bg-gray-100 rounded-xl border border-transparent focus:border-purple-400 focus:bg-white focus:outline-none transition-all placeholder:text-gray-400 text-gray-800"
          :disabled="isSending || isExtracting"
          @keydown.enter="sendMessage"
        />

        <!-- ปุ่มกดส่งคำสั่ง -->
        <button
          type="button"
          class="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-purple-600 hover:bg-purple-700 active:scale-95 shrink-0 cursor-pointer shadow-xs"
          :disabled="!inputMessage.trim() || isSending || isExtracting"
          @click="sendMessage"
        >
          <v-icon icon="mdi-send" size="15" />
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.chat-sidebar {
  transition: width 0.2s ease-in-out;
}
</style>
