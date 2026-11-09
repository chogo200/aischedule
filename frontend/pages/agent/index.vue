<script setup>
definePageMeta({ layout: 'default' })
import { ref, onMounted, nextTick } from 'vue'

const { $api } = useNuxtApp()

// Provider / Model: 'groq-gpt-120b', 'openrouter-nemotron', หรือ 'google'
const selectedProvider = ref('groq-gpt-120b')

// Chat state
const promptInput = ref('')
const isSending = ref(false)
const chatMessages = ref([
  {
    role: 'assistant',
    text: 'สวัสดีครับ! ผมคือ AI Agent ผู้ช่วยจัดการระบบและจัดตารางสอน คุณสามารถสั่งงานผมด้วยภาษาธรรมชาติ เช่น:\n• "ช่วย mock ข้อมูลโครงการ 2568/1 มี 3 ชั้นเรียน 4 รายวิชา และอาจารย์ 3 ท่าน"\n• "เพิ่มวิชา Web Development รหัส 30901-2001 ระดับ ปวส.2"\n• หรือลากไฟล์ Excel/CSV มาวางเพื่อแกะข้อมูลนำเข้าระบบได้เลยครับ',
    logs: []
  }
])
const chatContainer = ref(null)

// File Upload & Extract state
const fileInput = ref(null)
const selectedFile = ref(null)
const isExtracting = ref(false)
const extractResult = ref(null)
const isImporting = ref(false)
const importSuccessMsg = ref('')
const importErrorMsg = ref('')

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

// 1. ส่งคำสั่งคุยกับ Agent (Chat & Mocking)
async function onSendMessage() {
  const text = promptInput.value.trim()
  if (!text || isSending.value) return

  chatMessages.value.push({ role: 'user', text })
  promptInput.value = ''
  isSending.value = true
  scrollToBottom()

  try {
    const { data } = await $api.post('/api/agent/chat', {
      message: text,
      model: selectedProvider.value,
      provider: selectedProvider.value,
    })

    chatMessages.value.push({
      role: 'assistant',
      text: data.reply || 'ดำเนินการเรียบร้อยแล้วครับ',
      logs: data.logs || []
    })
  } catch (err) {
    chatMessages.value.push({
      role: 'assistant',
      text: 'เกิดข้อผิดพลาด: ' + (err.response?.data?.message || err.message),
      error: true,
      logs: []
    })
  } finally {
    isSending.value = false
    scrollToBottom()
  }
}

// Quick Mock Buttons
function quickMock(type) {
  if (type === 'project') {
    promptInput.value = 'ช่วย Mock ข้อมูลโครงการ 2569/1 มี 3 ชั้นเรียน 5 รายวิชา และครู 3 คนพร้อมกำหนดความเชี่ยวชาญให้ครบ'
  } else if (type === 'subjects') {
    promptInput.value = 'ช่วย Mock รายวิชาหมวดเทคโนโลยีสารสนเทศ 5 วิชา พร้อมรหัสวิชาและระดับชั้น ปวส.'
  } else if (type === 'rooms') {
    promptInput.value = 'ช่วยสร้างห้องปฏิบัติการคอมพิวเตอร์ 3 ห้อง พร้อมระบุคุณสมบัติเครื่องคอมพิวเตอร์'
  }
  onSendMessage()
}

