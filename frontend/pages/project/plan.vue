<script setup>
definePageMeta({ layout: 'default' })
import { ref, onMounted, computed, watch } from 'vue'

const route = useRoute()
const router = useRouter()
const { $api } = useNuxtApp()

const planId = computed(() => route.query?.plan_id)
const projectName = computed(() => route.query?.name)

const loading = ref(true)
const saving = ref(false)
const addingRow = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const plan = ref(null)
const planName = ref('')
const planSubjects = ref([]) // [{ subject_id, name, level, hours }]
const allSystemSubjects = ref([]) // [{ id, name, level }]

// Filter / Search state สำหรับตารางวิชา
const showFilter = ref(false)
const filterSearch = ref('')

// กรองรายการวิชาในตารางตามคำค้นหา (ชื่อวิชา หรือ level)
const displayedPlanSubjects = computed(() => {
  const query = (filterSearch.value || '').trim().toLowerCase()
  if (!query) return planSubjects.value
  return planSubjects.value.filter(s =>
    (s.code || '').toLowerCase().includes(query) ||
    (s.name || '').toLowerCase().includes(query) ||
    (s.level || '').toLowerCase().includes(query)
  )
})

// Input fields สำหรับแถวเพิ่มวิชาใหม่ด้านบน (ตามรูป Wireframe)
const inputSubjectCode = ref('')
const inputSubjectName = ref('')
const inputLevel = ref('')
const inputHours = ref(1)

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
    if (!q) {
      filteredSuggestions.value = []
      return
    }
    try {
      const { data } = await $api.get('/api/subjects', {
        params: { search: q, limit: 5 }
      })
      filteredSuggestions.value = data.data || []
    } catch (e) {
      console.error(e)
    }
  }, 250)
}

// เมื่อคลิกเลือกจาก Dropdown 5 อันดับแรก
function selectSuggestion(item) {
  selectedSubjectFromDropdown.value = item
  inputSubjectCode.value = item.code || ''
  inputSubjectName.value = item.name
  if (item.level) {
    inputLevel.value = item.level
  }
  isDropdownOpen.value = false
}

// ปิด dropdown เมื่อ blur (delay เพื่อให้ click event ทำงานทัน)
function onSubjectNameBlur() {
  setTimeout(() => {
    isDropdownOpen.value = false
  }, 200)
}

// Inline edit ชั่วโมงในตาราง
const editingHoursIndex = ref(null)
const editingHoursValue = ref(1)

function startEditHours(idx, currentHours) {
  editingHoursIndex.value = idx
  editingHoursValue.value = currentHours || 1
}

function saveEditHours(idx) {
  if (editingHoursIndex.value === idx) {
    planSubjects.value[idx].hours = Number(editingHoursValue.value) || 1
    editingHoursIndex.value = null
    autoSaveSubjects()
  }
}

