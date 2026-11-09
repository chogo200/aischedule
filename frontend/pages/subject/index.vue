<script setup>
definePageMeta({ layout: 'default' })
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'

const router = useRouter()
const { $api } = useNuxtApp()
const auth = useAuthStore()

const loading = ref(false)
const addingRow = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const items = ref([]) // รายวิชาที่แสดงในตาราง (ดึงจาก server)
const total = ref(0)
const page = ref(1)
const perPage = ref(20)

// Input form ด้านบน
const inputSubjectCode = ref('')
const inputSubjectName = ref('')
const inputLevel = ref('')

// Dropdown autocomplete สำหรับชื่อวิชา (ดึงจาก Backend 5 อันดับแรก)
const isNameDropdownOpen = ref(false)
const filteredNameSuggestions = ref([])
const selectedSubjectFromDropdown = ref(null)
let nameSearchTimeout = null

// Dropdown autocomplete สำหรับ Level (ดึงจาก Backend 5 อันดับแรก)
const isLevelDropdownOpen = ref(false)
const filteredLevelSuggestions = ref([])
let levelSearchTimeout = null

// Filter Search ด้านบนขวา (ยิงค้นหาไปหลังบ้าน)
const showFilter = ref(false)
const filterSearch = ref('')
let filterSearchTimeout = null

// Inline Editing ในแถวตาราง
const editingId = ref(null)
const editingCode = ref('')
const editingName = ref('')
const editingLevel = ref('')

// Dialog Confirm Delete
const confirmDialog = ref(false)
const selectedItem = ref(null)

// 1. ค้นหาชื่อวิชา/รหัสวิชา 5 อันดับแรกจากหลังบ้าน
function onSubjectNameInput() {
  selectedSubjectFromDropdown.value = null
  isNameDropdownOpen.value = true
  clearTimeout(nameSearchTimeout)
  nameSearchTimeout = setTimeout(async () => {
    const q = inputSubjectName.value.trim()
    if (!q) {
      filteredNameSuggestions.value = []
      return
    }
    try {
      const { data } = await $api.get('/api/subjects', {
        params: { search: q, limit: 5 }
      })
      filteredNameSuggestions.value = data.data || []
    } catch (e) {
      console.error(e)
    }
  }, 250)
}

// 2. ค้นหา Level 5 อันดับแรกจากหลังบ้าน
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

function selectNameSuggestion(item) {
  inputSubjectCode.value = item.code || ''
  inputSubjectName.value = item.name
  inputLevel.value = item.level || ''
  selectedSubjectFromDropdown.value = item
  isNameDropdownOpen.value = false
}

function selectLevelSuggestion(lvl) {
  inputLevel.value = lvl
  isLevelDropdownOpen.value = false
}

function onNameBlur() {
  setTimeout(() => {
    isNameDropdownOpen.value = false
  }, 200)
}

function onLevelBlur() {
  setTimeout(() => {
    isLevelDropdownOpen.value = false
  }, 200)
}

