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
const selectedItem = ref(null)

const loadSentinel = ref(null)
let observer = null

async function fetchItems(mode = 'reset') {
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
    const { data } = await $api.get('/api/teachers/server', {
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
  fetchItems('reset')
}

function onSearchClear() {
  searchInput.value = ''
  search.value = ''
  fetchItems('reset')
}

function askDelete(item) {
  selectedItem.value = item
  confirmDialog.value = true
}

async function confirmDelete() {
  if (!selectedItem.value) return
  try {
    await $api.delete(`/api/teachers/${selectedItem.value.id}`)
    confirmDialog.value = false
    selectedItem.value = null
    fetchItems('reset')
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'ลบข้อมูลไม่สำเร็จ'
  }
}

onMounted(() => {
  if (!auth.isLogged) {
    router.push('/login')
    return
  }
  fetchItems('reset')

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore.value && !loading.value && !loadingMore.value) {
        fetchItems('append')
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
    <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between mb-6 gap-4">
      <div class="flex items-center gap-3">
        <NuxtLink to="/teacher/new">
          <v-btn
            color="primary"
            variant="elevated"
            prepend-icon="mdi-account-plus"
            height="44"
            class="px-5 font-medium rounded-xl shadow-sm text-none"
          >
            Create Teacher
          </v-btn>
        </NuxtLink>
      </div>

      <form class="flex items-center gap-3 w-full md:w-[460px] max-w-full" @submit.prevent="onSearchSubmit">
        <div class="relative flex-1 flex items-center bg-white rounded-lg border border-gray-300 shadow-xs hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <input
            v-model="searchInput"
            type="text"
            placeholder="ค้นหาอาจารย์ (ชื่ออาจารย์, อีเมล, ผลงาน)"
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

    <v-card elevation="1" class="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-xs">
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <v-icon icon="mdi-account-tie-outline" size="22" class="text-blue-600" />
          <h2 class="font-bold text-gray-800 text-base">รายการอาจารย์ (Teachers)</h2>
          <v-chip size="x-small" color="primary" variant="tonal" class="ml-2 font-semibold">
            แสดงแล้ว {{ items.length }} / {{ total }} รายการ
          </v-chip>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm border-collapse">
          <thead>
            <tr class="bg-gray-50/70 border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase tracking-wider">
              <th class="py-3 px-4 w-16">ID</th>
              <th class="py-3 px-4">ชื่อ - นามสกุล</th>
              <th class="py-3 px-4">อีเมล (บัญชีผู้ใช้)</th>
              <th class="py-3 px-4">ผลงาน / Portfolio</th>
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
              <td class="py-3 px-4 font-medium text-gray-800">{{ item.name || item.name_th || '-' }}</td>
              <td class="py-3 px-4 text-gray-600 text-xs">{{ item.email || '-' }}</td>
              <td class="py-3 px-4 text-gray-600 text-xs truncate max-w-xs">{{ item.portfolio || '-' }}</td>
              <td class="py-3 px-4 text-right">
                <div class="flex items-center justify-end gap-1">
                  <NuxtLink :to="`/teacher/expert?id=${item.id}`">
                    <v-btn icon="mdi-school-outline" size="small" variant="text" color="info" title="จัดการความเชี่ยวชาญ (Expertise)" />
                  </NuxtLink>
                  <NuxtLink :to="`/teacher/${item.id}`">
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

            <tr v-if="!loading && items.length === 0">
              <td colspan="5" class="py-12 text-center text-gray-400">
                <v-icon icon="mdi-account-search-outline" size="40" class="mb-2 text-gray-300" />
                <div>ไม่พบข้อมูลอาจารย์</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

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

    <v-dialog v-model="confirmDialog" max-width="400">
      <v-card class="rounded-xl p-2">
        <v-card-title class="text-base font-bold text-gray-800">ยืนยันการลบอาจารย์?</v-card-title>
        <v-card-text class="text-sm text-gray-600">
          คุณต้องการลบข้อมูลอาจารย์ <strong class="text-red-600">{{ selectedItem?.name || selectedItem?.name_th }}</strong> (#{{ selectedItem?.id }}) ใช่หรือไม่?
        </v-card-text>
        <v-card-actions class="justify-end gap-2 pb-3 pr-3">
          <v-btn variant="text" @click="confirmDialog = false">ยกเลิก</v-btn>
          <v-btn color="error" variant="flat" @click="confirmDelete">ลบข้อมูล</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

