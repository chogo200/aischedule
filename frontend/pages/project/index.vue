<script setup>
definePageMeta({ layout: 'default' })
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '~/stores/auth'

const router = useRouter()
const { $api } = useNuxtApp()
const auth = useAuthStore()

const search = ref('')
const searchInput = ref('')
const items = ref([])
const total = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
const errorMsg = ref('')

const page = ref(1)
const perPage = ref(12)
const hasMore = ref(true)

// Dialogs
const folderDialog = ref(false)
const isEditing = ref(false)
const editingId = ref(null)
const folderName = ref('')
const saving = ref(false)

const confirmDialog = ref(false)
const selectedItem = ref(null)

const loadSentinel = ref(null)
let observer = null

async function fetchProjects(mode = 'reset') {
  if (mode === 'reset') {
    loading.value = true
    page.value = 1
    items.value = []
  } else {
    if (loadingMore.value || !hasMore.value) return
    loadingMore.value = true
  }

  errorMsg.value = ''

  try {
    const { data } = await $api.get('/api/projects/server', {
      params: {
        page: page.value,
        perpage: perPage.value,
        sortBy: 'id',
        sortDesc: true,
        search: search.value
      }
    })

    const newItems = data.items || []
    total.value = Number(data.total || 0)

    if (mode === 'reset') {
      items.value = newItems
    } else {
      items.value = [...items.value, ...newItems]
    }

    hasMore.value = items.value.length < total.value
    if (hasMore.value && newItems.length > 0) {
      page.value += 1
    }
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'โหลดข้อมูลไม่สำเร็จ'
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function onSearchSubmit() {
  search.value = searchInput.value.trim()
  fetchProjects('reset')
}

function onSearchClear() {
  searchInput.value = ''
  search.value = ''
  fetchProjects('reset')
}

// Inline Renaming State (เหมือนเปลี่ยนชื่อโฟลเดอร์ใน Windows)
const renamingId = ref(null)
const inlineRenameName = ref('')
const inlineRenaming = ref(false)

function startInlineRename(item, event) {
  if (event) event.stopPropagation()
  renamingId.value = item.id
  inlineRenameName.value = item.name
}

function cancelInlineRename() {
  renamingId.value = null
  inlineRenameName.value = ''
}

async function submitInlineRename(item) {
  if (!renamingId.value) return
  const trimmed = inlineRenameName.value.trim()

  if (!trimmed || trimmed === item.name) {
    cancelInlineRename()
    return
  }

  inlineRenaming.value = true
  try {
    await $api.put(`/api/projects/${item.id}`, { name: trimmed })
    item.name = trimmed
    cancelInlineRename()
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'เปลี่ยนชื่อโครงการไม่สำเร็จ'
  } finally {
    inlineRenaming.value = false
  }
}

function openCreateFolder() {
  isEditing.value = false
  editingId.value = null
  folderName.value = ''
  folderDialog.value = true
}

function openEditFolder(item) {
  isEditing.value = true
  editingId.value = item.id
  folderName.value = item.name
  folderDialog.value = true
}

async function saveFolder() {
  if (!folderName.value.trim()) return

  saving.value = true
  try {
    if (isEditing.value) {
      await $api.put(`/api/projects/${editingId.value}`, { name: folderName.value.trim() })
    } else {
      await $api.post('/api/projects', { name: folderName.value.trim() })
    }
    folderDialog.value = false
    fetchProjects('reset')
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'บันทึกโฟลเดอร์ไม่สำเร็จ'
  } finally {
    saving.value = false
  }
}

function askDelete(item) {
  selectedItem.value = item
  confirmDialog.value = true
}

async function confirmDelete() {
  if (!selectedItem.value) return
  try {
    await $api.delete(`/api/projects/${selectedItem.value.id}`)
    confirmDialog.value = false
    selectedItem.value = null
    fetchProjects('reset')
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'ลบโฟลเดอร์ไม่สำเร็จ'
  }
}

onMounted(() => {
  if (!auth.isLogged) {
    router.push('/login')
    return
  }
  fetchProjects('reset')

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore.value && !loading.value && !loadingMore.value) {
        fetchProjects('append')
      }
    },
    { threshold: 0.1, rootMargin: '120px' }
  )

  if (loadSentinel.value) {
    observer.observe(loadSentinel.value)
  }
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})
</script>

