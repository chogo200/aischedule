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

const confirmDialog = ref(false)
const selectedUser = ref(null)

// ตัวจับ element ด้านล่างสุดเพื่อตรวจการเลื่อนจอ (Infinite Scroll Sentinel)
const loadSentinel = ref(null)
let observer = null

// ฟังก์ชันโหลดข้อมูล (mode: 'reset' เมื่อเริ่มค้นหาใหม่ / 'append' เมื่อเลื่อนลงมาโหลดเพิ่ม)
async function fetchUsers(mode = 'reset') {
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
    const { data } = await $api.get('/api/users/server', {
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

    // ตรวจสอบว่ายังมีหน้าถัดไปให้โหลดอีกหรือไม่
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
  fetchUsers('reset')
}

function onSearchClear() {
  searchInput.value = ''
  search.value = ''
  fetchUsers('reset')
}

function askDelete(user) {
  selectedUser.value = user
  confirmDialog.value = true
}

async function confirmDelete() {
  if (!selectedUser.value) return
  try {
    await $api.delete(`/api/users/${selectedUser.value.id}`)
    confirmDialog.value = false
    selectedUser.value = null
    fetchUsers('reset')
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'ลบข้อมูลไม่สำเร็จ'
  }
}

// ตั้งค่า IntersectionObserver ตรวจจับเมื่อผู้ใช้เลื่อนลงมาถึงด้านล่าง
onMounted(() => {
  if (!auth.isLogged) {
    router.push('/login')
    return
  }

  fetchUsers('reset')

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore.value && !loading.value && !loadingMore.value) {
        fetchUsers('append')
      }
    },
    { threshold: 0.1, rootMargin: '120px' }
  )

  if (loadSentinel.value) {
    observer.observe(loadSentinel.value)
  }
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
  }
})
</script>

<template>
  <div class="container mx-auto px-4 py-6 max-w-7xl">
    <!-- Top Action Bar -->
    <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between mb-6 gap-4">
      <!-- Create Button -->
      <div class="flex items-center gap-3">
        <NuxtLink to="/users/new">
          <v-btn
            color="primary"
            variant="elevated"
            prepend-icon="mdi-account-plus"
            height="44"
            class="px-5 font-medium rounded-xl shadow-sm text-none"
          >
            Create User
          </v-btn>
        </NuxtLink>
      </div>

      <!-- Modern Search Box (กล่องข้อความ + ปุ่มค้นหาวงกลมสีน้ำเงินตามภาพ) -->
      <form class="flex items-center gap-3 w-full md:w-[460px] max-w-full" @submit.prevent="onSearchSubmit">
        <div class="relative flex-1 flex items-center bg-white rounded-lg border border-gray-300 shadow-xs hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <input
            v-model="searchInput"
            type="text"
            placeholder="ค้นหาผู้ใช้งาน (ชื่อ, อีเมล, ID)"
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

        <!-- ปุ่มค้นหาวงกลมสีเทา -->
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
      class="mb-4 rounded-xl"
      closable
      @click:close="errorMsg = ''"
    >
      {{ errorMsg }}
    </v-alert>

    <!-- Users Table Card -->
    <v-card elevation="1" class="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-xs">
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <v-icon icon="mdi-account-group-outline" size="22" class="text-blue-600" />
          <h2 class="font-bold text-gray-800 text-base">รายชื่อผู้ใช้งาน (Users)</h2>
          <v-chip size="x-small" color="primary" variant="tonal" class="ml-2 font-semibold">
            แสดงแล้ว {{ items.length }} / {{ total }} รายการ
          </v-chip>
        </div>
      </div>

      <!-- Table View -->
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm border-collapse">
          <thead>
            <tr class="bg-gray-50/70 border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase tracking-wider">
              <th class="py-3 px-4 w-16">ID</th>
              <th class="py-3 px-4">ชื่อ - นามสกุล</th>
              <th class="py-3 px-4">อีเมล</th>
              <th class="py-3 px-4">บทบาท (Role)</th>
              <th class="py-3 px-4">วันที่สร้าง</th>
              <th class="py-3 px-4 text-right w-28">จัดการ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="item in items"
              :key="item.id"
              class="hover:bg-blue-50/40 transition-colors"
            >
              <td class="py-3 px-4 font-mono text-xs text-gray-400">#{{ item.id }}</td>
              <td class="py-3 px-4 font-medium text-gray-800">{{ item.name_th }}</td>
              <td class="py-3 px-4 text-gray-600">{{ item.email }}</td>
              <td class="py-3 px-4">
                <v-chip
                  size="x-small"
                  :color="item.role === 'admin' ? 'purple' : item.role === 'permis1' ? 'blue' : 'teal'"
                  variant="flat"
                  class="font-semibold uppercase"
                >
                  {{ item.role }}
                </v-chip>
              </td>
              <td class="py-3 px-4 text-xs text-gray-500">
                {{ item.created_at ? new Date(item.created_at).toLocaleDateString('th-TH') : '-' }}
              </td>
              <td class="py-3 px-4 text-right">
                <div class="flex items-center justify-end gap-1">
                  <NuxtLink :to="`/users/${item.id}`">
                    <v-btn icon="mdi-pencil-outline" size="small" variant="text" color="primary" title="แก้ไข" />
                  </NuxtLink>
                  <v-btn
                    icon="mdi-delete-outline"
                    size="small"
                    variant="text"
                    color="error"
                    title="ลบ"
                    @click="askDelete(item)"
                  />
                </div>
              </td>
            </tr>

            <!-- No Data State -->
            <tr v-if="!loading && items.length === 0">
              <td colspan="6" class="py-12 text-center text-gray-400">
                <v-icon icon="mdi-account-search-outline" size="40" class="mb-2 text-gray-300" />
                <div>ไม่พบข้อมูลผู้ใช้งาน</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Sentinel & Infinite Scroll Loading Status -->
      <div ref="loadSentinel" class="py-6 flex flex-col items-center justify-center border-t border-gray-50">
        <div v-if="loading || loadingMore" class="flex items-center gap-2 text-sm text-blue-600 py-2">
          <v-progress-circular indeterminate size="20" width="2" color="primary" />
          <span>กำลังโหลดข้อมูลเพิ่มเติมอัตโนมัติ...</span>
        </div>
        <div v-else-if="!hasMore && items.length > 0" class="text-xs text-gray-400 py-2">
          ✓ แสดงข้อมูลครบทั้งหมด {{ total }} รายการแล้ว
        </div>
      </div>
    </v-card>

    <!-- Dialog Confirm Delete -->
    <v-dialog v-model="confirmDialog" max-width="400">
      <v-card class="rounded-xl p-2">
        <v-card-title class="text-base font-bold text-gray-800">ยืนยันการลบผู้ใช้?</v-card-title>
        <v-card-text class="text-sm text-gray-600">
          คุณต้องการลบผู้ใช้ <strong class="text-red-600">{{ selectedUser?.name_th }}</strong> (#{{ selectedUser?.id }}) ใช่หรือไม่?
        </v-card-text>
        <v-card-actions class="justify-end gap-2 pb-3 pr-3">
          <v-btn variant="text" @click="confirmDialog = false">ยกเลิก</v-btn>
          <v-btn color="error" variant="flat" @click="confirmDelete">ลบข้อมูล</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
