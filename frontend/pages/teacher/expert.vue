<script setup>
definePageMeta({ layout: 'default' })
import { ref, onMounted, computed } from 'vue'

const route = useRoute()
const router = useRouter()
const { $api } = useNuxtApp()

const teacherId = computed(() => route.params.id || route.query.id)

const loading = ref(true)
const addingRow = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const teacher = ref(null)
const teacherExperts = ref([]) // [{ expert_id, teacher_id, subject_id, score, subject_name, subject_level }]

// Filter / Search state สำหรับตารางความเชี่ยวชาญ
const showFilter = ref(false)
const filterSearch = ref('')

// กรองรายการในตารางตามคำค้นหา
const displayedExperts = computed(() => {
  const query = (filterSearch.value || '').trim().toLowerCase()
  if (!query) return teacherExperts.value
  return teacherExperts.value.filter(e =>
    (e.subject_name || '').toLowerCase().includes(query) ||
    (e.subject_level || '').toLowerCase().includes(query)
  )
})

// Input fields สำหรับแถวเพิ่มความเชี่ยวชาญด้านบน (ตามรูป Wireframe)
const inputSubjectName = ref('')
const inputLevel = ref('')
const inputScore = ref(1)

// Dropdown autocomplete state สำหรับชื่อวิชา
const isDropdownOpen = ref(false)
const filteredSuggestions = ref([])
const selectedSubjectFromDropdown = ref(null)
let nameSearchTimeout = null

// Dropdown autocomplete state สำหรับ Level
const isLevelDropdownOpen = ref(false)
const filteredLevelSuggestions = ref([])
let levelSearchTimeout = null

function selectLevelSuggestion(lvl) {
  inputLevel.value = lvl
  isLevelDropdownOpen.value = false
}

function onLevelInput() {
  isLevelDropdownOpen.value = true
  clearTimeout(levelSearchTimeout)
  levelSearchTimeout = setTimeout(async () => {
    const q = inputLevel.value.trim()
    try {
      const { data } = await $api.get('/api/subjects/levels', {
        params: { search: q, limit: 5 }
      })
      filteredLevelSuggestions.value = data.data || []
    } catch (e) {
      console.error(e)
    }
  }, 250)
}

function onLevelBlur() {
  setTimeout(() => {
    isLevelDropdownOpen.value = false
  }, 200)
}

// ค้นหา 5 รายการแรกที่ใกล้เคียงจากชื่อที่พิมพ์ (ดึงจากหลังบ้าน)
function onSubjectNameInput() {
  selectedSubjectFromDropdown.value = null
  isDropdownOpen.value = true
  clearTimeout(nameSearchTimeout)

  nameSearchTimeout = setTimeout(async () => {
    const q = inputSubjectName.value.trim()
    try {
      const { data } = await $api.get('/api/subjects', {
        params: { search: q, limit: 5 }
      })
      filteredSuggestions.value = data.items || data.data || []
    } catch (e) {
      console.error(e)
    }
  }, 250)
}

function selectSuggestion(item) {
  inputSubjectName.value = item.name
  inputLevel.value = item.level || ''
  selectedSubjectFromDropdown.value = item
  isDropdownOpen.value = false
}

function onSubjectNameBlur() {
  setTimeout(() => {
    isDropdownOpen.value = false
  }, 200)
}

// Inline edit state สำหรับคะแนนความเชี่ยวชาญ (score)
const editingScoreIndex = ref(-1)
const editingScoreValue = ref(1)

function startEditScore(idx, currentVal) {
  editingScoreIndex.value = idx
  editingScoreValue.value = Number(currentVal) || 1
}

async function saveEditScore(idx) {
  if (editingScoreIndex.value === -1) return
  const item = displayedExperts.value[idx]
  if (!item) {
    editingScoreIndex.value = -1
    return
  }

  const newScore = Math.max(1, Number(editingScoreValue.value) || 1)
  item.score = newScore
  editingScoreIndex.value = -1

  try {
    await $api.put(`/api/teachers/${teacherId.value}/experts/${item.expert_id}`, {
      score: newScore
    })
    successMsg.value = 'อัปเดตระดับความเชี่ยวชาญเรียบร้อย'
    setTimeout(() => { successMsg.value = '' }, 2000)
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'แก้ไขไม่สำเร็จ'
  }
}

