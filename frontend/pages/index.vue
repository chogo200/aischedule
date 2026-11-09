<script setup>
definePageMeta({ layout: 'default' })
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '~/stores/auth'

const router = useRouter()
const { $api } = useNuxtApp()
const auth = useAuthStore()

const loading = ref(true)
const projects = ref([])
const selectedProjectId = ref(null)
const schedules = ref([])
const errorMsg = ref('')

// คาบเรียน 1 - 8
const periods = [1, 2, 3, 4, 5, 6, 7, 8]

async function loadInitialData() {
  loading.value = true
  try {
    const { data: pRes } = await $api.get('/api/projects')
    projects.value = pRes.data || pRes.items || []

    if (projects.value.length > 0) {
      selectedProjectId.value = projects.value[0].id
      await loadSchedules()
    }
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'โหลดข้อมูลไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

async function loadSchedules() {
  if (!selectedProjectId.value) return
  loading.value = true
  try {
    const { data } = await $api.get('/api/schedules', {
      params: { project_id: selectedProjectId.value }
    })
    schedules.value = data.data || []
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'โหลดตารางเรียนไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

// รวมชั้นเรียนที่มีในตารางของโครงการนี้
const uniqueClasses = computed(() => {
  const map = new Map()
  schedules.value.forEach(s => {
    if (s.class_id && !map.has(s.class_id)) {
      map.set(s.class_id, s.class_name || `ชั้นเรียน #${s.class_id}`)
    }
  })
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
})

// ดึงวิชาตามคาบและชั้นเรียน
function getScheduleCell(period, classId) {
  return schedules.value.find(s => s.period === period && s.class_id === classId)
}

onMounted(() => {
  if (!auth.isLogged) {
    router.push('/login')
    return
  }
  loadInitialData()
})
</script>

<template>
  <div class="container mx-auto px-4 py-6 max-w-7xl">
    <!-- Header & Project Selector -->
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-6 gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <v-icon icon="mdi-calendar-clock" size="22" />
          </div>
          <div>
            <h1 class="text-xl font-bold text-gray-900 leading-tight">ตารางเรียน & แผนการสอน (Schedule)</h1>
            <p class="text-xs text-gray-400 mt-0.5">ภาพรวมตารางเรียนที่ได้รับการจัดสรรอัตโนมัติจาก AI</p>
          </div>
        </div>
      </div>

      <!-- ตัวเลือกโครงการ -->
      <div class="flex items-center gap-3">
        <label class="text-xs font-semibold text-gray-600 whitespace-nowrap">เลือกโครงการ:</label>
        <div class="w-64">
          <v-select
            v-model="selectedProjectId"
            :items="projects"
            item-title="name"
            item-value="id"
            density="compact"
            variant="outlined"
            hide-details
            class="bg-white rounded-lg"
            @update:model-value="loadSchedules"
          />
        </div>
      </div>
    </div>

    <!-- Error Alert -->
    <v-alert v-if="errorMsg" type="error" variant="tonal" class="mb-5 rounded-xl" closable @click:close="errorMsg = ''">
      {{ errorMsg }}
    </v-alert>

    <!-- Schedule Matrix Card -->
    <v-card elevation="1" class="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-xs">
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <v-icon icon="mdi-table-clock" size="20" class="text-blue-600" />
          <h2 class="font-bold text-gray-800 text-sm">
            ตารางเรียนประจำโครงการ: {{ projects.find(p => p.id === selectedProjectId)?.name || '-' }}
          </h2>
        </div>
        <v-chip size="x-small" color="primary" variant="tonal" class="font-semibold">
          รวม {{ schedules.length }} คาบสอน
        </v-chip>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="py-16 text-center">
        <v-progress-circular indeterminate color="primary" />
        <p class="text-xs text-gray-400 mt-2 font-medium">กำลังโหลดตารางเรียน...</p>
      </div>

      <!-- ตารางแบบ Grid Matrix สไตล์ Timetable -->
      <div v-else-if="schedules.length > 0" class="overflow-x-auto p-4">
        <table class="w-full text-center border-collapse border border-gray-200 rounded-lg text-xs">
          <thead>
            <tr class="bg-gray-50/80 text-gray-600 font-semibold border-b border-gray-200">
              <th class="p-3 border-r border-gray-200 w-32">ชั้นเรียน / คาบ</th>
              <th v-for="p in periods" :key="p" class="p-3 border-r border-gray-200 min-w-[120px]">
                คาบที่ {{ p }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cls in uniqueClasses" :key="cls.id" class="border-b border-gray-200 hover:bg-gray-50/50">
              <td class="p-3 font-bold text-gray-800 bg-gray-50/50 border-r border-gray-200 text-left">
                <div class="flex items-center gap-1.5">
                  <v-icon icon="mdi-google-classroom" size="14" class="text-blue-600" />
                  <span>{{ cls.name }}</span>
                </div>
              </td>
              <td
                v-for="p in periods"
                :key="p"
                class="p-2 border-r border-gray-200 align-top"
              >
                <!-- ช่องคาบเรียน -->
                <div
                  v-if="getScheduleCell(p, cls.id)"
                  class="bg-blue-50/80 border border-blue-200/80 rounded-lg p-2 text-left shadow-2xs hover:shadow-xs transition-shadow"
                >
                  <div class="font-bold text-blue-900 truncate">
                    {{ getScheduleCell(p, cls.id)?.subject_name || 'วิชาเรียน' }}
                  </div>
                  <div class="text-[11px] text-gray-600 flex items-center gap-1 mt-0.5">
                    <v-icon icon="mdi-account-tie" size="11" />
                    <span class="truncate">{{ getScheduleCell(p, cls.id)?.teacher_name || 'อาจารย์' }}</span>
                  </div>
                  <div class="text-[10px] text-gray-500 font-mono flex items-center gap-1 mt-0.5">
                    <v-icon icon="mdi-door-closed" size="11" />
                    <span>{{ getScheduleCell(p, cls.id)?.room_name || 'ห้องเรียน' }}</span>
                  </div>
                </div>
                <!-- คาบว่าง -->
                <div v-else class="text-gray-300 py-3 text-[11px] italic">
                  -
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- No Schedule Empty State -->
      <div v-else class="py-16 text-center">
        <v-icon icon="mdi-calendar-blank-outline" size="52" class="text-gray-300 mb-2" />
        <h4 class="text-base font-bold text-gray-700">ยังไม่มีตารางเรียนในโครงการนี้</h4>
        <p class="text-xs text-gray-400 mt-1 max-w-sm mx-auto mb-4">
          คุณสามารถเข้าไปที่เมนู "โครงการ" เพื่อกำหนดชั้นเรียนและแผนการสอน จากนั้นให้ AI ช่วยจัดตารางได้ทันที
        </p>
        <NuxtLink to="/project">
          <v-btn color="primary" variant="flat" size="small" class="rounded-xl text-none">
            ไปที่หน้าโครงการ
          </v-btn>
        </NuxtLink>
      </div>
    </v-card>
  </div>
</template>