// 2. File Upload & Extraction
function onFileSelect(e) {
  const files = e.target.files
  if (files && files[0]) {
    selectedFile.value = files[0]
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
  formData.append('model', selectedProvider.value)
  formData.append('provider', selectedProvider.value)
  formData.append('prompt', 'วิเคราะห์และสกัดข้อมูลเพื่อนำเข้าสู่ระบบจัดตารางสอน')

  try {
    const { data } = await $api.post('/api/agent/upload-extract', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    extractResult.value = data.data
  } catch (err) {
    importErrorMsg.value = err.response?.data?.message || err.message || 'วิเคราะห์ไฟล์ไม่สำเร็จ'
  } finally {
    isExtracting.value = false
  }
}

// 3. ยืนยันการนำเข้าข้อมูลที่แกะได้จากไฟล์
async function executeBatchImport() {
  if (!extractResult.value) return

  isImporting.value = true
  importSuccessMsg.value = ''
  importErrorMsg.value = ''

  try {
    const { data } = await $api.post('/api/agent/execute-import', {
      subjects: extractResult.value.subjects || [],
      teachers: extractResult.value.teachers || [],
      rooms: extractResult.value.rooms || [],
      classes: extractResult.value.classes || [],
    })
    importSuccessMsg.value = data.message || 'นำเข้าข้อมูลสู่ระบบสำเร็จเรียบร้อย'
    extractResult.value = null
    selectedFile.value = null
  } catch (err) {
    importErrorMsg.value = err.response?.data?.message || err.message || 'นำเข้าข้อมูลไม่สำเร็จ'
  } finally {
    isImporting.value = false
  }
}
</script>

<template>
  <div class="container mx-auto px-4 py-6 max-w-6xl">
    <!-- Header -->
    <div class="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-md">
          <v-icon icon="mdi-robot-excited-outline" size="28" />
        </div>
        <div>
          <h1 class="text-xl font-bold text-gray-900 leading-tight flex items-center gap-2">
            AI Agent Assistant
            <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">LangChain</span>
          </h1>
          <p class="text-xs text-gray-500 mt-0.5">
            จัดการระบบอัตโนมัติ สั่ง Mock ข้อมูล หรือโยนไฟล์ Excel/CSV ให้ Agent แกะนำเข้าระบบทันที
          </p>
        </div>
      </div>

      <!-- Provider Selector -->
      <div class="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-xs flex-wrap">
        <span class="text-xs text-gray-500 font-medium">Model:</span>
        <button
          type="button"
          :class="[
            'text-xs px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer',
            selectedProvider === 'groq-gpt-120b'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          ]"
          @click="selectedProvider = 'groq-gpt-120b'"
        >
          <v-icon icon="mdi-lightning-bolt" size="14" />
          <span>Groq (GPT-120B แนะนำ)</span>
        </button>
        <button
          type="button"
          :class="[
            'text-xs px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer',
            selectedProvider === 'openrouter-nemotron'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          ]"
          @click="selectedProvider = 'openrouter-nemotron'"
        >
          <v-icon icon="mdi-creation" size="14" />
          <span>OpenRouter (Nemotron ฟรี)</span>
        </button>
        <button
          type="button"
          :class="[
            'text-xs px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer',
            selectedProvider === 'google'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          ]"
          @click="selectedProvider = 'google'"
        >
          <v-icon icon="mdi-google" size="14" />
          <span>Google AI Studio</span>
        </button>
      </div>
    </div>

    <!-- Main Grid: แบ่งเป็น Chat Agent และ File Extraction -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left Column: Interactive Chat & Mocking -->
      <div class="lg:col-span-7 flex flex-col h-[700px] bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <!-- Chat Header -->
        <div class="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div class="flex items-center gap-2 text-xs font-semibold text-gray-700">
            <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>Agent Console (คำสั่ง & Data Mocking)</span>
          </div>
          <!-- Quick Mock Buttons -->
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="text-[11px] px-2 py-0.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 cursor-pointer"
              @click="quickMock('project')"
            >
              + Mock โครงการ
            </button>
            <button
              type="button"
              class="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 cursor-pointer"
              @click="quickMock('subjects')"
            >
              + Mock รายวิชา
            </button>
            <button
              type="button"
              class="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer"
              @click="quickMock('rooms')"
            >
              + Mock ห้องเรียน
            </button>
          </div>
        </div>

        <!-- Chat Messages List -->
        <div ref="chatContainer" class="flex-1 overflow-y-auto p-4 space-y-4">
          <div
            v-for="(msg, idx) in chatMessages"
            :key="idx"
            :class="[
              'flex flex-col',
              msg.role === 'user' ? 'items-end' : 'items-start'
            ]"
          >
            <div
              :class="[
                'max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs whitespace-pre-wrap',
                msg.role === 'user'
                  ? 'bg-purple-600 text-white rounded-tr-none'
                  : 'bg-gray-100 text-gray-800 rounded-tl-none border border-gray-200/60'
              ]"
            >
              {{ msg.text }}
            </div>

            <!-- Tool Execution Logs (ถ้ามี) -->
            <div v-if="msg.logs && msg.logs.length > 0" class="mt-2 max-w-[85%] space-y-1">
              <div
                v-for="(lg, lidx) in msg.logs"
                :key="lidx"
                class="bg-gray-50 border border-gray-200 rounded-lg p-2 text-[11px] font-mono text-gray-600 flex items-center justify-between"
              >
                <div class="flex items-center gap-1.5 truncate">
                  <v-icon icon="mdi-tools" size="12" class="text-purple-600 shrink-0" />
                  <span class="font-bold text-purple-700">{{ lg.tool }}</span>
                  <span class="truncate text-gray-500">({{ JSON.stringify(lg.args) }})</span>
                </div>
                <v-icon icon="mdi-check-circle" size="14" class="text-green-500 shrink-0 ml-2" />
              </div>
            </div>
          </div>

          <!-- Loading Indicator -->
          <div v-if="isSending" class="flex items-center gap-2 text-xs text-purple-600 py-2">
            <v-progress-circular indeterminate size="16" width="2" color="primary" />
            <span>AI Agent กำลังคิดและประมวลผลคำสั่ง...</span>
          </div>
        </div>

        <!-- Chat Input Bar -->
        <form class="p-3 border-t border-gray-100 bg-white flex items-center gap-2" @submit.prevent="onSendMessage">
          <input
            v-model="promptInput"
            type="text"
            placeholder="พิมพ์สั่ง Agent เช่น 'ช่วย mock ข้อมูลวิชา 3 วิชา' หรือ 'สร้างโครงการใหม่'..."
            class="flex-1 h-11 px-4 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-purple-500 focus:outline-none transition-all"
            :disabled="isSending"
          />
          <button
            type="submit"
            :disabled="isSending || !promptInput.trim()"
            class="h-11 px-5 bg-purple-600 hover:bg-purple-700 active:scale-95 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <v-icon icon="mdi-send" size="14" />
            <span>สั่งงาน</span>
          </button>
        </form>
      </div>

      <!-- Right Column: File Extractor & Importer -->
      <div class="lg:col-span-5 flex flex-col h-[700px] bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div class="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div class="flex items-center gap-2 text-xs font-semibold text-gray-700">
            <v-icon icon="mdi-file-excel-box" size="16" class="text-emerald-600" />
            <span>แกะไฟล์นำเข้าระบบ (File Extractor)</span>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-4">
          <!-- Drop Area / File Picker -->
          <div
            class="border-2 border-dashed border-gray-300 hover:border-purple-400 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-gray-50/50"
            @click="$refs.fileInput.click()"
          >
            <input
              ref="fileInput"
              type="file"
              accept=".xlsx,.xls,.csv"
              class="hidden"
              @change="onFileSelect"
            />
            <v-icon icon="mdi-cloud-upload-outline" size="40" class="text-purple-500 mb-2" />
            <div class="text-xs font-bold text-gray-800">
              {{ selectedFile ? selectedFile.name : 'คลิกเพื่อเลือกไฟล์ Excel หรือ CSV' }}
            </div>
            <p class="text-[11px] text-gray-400 mt-1">
              รองรับไฟล์ .xlsx, .xls, .csv สำหรับแกะข้อมูลรายวิชา, ครู, ห้อง, ชั้นเรียน
            </p>
          </div>

          <div v-if="selectedFile" class="flex items-center justify-end">
            <button
              type="button"
              :disabled="isExtracting"
              class="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              @click="uploadAndExtractFile"
            >
              <v-progress-circular v-if="isExtracting" indeterminate size="14" width="2" color="white" />
              <v-icon v-else icon="mdi-magnify-scan" size="16" />
              <span>{{ isExtracting ? 'กำลังวิเคราะห์...' : 'ให้ Agent แกะไฟล์' }}</span>
            </button>
          </div>

          <!-- Alert Messages -->
          <v-alert v-if="importSuccessMsg" type="success" variant="tonal" class="rounded-xl text-xs" closable>
            {{ importSuccessMsg }}
          </v-alert>
          <v-alert v-if="importErrorMsg" type="error" variant="tonal" class="rounded-xl text-xs" closable>
            {{ importErrorMsg }}
          </v-alert>

          <!-- Extracted Preview Card -->
          <div v-if="extractResult" class="border border-purple-200 rounded-xl p-4 bg-purple-50/30 space-y-3">
            <div class="flex items-center justify-between border-b border-purple-100 pb-2">
              <h3 class="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                <v-icon icon="mdi-check-decagram" size="16" class="text-purple-600" />
                <span>ผลการวิเคราะห์ไฟล์</span>
              </h3>
              <button
                type="button"
                :disabled="isImporting"
                class="h-8 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                @click="executeBatchImport"
              >
                <v-progress-circular v-if="isImporting" indeterminate size="12" width="2" color="white" />
                <v-icon v-else icon="mdi-database-import" size="14" />
                <span>ยืนยันบันทึกเข้าระบบ</span>
              </button>
            </div>

            <p class="text-xs text-gray-700 italic">{{ extractResult.summary }}</p>

            <!-- รายการวิชาที่พบ -->
            <div v-if="extractResult.subjects && extractResult.subjects.length > 0">
              <div class="text-[11px] font-bold text-gray-700 mb-1">
                รายวิชาที่ตรวจพบ ({{ extractResult.subjects.length }} รายการ):
              </div>
              <div class="max-h-36 overflow-y-auto space-y-1 bg-white p-2 rounded-lg border border-gray-200 text-xs">
                <div v-for="(s, idx) in extractResult.subjects" :key="idx" class="flex items-center justify-between py-0.5 border-b border-gray-50 last:border-0">
                  <div class="flex items-center gap-1.5 truncate">
                    <span v-if="s.code" class="font-mono text-purple-600 text-[10px] bg-purple-50 px-1 rounded">{{ s.code }}</span>
                    <span class="truncate font-medium text-gray-800">{{ s.name }}</span>
                  </div>
                  <span v-if="s.level" class="text-[10px] text-gray-400 bg-gray-100 px-1 rounded">{{ s.level }}</span>
                </div>
              </div>
            </div>

            <!-- รายการอาจารย์ที่พบ -->
            <div v-if="extractResult.teachers && extractResult.teachers.length > 0">
              <div class="text-[11px] font-bold text-gray-700 mb-1">
                อาจารย์ที่ตรวจพบ ({{ extractResult.teachers.length }} ท่าน):
              </div>
              <div class="max-h-28 overflow-y-auto space-y-1 bg-white p-2 rounded-lg border border-gray-200 text-xs">
                <div v-for="(t, idx) in extractResult.teachers" :key="idx" class="flex items-center justify-between py-0.5">
                  <span class="font-medium text-gray-800">{{ t.name }}</span>
                  <span class="text-[10px] text-gray-400 truncate max-w-[150px]">{{ t.portfolio || '-' }}</span>
                </div>
              </div>
            </div>

            <!-- รายการห้องเรียนที่พบ -->
            <div v-if="extractResult.rooms && extractResult.rooms.length > 0">
              <div class="text-[11px] font-bold text-gray-700 mb-1">
                ห้องเรียนที่ตรวจพบ ({{ extractResult.rooms.length }} ห้อง):
              </div>
              <div class="max-h-24 overflow-y-auto space-y-1 bg-white p-2 rounded-lg border border-gray-200 text-xs">
                <div v-for="(r, idx) in extractResult.rooms" :key="idx" class="flex items-center justify-between py-0.5">
                  <span class="font-medium text-gray-800">{{ r.name }}</span>
                  <span class="text-[10px] text-gray-400 truncate max-w-[150px]">{{ r.feature || '-' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