// Submit เมื่อกดปุ่ม + (Add Expert)
async function onAddExpertSubmit() {
  const nameVal = inputSubjectName.value.trim()
  const levelVal = inputLevel.value.trim()
  const scoreVal = Math.max(1, Number(inputScore.value) || 1)

  if (!nameVal) {
    errorMsg.value = 'กรุณาระบุชื่อวิชา'
    return
  }

  addingRow.value = true
  errorMsg.value = ''

  try {
    let targetSubject = selectedSubjectFromDropdown.value

    // ถ้าไม่ได้เลือกจาก dropdown หรือพิมพ์เอง ให้หา match ในระบบก่อน
    if (!targetSubject) {
      const { data } = await $api.get('/api/subjects', {
        params: { search: nameVal, limit: 5 }
      })
      const list = data.items || data.data || []
      targetSubject = list.find(s => s.name.trim().toLowerCase() === nameVal.toLowerCase())
    }

    // ถ้าไม่ตรงสักอันเลย ให้ create subject ใหม่ทันที
    if (!targetSubject) {
      const createRes = await $api.post('/api/subjects', {
        name: nameVal,
        level: levelVal || '-'
      })
      targetSubject = createRes.data.data || createRes.data
    }

    // เพิ่มเข้า teacher_expert หลังบ้าน
    const res = await $api.post(`/api/teachers/${teacherId.value}/experts`, {
      subject_id: targetSubject.id,
      score: scoreVal
    })

    const newExpert = res.data.data || res.data
    // ตรวจสอบว่าใน teacherExperts มีอยู่แล้วหรือไม่
    const existingIndex = teacherExperts.value.findIndex(e => Number(e.subject_id) === Number(targetSubject.id))
    if (existingIndex !== -1) {
      teacherExperts.value[existingIndex].score = scoreVal
    } else {
      teacherExperts.value.unshift(newExpert)
    }

    // ล้างฟอร์ม
    inputSubjectName.value = ''
    inputLevel.value = ''
    inputScore.value = 1
    selectedSubjectFromDropdown.value = null
    isDropdownOpen.value = false

    successMsg.value = 'เพิ่มความเชี่ยวชาญเรียบร้อย'
    setTimeout(() => { successMsg.value = '' }, 2000)
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'เพิ่มความเชี่ยวชาญไม่สำเร็จ'
  } finally {
    addingRow.value = false
  }
}

// ลบ expert ออกจากอาจารย์ (ไม่ลบวิชาออกจากระบบ)
async function removeExpertRow(expertId) {
  try {
    await $api.delete(`/api/teachers/${teacherId.value}/experts/${expertId}`)
    teacherExperts.value = teacherExperts.value.filter(e => e.expert_id !== expertId)
    successMsg.value = 'ลบความเชี่ยวชาญเรียบร้อย'
    setTimeout(() => { successMsg.value = '' }, 2000)
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'ลบไม่สำเร็จ'
  }
}