// เพิ่มวิชาเข้าตาราง (กดปุ่ม + หรือ Enter)
async function onAddSubjectSubmit() {
  const nameTrimmed = (inputSubjectName.value || '').trim()
  if (!nameTrimmed) {
    errorMsg.value = 'กรุณาระบุชื่อวิชา'
    return
  }

  const hoursVal = Number(inputHours.value) || 1
  const levelVal = (inputLevel.value || '').trim()
  const codeVal = (inputSubjectCode.value || '').trim()

  addingRow.value = true
  errorMsg.value = ''

  try {
    let targetSubject = selectedSubjectFromDropdown.value

    // ถ้ายังไม่ได้เลือกจาก dropdown ให้ลองค้นหาในระบบว่ามีชื่อตรงเป๊ะหรือไม่
    if (!targetSubject) {
      const { data: searchRes } = await $api.get('/api/subjects', {
        params: { search: nameTrimmed, limit: 5 }
      })
      const list = searchRes.data || []
      targetSubject = list.find(s => s.name.trim().toLowerCase() === nameTrimmed.toLowerCase())
    }

    // ถ้าพิมพ์แล้วไม่ตรงสักอันเลย ให้ create รายวิชาใหม่ในระบบ
    if (!targetSubject) {
      const { data: createRes } = await $api.post('/api/subjects', {
        code: codeVal || null,
        name: nameTrimmed,
        level: levelVal || null
      })
      targetSubject = createRes.data || createRes
    }

    // ตรวจสอบว่าวิชานี้มีในตารางแผนนี้แล้วหรือยัง
    const existingIndex = planSubjects.value.findIndex(s => Number(s.subject_id) === Number(targetSubject.id))
    if (existingIndex !== -1) {
      // ถ้ามีอยู่แล้ว ให้อัปเดตชั่วโมง
      planSubjects.value[existingIndex].hours = hoursVal
      if (levelVal) planSubjects.value[existingIndex].level = levelVal
      if (targetSubject.code) planSubjects.value[existingIndex].code = targetSubject.code
    } else {
      // เพิ่มเข้าแถวรายการของแผนการสอน
      planSubjects.value.push({
        subject_id: targetSubject.id,
        code: targetSubject.code || codeVal || '',
        name: targetSubject.name,
        level: levelVal || targetSubject.level || '',
        hours: hoursVal
      })
    }

    // ล้างฟอร์ม input
    inputSubjectCode.value = ''
    inputSubjectName.value = ''
    inputLevel.value = ''
    inputHours.value = 1
    selectedSubjectFromDropdown.value = null
    isDropdownOpen.value = false

    // บันทึกเข้าฐานข้อมูลทันที
    await autoSaveSubjects()
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'เพิ่มวิชาไม่สำเร็จ'
  } finally {
    addingRow.value = false
  }
}

// ลบวิชาออกจากตารางแผนการสอน
async function removeSubjectRow(index) {
  planSubjects.value.splice(index, 1)
  await autoSaveSubjects()
}

// บันทึกรายการวิชาทั้งหมดของแผนลง Database
async function autoSaveSubjects() {
  if (!plan.value) return
  const validSubjects = planSubjects.value.map(s => ({
    subject_id: Number(s.subject_id),
    hours: Number(s.hours) || 1
  }))

  try {
    await $api.put(`/api/projects/${plan.value.project_id}/lesson-plans/${planId.value}`, {
      name: planName.value.trim() || plan.value.name,
      subjects: validSubjects
    })
    successMsg.value = 'อัปเดตแผนการสอนเรียบร้อย'
    setTimeout(() => {
      successMsg.value = ''
    }, 2000)
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'บันทึกไม่สำเร็จ'
  }
}

async function fetchPlan() {
  if (!planId.value) {
    goBack()
    return
  }

  loading.value = true
  errorMsg.value = ''
  try {
    // 1. ดึงข้อมูลรายวิชาทั้งหมดในระบบ
    const { data: subRes } = await $api.get('/api/subjects')
    const list = subRes.data || subRes.items || []
    allSystemSubjects.value = list
    const subMap = new Map(list.map(s => [s.id, s]))

    // 2. ดึงข้อมูลโครงการ
    const projQuery = projectName.value ? encodeURIComponent(projectName.value) : route.query?.project_id
    const { data: pRes } = await $api.get(`/api/projects/by-name/${projQuery}`)
    const project = pRes.data || pRes

    const { data: plansRes } = await $api.get(`/api/projects/${project.id}/lesson-plans`)
    const plans = plansRes.data || []
    const found = plans.find(p => String(p.id) === String(planId.value))

    if (!found) {
      errorMsg.value = 'ไม่พบแผนการสอนนี้'
      return
    }

    plan.value = found
    planName.value = found.name
    planSubjects.value = (found.subjects || []).map(s => {
      const match = subMap.get(s.subject_id)
      return {
        subject_id: s.subject_id,
        code: s.subject_code || match?.code || '',
        name: s.subject_name || match?.name || `วิชา #${s.subject_id}`,
        level: s.subject_level || match?.level || '',
        hours: s.hours || 1
      }
    })
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'โหลดข้อมูลแผนการสอนไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push({
    path: '/project/detail',
    query: {
      name: projectName.value,
      tab: 'plans'
    }
  })
}