// โหลดรายการวิชาจาก Server (Backend-driven)
async function fetchServerSubjects() {
  loading.value = true
  errorMsg.value = ''
  try {
    const { data } = await $api.get('/api/subjects/server', {
      params: {
        page: page.value,
        perpage: perPage.value,
        sortBy: 'id',
        sortDesc: true,
        search: (filterSearch.value || '').trim()
      }
    })
    items.value = data.items || []
    total.value = Number(data.total || 0)
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'โหลดข้อมูลรายวิชาไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

// Watch เมื่อพิมพ์ในช่องฟิลเตอร์ ให้ยิงค้นหาไปหลังบ้าน
watch(filterSearch, () => {
  clearTimeout(filterSearchTimeout)
  filterSearchTimeout = setTimeout(() => {
    page.value = 1
    fetchServerSubjects()
  }, 300)
})

// เพิ่มวิชาเข้าสู่ระบบ (กดปุ่ม + หรือ Enter)
async function onAddSubjectSubmit() {
  const nameTrimmed = (inputSubjectName.value || '').trim()
  if (!nameTrimmed) {
    errorMsg.value = 'กรุณาระบุชื่อวิชา'
    return
  }

  const codeVal = (inputSubjectCode.value || '').trim()
  const levelVal = (inputLevel.value || '').trim()
  addingRow.value = true
  errorMsg.value = ''
  successMsg.value = ''

  try {
    const { data: createRes } = await $api.post('/api/subjects', {
      code: codeVal || null,
      name: nameTrimmed,
      level: levelVal || null
    })

    const created = createRes.data || createRes
    inputSubjectCode.value = ''
    inputSubjectName.value = ''
    inputLevel.value = ''
    selectedSubjectFromDropdown.value = null
    isNameDropdownOpen.value = false
    isLevelDropdownOpen.value = false

    successMsg.value = `สร้างวิชา "${created.name}" เรียบร้อยแล้ว`
    setTimeout(() => {
      successMsg.value = ''
    }, 2500)

    // รีเฟรชตารางจากหลังบ้าน
    fetchServerSubjects()
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'สร้างวิชาไม่สำเร็จ'
  } finally {
    addingRow.value = false
  }
}

// Inline Edit
function startEdit(item) {
  editingId.value = item.id
  editingCode.value = item.code || ''
  editingName.value = item.name
  editingLevel.value = item.level || ''
}

function cancelEdit() {
  editingId.value = null
  editingCode.value = ''
  editingName.value = ''
  editingLevel.value = ''
}

async function saveEdit(item) {
  const trimmed = editingName.value.trim()
  if (!trimmed) {
    cancelEdit()
    return
  }

  try {
    await $api.put(`/api/subjects/${item.id}`, {
      code: editingCode.value.trim() || null,
      name: trimmed,
      level: editingLevel.value.trim() || null
    })
    item.code = editingCode.value.trim() || null
    item.name = trimmed
    item.level = editingLevel.value.trim() || null
    cancelEdit()
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'แก้ไขข้อมูลไม่สำเร็จ'
  }
}

// Delete
function askDelete(item) {
  selectedItem.value = item
  confirmDialog.value = true
}

async function confirmDelete() {
  if (!selectedItem.value) return
  try {
    await $api.delete(`/api/subjects/${selectedItem.value.id}`)
    confirmDialog.value = false
    selectedItem.value = null
    fetchServerSubjects()
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'ลบรายวิชาไม่สำเร็จ'
  }
}

onMounted(() => {
  fetchServerSubjects()
})
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-5xl">
    <!-- Header bar -->
    <div class="mb-6 flex items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-bold text-gray-900 leading-tight">
          จัดการรายวิชาทั้งหมด (Subjects)
        </h1>
        <p class="text-xs text-gray-400 mt-0.5">
          พิมพ์ชื่อวิชาและรหัสวิชาเพื่อเพิ่มใหม่ หรือเลือกจาก 5 รายการที่ใกล้เคียงจากระบบ
        </p>
      </div>

      <!-- Filter Controls ด้านบนขวา -->
      <div class="flex items-center gap-2">
        <transition name="fade-slide">
          <div v-if="showFilter" class="relative flex items-center">
            <input
              v-model="filterSearch"
              type="text"
              placeholder="ค้นหารหัสวิชา, ชื่อวิชา, level..."
              autofocus
              class="h-9 px-3 pr-8 text-xs bg-white border border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none transition-all w-52 sm:w-64 shadow-xs"
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
          title="ค้นหา/กรองรายวิชา (ค้นหาจาก Server)"
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

    <!-- Main Workspace Container -->
    <div class="bg-white rounded-2xl border border-gray-200/90 shadow-xs p-6 md:p-8">
      <!-- 1. แถว Form สำหรับพิมพ์และเพิ่มวิชา (รหัสวิชา + ชื่อวิชา + Level + ปุ่ม +) -->
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

        <!-- Input ชื่อวิชา + Dropdown 5 อันดับแรกที่ใกล้เคียงจาก Backend -->
        <div class="relative flex-1">
          <input
            v-model="inputSubjectName"
            type="text"
            placeholder="ชื่อวิชา"
            autocomplete="off"
            class="w-full h-11 px-3.5 text-sm bg-white border border-black focus:border-blue-600 focus:outline-none transition-all placeholder:text-gray-400 font-normal"
            @input="onSubjectNameInput"
            @focus="isNameDropdownOpen = true"
            @blur="onNameBlur"
          />

          <!-- Dropdown รายการ 5 อันแรกที่ใกล้เคียง -->
          <div
            v-if="isNameDropdownOpen && filteredNameSuggestions.length > 0"
            class="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden py-1 max-h-56 overflow-y-auto"
          >
            <div
              v-for="item in filteredNameSuggestions"
              :key="item.id"
              class="px-3.5 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs text-gray-800 transition-colors"
              @mousedown.prevent="selectNameSuggestion(item)"
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
            v-else-if="isNameDropdownOpen && inputSubjectName.trim() && filteredNameSuggestions.length === 0"
            class="absolute z-50 left-0 right-0 mt-1 bg-amber-50 border border-amber-200 rounded-lg shadow-md px-3.5 py-2 text-xs text-amber-800"
          >
            <span>ไม่พบวิชานี้ในระบบ (กด <strong>+</strong> เพื่อสร้างวิชาใหม่ทันที)</span>
          </div>
        </div>

        <!-- Input Level พร้อม Dropdown จาก Backend หรือพิมพ์สร้างใหม่ -->
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

          <!-- Dropdown รายการ Level จาก Backend -->
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

          <!-- แจ้งว่าถ้าพิมพ์ชื่อใหม่ที่ไม่เคยมี จะเป็น Level ใหม่ -->
          <div
            v-else-if="isLevelDropdownOpen && inputLevel.trim() && filteredLevelSuggestions.length === 0"
            class="absolute z-50 left-0 right-0 mt-1 bg-amber-50 border border-amber-200 rounded-lg shadow-md px-2.5 py-1.5 text-[11px] text-amber-800"
          >
            <span>ระดับชั้นใหม่: "{{ inputLevel.trim() }}"</span>
          </div>
        </div>

        <!-- ปุ่ม Add (+) สีเทาอ่อน -->
        <button
          type="submit"
          :disabled="addingRow || !inputSubjectName.trim()"
          class="w-12 h-11 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 disabled:opacity-40 transition-all text-gray-800 flex items-center justify-center font-bold text-lg cursor-pointer shrink-0"
          title="เพิ่มรายวิชาใหม่"
        >
          <v-progress-circular v-if="addingRow" indeterminate size="16" width="2" color="gray" />
          <span v-else>+</span>
        </button>
      </form>

      <!-- 2. ตารางแสดงรายการวิชาจาก Server -->
      <div class="mt-4">
        <!-- Header Labels -->
        <div class="grid grid-cols-12 text-sm text-gray-700 font-normal pb-3 px-1 border-b border-gray-100 select-none">
          <div class="col-span-2 sm:col-span-1 text-gray-400 font-mono text-xs">ID</div>
          <div class="col-span-3 sm:col-span-2">รหัสวิชา</div>
          <div class="col-span-4 sm:col-span-5">ชื่อวิชา</div>
          <div class="col-span-2 sm:col-span-2">level</div>
          <div class="col-span-1 sm:col-span-2 text-right">จัดการ</div>
        </div>

        <!-- Loading State สำหรับตาราง -->
        <div v-if="loading" class="py-12 text-center">
          <v-progress-circular indeterminate color="primary" size="28" />
        </div>

        <!-- Rows List -->
        <div v-else-if="items.length > 0" class="divide-y divide-gray-100">
          <div
            v-for="sub in items"
            :key="sub.id"
            class="grid grid-cols-12 items-center py-3.5 px-1 hover:bg-gray-50/80 transition-colors text-sm text-gray-800 group"
          >
            <!-- ID -->
            <div class="col-span-2 sm:col-span-1 font-mono text-xs text-gray-400">
              #{{ sub.id }}
            </div>

            <!-- รหัสวิชา (รองรับ Inline Edit) -->
            <div class="col-span-3 sm:col-span-2 font-mono text-xs pr-2">
              <template v-if="editingId === sub.id">
                <input
                  v-model="editingCode"
                  type="text"
                  placeholder="รหัสวิชา"
                  class="w-full px-2 py-1 text-xs border border-blue-500 rounded bg-blue-50/40 focus:outline-none"
                  @keydown.enter="saveEdit(sub)"
                  @keydown.esc="cancelEdit"
                />
              </template>
              <template v-else>
                <span v-if="sub.code" class="font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  {{ sub.code }}
                </span>
                <span v-else class="text-gray-300">-</span>
              </template>
            </div>

            <!-- ชื่อวิชา (รองรับ Inline Edit) -->
            <div class="col-span-4 sm:col-span-5 font-medium pr-2">
              <template v-if="editingId === sub.id">
                <input
                  v-model="editingName"
                  type="text"
                  autofocus
                  class="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-blue-50/40 focus:outline-none"
                  @keydown.enter="saveEdit(sub)"
                  @keydown.esc="cancelEdit"
                />
              </template>
              <template v-else>
                <span class="truncate block" :title="sub.name">{{ sub.name }}</span>
              </template>
            </div>

            <!-- Level (รองรับ Inline Edit) -->
            <div class="col-span-2 sm:col-span-2 text-gray-600">
              <template v-if="editingId === sub.id">
                <input
                  v-model="editingLevel"
                  type="text"
                  class="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-blue-50/40 focus:outline-none"
                  placeholder="level"
                  @keydown.enter="saveEdit(sub)"
                  @keydown.esc="cancelEdit"
                />
              </template>
              <template v-else>
                <span v-if="sub.level" class="text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-xs">
                  {{ sub.level }}
                </span>
                <span v-else class="text-gray-300 text-xs">-</span>
              </template>
            </div>

            <!-- จัดการ (ปุ่มแก้ไข Inline + ปุ่มลบ) -->
            <div class="col-span-1 sm:col-span-2 flex items-center justify-end gap-1">
              <template v-if="editingId === sub.id">
                <v-btn
                  icon="mdi-check"
                  size="small"
                  variant="flat"
                  color="success"
                  title="บันทึก"
                  @click="saveEdit(sub)"
                />
                <v-btn
                  icon="mdi-close"
                  size="small"
                  variant="text"
                  color="gray"
                  title="ยกเลิก"
                  @click="cancelEdit"
                />
              </template>
              <template v-else>
                <button
                  type="button"
                  class="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg transition-colors cursor-pointer"
                  title="แก้ไขรายวิชา"
                  @click="startEdit(sub)"
                >
                  <v-icon icon="mdi-pencil-outline" size="18" />
                </button>
                <v-btn
                  icon="mdi-trash-can-outline"
                  size="small"
                  variant="text"
                  color="error"
                  title="ลบวิชานี้ออกจากระบบ"
                  @click="askDelete(sub)"
                />
              </template>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-16 text-gray-400 text-xs">
          <v-icon icon="mdi-book-search-outline" size="36" class="text-gray-300 mb-2" />
          <div v-if="filterSearch">ไม่พบรายวิชาที่ตรงกับคำค้นหา "{{ filterSearch }}"</div>
          <div v-else>ยังไม่มีรายวิชาในระบบ (พิมพ์ชื่อวิชาด้านบนแล้วกด + เพื่อเพิ่ม)</div>
        </div>

        <!-- Footer Total -->
        <div class="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>แสดง {{ items.length }} จากทั้งหมด {{ total }} รายการ</span>
          <span v-if="filterSearch">กรองด้วยคำค้นหา: "{{ filterSearch }}"</span>
        </div>
      </div>
    </div>

    <!-- Confirm Delete Modal -->
    <v-dialog v-model="confirmDialog" max-width="400">
      <v-card class="rounded-xl p-2">
        <v-card-title class="text-base font-bold text-gray-800">ยืนยันการลบรายวิชา?</v-card-title>
        <v-card-text class="text-sm text-gray-600">
          คุณต้องการลบรายวิชา <strong class="text-red-600">{{ selectedItem?.name }}</strong> (ID: #{{ selectedItem?.id }}) ออกจากระบบใช่หรือไม่?
        </v-card-text>
        <v-card-actions class="justify-end gap-2 pb-3 pr-3">
          <v-btn variant="text" @click="confirmDialog = false">ยกเลิก</v-btn>
          <v-btn color="error" variant="flat" @click="confirmDelete">ลบข้อมูล</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
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