async function fetchTeacher() {
  if (!teacherId.value) {
    router.push('/teacher')
    return
  }

  loading.value = true
  errorMsg.value = ''
  try {
    const { data } = await $api.get(`/api/teachers/${teacherId.value}`)
    const row = data.data || data
    teacher.value = row
    teacherExperts.value = row.experts || []
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'ไม่พบข้อมูลอาจารย์'
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/teacher')
}

onMounted(() => {
  fetchTeacher()
})
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <!-- Header bar -->
    <div class="mb-6 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <v-btn
          icon="mdi-arrow-left"
          variant="tonal"
          color="gray"
          size="small"
          class="rounded-xl"
          title="ย้อนกลับ"
          @click="goBack"
        />
        <div>
          <h1 class="text-xl font-bold text-gray-900 leading-tight">
            {{ teacher?.name || teacher?.name_th || 'จัดการความเชี่ยวชาญอาจารย์' }}
          </h1>
          <p class="text-xs text-gray-400 mt-0.5">
            อาจารย์: <span class="text-blue-600 font-semibold">{{ teacher?.email || ('#' + teacherId) }}</span>
            <span v-if="teacher?.portfolio" class="ml-2 text-gray-500">({{ teacher.portfolio }})</span>
          </p>
        </div>
      </div>

      <!-- Filter Controls: สไลด์ขึ้นมาข้างๆ ปุ่มฟิลเตอร์ -->
      <div class="flex items-center gap-2">
        <transition name="fade-slide">
          <div v-if="showFilter" class="relative flex items-center">
            <input
              v-model="filterSearch"
              type="text"
              placeholder="ค้นหาวิชา, level..."
              autofocus
              class="h-9 px-3 pr-8 text-xs bg-white border border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none transition-all w-48 sm:w-56 shadow-xs"
            />
            <button
              v-if="filterSearch"
              type="button"
              class="absolute right-2.5 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
              @click="filterSearch = ''"
            >
              <v-icon icon="mdi-close-circle" size="14" />
            </button>
          </div>
        </transition>

        <button
          type="button"
          :class="[
            'h-9 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-all shadow-xs',
            showFilter || filterSearch
              ? 'bg-blue-50 border-blue-500 text-blue-700'
              : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700'
          ]"
          title="ค้นหา/กรองวิชาความเชี่ยวชาญ"
          @click="showFilter = !showFilter"
        >
          <v-icon icon="mdi-filter-variant" size="16" />
          <span>ฟิลเตอร์</span>
          <span
            v-if="filterSearch"
            class="ml-1 w-2 h-2 rounded-full bg-blue-600"
          />
        </button>
      </div>
    </div>

    <!-- Alerts -->
    <v-alert v-if="errorMsg" type="error" variant="tonal" class="mb-4 rounded-xl" closable @click:close="errorMsg = ''">
      {{ errorMsg }}
    </v-alert>
    <v-alert v-if="successMsg" type="success" variant="tonal" class="mb-4 rounded-xl" closable @click:close="successMsg = ''">
      {{ successMsg }}
    </v-alert>

    <!-- Main Workspace Container (จำลองสไตล์ตาม Wireframe) -->
    <div class="bg-white rounded-2xl border border-gray-200/90 shadow-xs p-6 md:p-8">
      <div v-if="loading" class="py-16 text-center">
        <v-progress-circular indeterminate color="primary" size="36" />
      </div>

      <div v-else>
        <!-- 1. แถว Form สำหรับพิมพ์และเพิ่มความเชี่ยวชาญ (ตาม Wireframe) -->
        <form class="flex items-start gap-2 mb-8 relative" @submit.prevent="onAddExpertSubmit">
          <!-- Input ชื่อวิชา + Dropdown 5 อันดับแรกที่ใกล้เคียง -->
          <div class="relative flex-1">
            <input
              v-model="inputSubjectName"
              type="text"
              placeholder="ชื่อวิชา"
              autocomplete="off"
              class="w-full h-11 px-3.5 text-sm bg-white border border-black focus:border-blue-600 focus:outline-none transition-all placeholder:text-gray-400 font-normal"
              @input="onSubjectNameInput"
              @focus="isDropdownOpen = true"
              @blur="onSubjectNameBlur"
            />

            <!-- Dropdown รายการ 5 อันแรกที่ใกล้เคียง -->
            <div
              v-if="isDropdownOpen && filteredSuggestions.length > 0"
              class="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden py-1"
            >
              <div
                v-for="item in filteredSuggestions"
                :key="item.id"
                class="px-3.5 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs text-gray-800 transition-colors"
                @mousedown.prevent="selectSuggestion(item)"
              >
                <span class="font-medium text-gray-900">{{ item.name }}</span>
                <span v-if="item.level" class="text-gray-400 bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                  {{ item.level }}
                </span>
              </div>
            </div>

            <!-- แจ้งเตือนถ้าพิมพ์แล้วไม่ตรงเลย จะสร้างวิชาใหม่เมื่อกด + -->
            <div
              v-else-if="isDropdownOpen && inputSubjectName.trim() && filteredSuggestions.length === 0"
              class="absolute z-50 left-0 right-0 mt-1 bg-amber-50 border border-amber-200 rounded-lg shadow-md px-3.5 py-2 text-xs text-amber-800"
            >
              <span>ไม่พบวิชานี้ในระบบ (กด <strong>+</strong> เพื่อสร้างวิชาใหม่ทันที)</span>
            </div>
          </div>

          <!-- Input Level พร้อม Dropdown ให้เลือก หรือพิมพ์สร้างใหม่ -->
          <div class="relative w-28 sm:w-36">
            <input
              v-model="inputLevel"
              type="text"
              placeholder="level"
              autocomplete="off"
              class="w-full h-11 px-3.5 text-sm bg-white border border-black focus:border-blue-600 focus:outline-none transition-all placeholder:text-gray-400"
              @input="onLevelInput"
              @focus="isLevelDropdownOpen = true"
              @blur="onLevelBlur"
            />

            <!-- Dropdown รายการ Level ที่มีในระบบ -->
            <div
              v-if="isLevelDropdownOpen && filteredLevelSuggestions.length > 0"
              class="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden py-1 max-h-48 overflow-y-auto"
            >
              <div
                v-for="lvl in filteredLevelSuggestions"
                :key="lvl"
                class="px-3.5 py-2 hover:bg-blue-50 cursor-pointer text-xs text-gray-800 transition-colors flex items-center justify-between"
                @mousedown.prevent="selectLevelSuggestion(lvl)"
              >
                <span>{{ lvl }}</span>
                <v-icon icon="mdi-check" size="12" class="text-blue-500 opacity-60" />
              </div>
            </div>

            <!-- แจ้งว่าถ้าพิมพ์ชื่อใหม่ที่ไม่เคยมี จะสร้างเป็น Level ใหม่ -->
            <div
              v-else-if="isLevelDropdownOpen && inputLevel.trim() && filteredLevelSuggestions.length === 0"
              class="absolute z-50 left-0 right-0 mt-1 bg-amber-50 border border-amber-200 rounded-lg shadow-md px-2.5 py-1.5 text-[11px] text-amber-800"
            >
              <span>ใช้เป็น Level ใหม่: "{{ inputLevel.trim() }}"</span>
            </div>
          </div>

          <!-- Input ระดับความเชี่ยวชาญ / score -->
          <div class="w-24 sm:w-28">
            <input
              v-model.number="inputScore"
              type="number"
              min="1"
              placeholder="คะแนน"
              class="w-full h-11 px-3 text-sm bg-white border border-black focus:border-blue-600 focus:outline-none transition-all placeholder:text-gray-400"
            />
          </div>

          <!-- ปุ่ม Add (+) ตามรูปสีเทาอ่อน -->
          <button
            type="submit"
            :disabled="addingRow || !inputSubjectName.trim()"
            class="w-12 h-11 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 disabled:opacity-40 transition-all text-gray-800 flex items-center justify-center font-bold text-lg cursor-pointer shrink-0"
            title="เพิ่มความเชี่ยวชาญให้อาจารย์"
          >
            <v-progress-circular v-if="addingRow" indeterminate size="16" width="2" color="gray" />
            <span v-else>+</span>
          </button>
        </form>

        <!-- 2. ตารางแสดงรายการวิชาความเชี่ยวชาญ (ตามรูป Wireframe) -->
        <div class="mt-4">
          <!-- Header Labels -->
          <div class="grid grid-cols-12 text-sm text-gray-700 font-normal pb-3 px-1 border-b border-gray-100 select-none">
            <div class="col-span-5 sm:col-span-6">ชื่อวิชา</div>
            <div class="col-span-3 sm:col-span-3">level</div>
            <div class="col-span-2 sm:col-span-2 text-center sm:text-left">ความเชี่ยวชาญ</div>
            <div class="col-span-2 sm:col-span-1 text-right">จัดการ</div>
          </div>

          <!-- Rows List (ใช้ displayedExperts ที่ผ่านการกรอง) -->
          <div v-if="displayedExperts.length > 0" class="divide-y divide-gray-100">
            <div
              v-for="(item, idx) in displayedExperts"
              :key="item.expert_id"
              class="grid grid-cols-12 items-center py-3.5 px-1 hover:bg-gray-50/80 transition-colors text-sm text-gray-800 group"
            >
              <!-- ชื่อวิชา -->
              <div class="col-span-5 sm:col-span-6 font-medium pr-2 truncate" :title="item.subject_name">
                {{ item.subject_name }}
              </div>

              <!-- Level -->
              <div class="col-span-3 sm:col-span-3 text-gray-600 truncate">
                {{ item.subject_level || '-' }}
              </div>

              <!-- คะแนนความเชี่ยวชาญ + ไอคอนดินสอแก้ไข -->
              <div class="col-span-2 sm:col-span-2 flex items-center justify-center sm:justify-start gap-1.5">
                <template v-if="editingScoreIndex === idx">
                  <input
                    v-model.number="editingScoreValue"
                    type="number"
                    min="1"
                    autofocus
                    class="w-14 h-8 px-1.5 border border-blue-500 rounded text-center text-xs focus:outline-none"
                    @keydown.enter="saveEditScore(idx)"
                    @blur="saveEditScore(idx)"
                  />
                </template>
                <template v-else>
                  <span class="font-medium">{{ item.score }}</span>
                  <button
                    type="button"
                    class="text-gray-400 hover:text-gray-700 p-1 cursor-pointer transition-colors"
                    title="แก้ไขระดับความเชี่ยวชาญ"
                    @click="startEditScore(idx, item.score)"
                  >
                    <v-icon icon="mdi-pencil" size="14" />
                  </button>
                </template>
              </div>

              <!-- ปุ่มลบความเชี่ยวชาญออกจากอาจารย์ (ลบเฉพาะในอาจารย์คนนี้) -->
              <div class="col-span-2 sm:col-span-1 flex items-center justify-end">
                <v-btn
                  icon="mdi-trash-can-outline"
                  size="small"
                  variant="text"
                  color="error"
                  title="ลบวิชานี้ออกจากความเชี่ยวชาญของอาจารย์"
                  @click="removeExpertRow(item.expert_id)"
                />
              </div>
            </div>
          </div>

          <!-- Empty Filter Result -->
          <div v-else-if="teacherExperts.length > 0 && displayedExperts.length === 0" class="text-center py-10 text-gray-400 text-xs">
            ไม่พบวิชาความเชี่ยวชาญที่ตรงกับคำค้นหา "{{ filterSearch }}"
          </div>

          <!-- Empty State -->
          <div v-else class="text-center py-12 text-gray-400 text-xs">
            ยังไม่มีข้อมูลความเชี่ยวชาญของอาจารย์ท่านนี้ (พิมพ์ชื่อวิชาด้านบนแล้วกด + เพื่อเพิ่ม)
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease-out;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(10px);
}
</style>