onMounted(() => {
  fetchPlan()
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
            {{ planName || 'แผนการสอน' }}
          </h1>
          <p class="text-xs text-gray-400 mt-0.5">
            โครงการ: <span class="text-blue-600 font-semibold">{{ projectName }}</span>
          </p>
        </div>
      </div>

      <!-- Filter Controls: ช่องค้นหาจะสไลด์/ปรากฏขึ้นมาข้างๆ เมื่อกดปุ่มฟิลเตอร์ -->
      <div class="flex items-center gap-2">
        <!-- ช่องค้นหาที่จะแสดงขึ้นมาข้างๆ ปุ่มฟิลเตอร์ -->
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

        <!-- ปุ่มฟิลเตอร์ (Toggle Filter) -->
        <button
          type="button"
          :class="[
            'h-9 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-all shadow-xs',
            showFilter || filterSearch
              ? 'bg-blue-50 border-blue-500 text-blue-700'
              : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700'
          ]"
          title="ค้นหา/กรองรายวิชาในแผน"
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

    <!-- Main Workspace Container (จำลองสไตล์ตามภาพ Wireframe ของผู้ใช้) -->
    <div class="bg-white rounded-2xl border border-gray-200/90 shadow-xs p-6 md:p-8">
      <!-- Loading State -->
      <div v-if="loading" class="py-16 text-center">
        <v-progress-circular indeterminate color="primary" size="36" />
      </div>

      <div v-else>
        <!-- 1. แถว Form สำหรับพิมพ์และเพิ่มวิชา (เหมือนในรูป Wireframe) -->
        <form class="flex items-start gap-2 mb-8 relative" @submit.prevent="onAddSubjectSubmit">
          <!-- Input รหัสวิชา -->
          <div class="w-28 sm:w-36">
            <input
              v-model="inputSubjectCode"
              type="text"
              placeholder="รหัสวิชา"
              autocomplete="off"
              class="w-full h-11 px-3.5 text-sm bg-white border border-black focus:border-blue-600 focus:outline-none transition-all placeholder:text-gray-400 font-normal"
            />
          </div>

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
              class="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden py-1 max-h-56 overflow-y-auto"
            >
              <div
                v-for="item in filteredSuggestions"
                :key="item.id"
                class="px-3.5 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs text-gray-800 transition-colors"
                @mousedown.prevent="selectSuggestion(item)"
              >
                <div class="flex items-center gap-2 truncate">
                  <span v-if="item.code" class="font-mono text-blue-600 font-semibold text-[11px] bg-blue-50 px-1.5 py-0.5 rounded">
                    {{ item.code }}
                  </span>
                  <span class="font-medium text-gray-900 truncate">{{ item.name }}</span>
                </div>
                <span v-if="item.level" class="text-gray-400 bg-gray-100 px-2 py-0.5 rounded text-[11px] shrink-0 ml-2">
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

          <!-- Input ชั่วโมง -->
          <div class="w-24 sm:w-28">
            <input
              v-model.number="inputHours"
              type="number"
              min="1"
              placeholder="ชั่วโมง"
              class="w-full h-11 px-3 text-sm bg-white border border-black focus:border-blue-600 focus:outline-none transition-all placeholder:text-gray-400"
            />
          </div>

          <!-- ปุ่ม Add (+) ตามรูปสีเทาอ่อน -->
          <button
            type="submit"
            :disabled="addingRow || !inputSubjectName.trim()"
            class="w-12 h-11 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 disabled:opacity-40 transition-all text-gray-800 flex items-center justify-center font-bold text-lg cursor-pointer shrink-0"
            title="เพิ่มวิชาเข้าแผนการสอน"
          >
            <v-progress-circular v-if="addingRow" indeterminate size="16" width="2" color="gray" />
            <span v-else>+</span>
          </button>
        </form>

        <!-- 2. ตารางแสดงรายการวิชาที่เพิ่มไว้ (ตามรูป Wireframe) -->
        <div class="mt-4">
          <!-- Header Labels -->
          <div class="grid grid-cols-12 text-sm text-gray-700 font-normal pb-3 px-1 border-b border-gray-100 select-none">
            <div class="col-span-3 sm:col-span-2">รหัสวิชา</div>
            <div class="col-span-4 sm:col-span-5">ชื่อวิชา</div>
            <div class="col-span-2 sm:col-span-2">level</div>
            <div class="col-span-2 sm:col-span-2 text-center sm:text-left">ชั่วโมง</div>
            <div class="col-span-1 sm:col-span-1 text-right">จัดการ</div>
          </div>

          <!-- Rows List (ใช้ displayedPlanSubjects ที่ผ่านการกรอง) -->
          <div v-if="displayedPlanSubjects.length > 0" class="divide-y divide-gray-100">
            <div
              v-for="(sub, idx) in displayedPlanSubjects"
              :key="sub.subject_id"
              class="grid grid-cols-12 items-center py-3.5 px-1 hover:bg-gray-50/80 transition-colors text-sm text-gray-800 group"
            >
              <!-- รหัสวิชา -->
              <div class="col-span-3 sm:col-span-2 font-mono text-xs text-blue-700 font-semibold pr-2 truncate">
                <span v-if="sub.code" class="bg-blue-50 px-2 py-0.5 rounded">
                  {{ sub.code }}
                </span>
                <span v-else class="text-gray-300">-</span>
              </div>

              <!-- ชื่อวิชา -->
              <div class="col-span-4 sm:col-span-5 font-medium pr-2 truncate" :title="sub.name">
                {{ sub.name }}
              </div>

              <!-- Level -->
              <div class="col-span-2 sm:col-span-2 text-gray-600 truncate">
                {{ sub.level || '-' }}
              </div>

              <!-- ชั่วโมง + ไอคอนดินสอแก้ไข -->
              <div class="col-span-2 sm:col-span-2 flex items-center justify-center sm:justify-start gap-1.5">
                <!-- Inline Edit ชั่วโมง -->
                <template v-if="editingHoursIndex === idx">
                  <input
                    v-model.number="editingHoursValue"
                    type="number"
                    min="1"
                    autofocus
                    class="w-14 h-8 px-1.5 border border-blue-500 rounded text-center text-xs focus:outline-none"
                    @keydown.enter="saveEditHours(idx)"
                    @blur="saveEditHours(idx)"
                  />
                </template>
                <template v-else>
                  <span class="font-medium">{{ sub.hours }}</span>
                  <button
                    type="button"
                    class="text-gray-400 hover:text-gray-700 p-1 cursor-pointer transition-colors"
                    title="แก้ไขชั่วโมง"
                    @click="startEditHours(idx, sub.hours)"
                  >
                    <v-icon icon="mdi-pencil" size="14" />
                  </button>
                </template>
              </div>

              <!-- ปุ่มลบวิชาออกจาก Plan (ลบเฉพาะในแผนการสอน ไม่ลบวิชาออกจากระบบ) -->
              <div class="col-span-1 sm:col-span-1 flex items-center justify-end">
                <v-btn
                  icon="mdi-trash-can-outline"
                  size="small"
                  variant="text"
                  color="error"
                  title="ลบวิชานี้ออกจากแผนการสอน"
                  @click="removeSubjectRow(planSubjects.findIndex(s => s.subject_id === sub.subject_id))"
                />
              </div>
            </div>
          </div>

          <!-- Empty Filter Result / Empty State -->
          <div v-else-if="planSubjects.length > 0 && displayedPlanSubjects.length === 0" class="text-center py-10 text-gray-400 text-xs">
            ไม่พบรายวิชาที่ตรงกับคำค้นหา "{{ filterSearch }}"
          </div>

          <!-- Empty State -->
          <div v-else class="text-center py-12 text-gray-400 text-xs">
            ยังไม่มีรายวิชาในแผนการสอนนี้ (พิมพ์ชื่อวิชาด้านบนแล้วกด + เพื่อเพิ่ม)
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