<template>
  <div class="container mx-auto px-4 py-6 max-w-7xl">
    <!-- Top Action Bar -->
    <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between mb-6 gap-4">
      <!-- Create New Project Button -->
      <div class="flex items-center gap-3">
        <v-btn
          color="primary"
          variant="elevated"
          prepend-icon="mdi-plus"
          height="44"
          class="px-5 font-medium rounded-xl shadow-sm text-none"
          @click="openCreateFolder"
        >
          New Project
        </v-btn>
      </div>

      <!-- Modern Search Box -->
      <form class="flex items-center gap-3 w-full md:w-[460px] max-w-full" @submit.prevent="onSearchSubmit">
        <div class="relative flex-1 flex items-center bg-white rounded-lg border border-gray-300 shadow-xs hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <input
            v-model="searchInput"
            type="text"
            placeholder="ค้นหาโครงการ..."
            class="w-full py-2.5 px-4 text-sm text-gray-800 bg-transparent focus:outline-none placeholder:text-gray-400"
          />
          <button
            v-if="searchInput"
            type="button"
            class="pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
            @click="onSearchClear"
          >
            <v-icon icon="mdi-close-circle" size="16" />
          </button>
        </div>

        <button
          type="submit"
          class="w-11 h-11 rounded-full bg-gray-600 hover:bg-gray-700 active:scale-95 text-white flex items-center justify-center shadow-sm shrink-0 transition-all disabled:opacity-50"
          :disabled="loading || loadingMore"
          title="ค้นหา"
        >
          <v-progress-circular v-if="loading" indeterminate size="18" width="2" color="white" />
          <v-icon v-else icon="mdi-magnify" size="20" />
        </button>
      </form>
    </div>

    <!-- Error Alert -->
    <v-alert
      v-if="errorMsg"
      type="error"
      variant="tonal"
      class="mb-5 rounded-xl"
      closable
      @click:close="errorMsg = ''"
    >
      {{ errorMsg }}
    </v-alert>

    <!-- Project Header -->
    <div class="flex items-center justify-between mb-4 px-1">
      <div class="flex items-center gap-2 text-sm text-gray-600 font-semibold">
        <v-icon icon="mdi-folder-network-outline" size="20" class="text-blue-600" />
        <span>โครงการทั้งหมด ({{ total }} รายการ)</span>
      </div>
      <div class="text-xs text-gray-400">
        คลิกเพื่อเปิดดูรายละเอียดโครงการ
      </div>
    </div>

    <!-- Project Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      <div
        v-for="item in items"
        :key="item.id"
        class="group relative bg-white border border-gray-200/90 hover:border-blue-500 rounded-2xl p-4 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer flex flex-col items-center text-center select-none"
        @click="router.push({ path: '/project/detail', query: { name: item.name, tab: 'schedules' } })"
      >
        <!-- Floating Action Menu (แสดงเมื่อ Hover) -->
        <div class="absolute top-2 right-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 backdrop-blur-xs rounded-lg shadow-xs border border-gray-100" @click.stop>
          <v-btn
            icon="mdi-pencil-outline"
            size="x-small"
            variant="text"
            color="primary"
            title="เปลี่ยนชื่อโครงการ (Inline Rename)"
            @click="startInlineRename(item, $event)"
          />
          <v-btn
            icon="mdi-delete-outline"
            size="x-small"
            variant="text"
            color="error"
            title="ลบ"
            @click="askDelete(item)"
          />
        </div>

        <!-- Big Folder Icon -->
        <div class="w-16 h-16 rounded-2xl bg-amber-50 group-hover:bg-blue-50 text-amber-500 group-hover:text-blue-600 flex items-center justify-center transition-all mb-3 mt-1 shadow-xs group-hover:scale-105">
          <v-icon icon="mdi-folder" size="38" />
        </div>

        <!-- Project Name: โหมดปกติ กับ โหมดแก้ไขชื่อในตัว (Inline Rename เหมือน Windows) -->
        <div class="w-full px-1 min-h-[36px] flex items-center justify-center" @click.stop>
          <!-- 1. ช่อง Input เมื่อกำลังกดเปลี่ยนชื่อ (Windows style) -->
          <div v-if="renamingId === item.id" class="w-full flex items-center gap-1">
            <input
              v-model="inlineRenameName"
              type="text"
              autofocus
              class="w-full px-2 py-1 text-xs font-semibold text-center text-gray-900 bg-blue-50 border-2 border-blue-500 rounded-md focus:outline-none shadow-xs select-text"
              @keydown.enter.prevent="submitInlineRename(item)"
              @keydown.esc.prevent="cancelInlineRename"
              @blur="submitInlineRename(item)"
            />
          </div>

          <!-- 2. ชื่อโครงการปกติ พร้อมไอคอนดินสอข้างชื่อ -->
          <div
            v-else
            class="flex items-center justify-center gap-1 w-full group/name"
          >
            <h3
              class="font-bold text-xs sm:text-sm text-gray-800 group-hover:text-blue-600 truncate transition-colors text-center"
              :title="item.name"
            >
              {{ item.name }}
            </h3>

            <!-- ปุ่มดินสอข้างชื่อ -->
            <button
              type="button"
              class="opacity-0 group-hover/name:opacity-100 group-hover:opacity-60 hover:!opacity-100 text-gray-400 hover:text-blue-600 transition-opacity p-0.5 rounded shrink-0"
              title="กดเพื่อแก้ชื่อ"
              @click.stop="startInlineRename(item, $event)"
            >
              <v-icon icon="mdi-pencil" size="13" />
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && items.length === 0" class="py-16 text-center bg-white rounded-2xl border border-dashed border-gray-200 mt-4">
      <v-icon icon="mdi-folder-open-outline" size="56" class="text-gray-300 mb-3" />
      <h3 class="text-base font-bold text-gray-700">ยังไม่มีโครงการในระบบ</h3>
      <p class="text-xs text-gray-400 mt-1 mb-4">กดปุ่มด้านบนเพื่อสร้างโครงการแรกของคุณ</p>
      <v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" @click="openCreateFolder">
        สร้างโครงการใหม่
      </v-btn>
    </div>

    <!-- Infinite Scroll Sentinel -->
    <div ref="loadSentinel" class="py-6 flex flex-col items-center justify-center">
      <div v-if="loading || loadingMore" class="flex items-center gap-2 text-sm text-blue-600 py-2">
        <v-progress-circular indeterminate size="20" width="2" color="primary" />
        <span>กำลังโหลดโครงการเพิ่มเติม...</span>
      </div>
      <div v-else-if="!hasMore && items.length > 0" class="text-xs text-gray-400 py-2">
        ✓ แสดงครบทั้งหมด {{ total }} รายการแล้ว
      </div>
    </div>

    <!-- Modal Create / Edit Project -->
    <v-dialog v-model="folderDialog" max-width="420">
      <v-card class="rounded-2xl pa-6 bg-white shadow-lg">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <v-icon :icon="isEditing ? 'mdi-pencil-outline' : 'mdi-plus'" size="22" />
          </div>
          <div>
            <h3 class="font-bold text-base text-gray-800">
              {{ isEditing ? 'เปลี่ยนชื่อโครงการ' : 'สร้างโครงการใหม่' }}
            </h3>
            <p class="text-xs text-gray-400 mt-0.5">
              {{ isEditing ? 'ระบุชื่อโครงการใหม่' : 'ตั้งชื่อโครงการสำหรับจัดตารางเรียนและทรัพยากร' }}
            </p>
          </div>
        </div>

        <form @submit.prevent="saveFolder">
          <v-text-field
            v-model="folderName"
            label="ชื่อโครงการ"
            placeholder="เช่น โครงการพัฒนาทักษะวิชาชีพ 2568"
            density="comfortable"
            variant="outlined"
            prepend-inner-icon="mdi-folder-outline"
            hide-details
            autofocus
            class="mb-6 bg-gray-50/50 rounded-lg"
          />

          <div class="flex items-center justify-end gap-2">
            <v-btn variant="text" :disabled="saving" class="rounded-lg text-none" @click="folderDialog = false">
              ยกเลิก
            </v-btn>
            <v-btn
              type="submit"
              color="primary"
              variant="flat"
              :loading="saving"
              :disabled="!folderName.trim()"
              class="px-5 rounded-xl font-medium text-none"
            >
              {{ isEditing ? 'บันทึกการแก้ไข' : 'สร้างโครงการ' }}
            </v-btn>
          </div>
        </form>
      </v-card>
    </v-dialog>

    <!-- Dialog Confirm Delete -->
    <v-dialog v-model="confirmDialog" max-width="400">
      <v-card class="rounded-xl pa-5">
        <v-card-title class="text-base font-bold text-gray-800 px-0 pt-0">ยืนยันการลบโครงการ?</v-card-title>
        <v-card-text class="text-sm text-gray-600 px-0 py-2">
          คุณต้องการลบโครงการ <strong class="text-red-600">{{ selectedItem?.name }}</strong> ใช่หรือไม่? ข้อมูลความสัมพันธ์ที่อยู่ภายในโครงการนี้จะถูกลบไปด้วย
        </v-card-text>
        <v-card-actions class="justify-end gap-2 px-0 pb-0 pt-4">
          <v-btn variant="text" @click="confirmDialog = false">ยกเลิก</v-btn>
          <v-btn color="error" variant="flat" @click="confirmDelete">ลบโครงการ</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

