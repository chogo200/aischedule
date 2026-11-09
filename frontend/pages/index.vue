<script setup>
definePageMeta({ layout: 'default' })
import { ref, onMounted, computed, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
import TimetableSheet from '~/components/TimetableSheet.vue'

const router = useRouter()
const { $api } = useNuxtApp()
const auth = useAuthStore()

const loading = ref(true)
const projects = ref([])
const selectedProjectId = ref(null)
const schedules = ref([])
const errorMsg = ref('')

// โหมดการแสดงผลตาราง: 'class' (ตารางเรียนรายห้อง) | 'teacher' (ตารางสอนรายครู) | 'matrix' (ตารางเปรียบเทียบทุกห้อง)
const viewType = ref('class')

// สำหรับตารางรายห้อง / รายครู: เลือกดูรายคน หรือดูทั้งหมดพร้อมกัน
const selectedClassId = ref('all')
const selectedTeacherId = ref('all')

// Auto-Scheduler state
const isGenerating = ref(false)
const isClearing = ref(false)
const confirmGenDialog = ref(false)
const totalPeriods = ref(40)
const periodsPerDay = ref(8)

async function triggerGenerate() {
  if (!selectedProjectId.value) return
  isGenerating.value = true
  confirmGenDialog.value = false
  try {
    await $api.post(`/api/projects/${selectedProjectId.value}/schedules/generate`, {
      totalPeriods: totalPeriods.value,
      periodsPerDay: periodsPerDay.value,
    })
    await loadSchedules()
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'จัดตารางเรียนไม่สำเร็จ'
  } finally {
    isGenerating.value = false
  }
}

async function triggerClear() {
  if (!selectedProjectId.value) return
  isClearing.value = true
  try {
    await $api.delete(`/api/projects/${selectedProjectId.value}/schedules`)
    await loadSchedules()
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'ลบตารางเรียนไม่สำเร็จ'
  } finally {
    isClearing.value = false
  }
}

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

// รายการชั้นเรียนทั้งหมดที่มีในตาราง
const uniqueClasses = computed(() => {
  const map = new Map()
  schedules.value.forEach(s => {
    if (s.class_id && !map.has(s.class_id)) {
      map.set(s.class_id, {
        id: s.class_id,
        name: s.class_name || `ชั้นเรียน #${s.class_id}`
      })
    }
  })
  return Array.from(map.values())
})

// รายชื่อครูผู้สอนทั้งหมดที่มีในตาราง
const uniqueTeachers = computed(() => {
  const map = new Map()
  schedules.value.forEach(s => {
    if (s.teacher_id && !map.has(s.teacher_id)) {
      map.set(s.teacher_id, {
        id: s.teacher_id,
        name: s.teacher_name || `อาจารย์ #${s.teacher_id}`
      })
    }
  })
  return Array.from(map.values())
})

// กรองตารางเรียนสำหรับโหมด Class
const displayedClasses = computed(() => {
  if (selectedClassId.value === 'all') {
    return uniqueClasses.value
  }
  return uniqueClasses.value.filter(c => c.id === selectedClassId.value)
})

function getSchedulesForClass(classId) {
  return schedules.value.filter(s => s.class_id === classId)
}

// กรองตารางสอนสำหรับโหมด Teacher
const displayedTeachers = computed(() => {
  if (selectedTeacherId.value === 'all') {
    return uniqueTeachers.value
  }
  return uniqueTeachers.value.filter(t => t.id === selectedTeacherId.value)
})

function getSchedulesForTeacher(teacherId) {
  return schedules.value.filter(s => s.teacher_id === teacherId)
}

// คาบเรียน 1..N สำหรับโหมด Matrix เปรียบเทียบ
const maxPeriod = computed(() => {
  if (!schedules.value || schedules.value.length === 0) return 8
  return Math.max(...schedules.value.map(s => Number(s.period)), 8)
})
const periods = computed(() => Array.from({ length: maxPeriod.value }, (_, i) => i + 1))

function getScheduleCell(period, classId) {
  return schedules.value.find(s => Number(s.period) === Number(period) && s.class_id === classId)
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
    <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between mb-6 gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <v-icon icon="mdi-calendar-clock" size="22" />
          </div>
          <div>
            <h1 class="text-xl font-bold text-gray-900 leading-tight">ตารางเรียน & แผนการสอน (Schedule)</h1>
            <p class="text-xs text-gray-400 mt-0.5">ตารางเรียนประจำห้อง และตารางสอนประจำครู จัดสรรอัตโนมัติ</p>
          </div>
        </div>
      </div>

      <!-- Action bar: Project selector & Generate buttons -->
      <div class="flex items-center gap-2 flex-wrap">
        <label class="text-xs font-semibold text-gray-600 whitespace-nowrap">เลือกโครงการ:</label>
        <div class="w-56">
          <v-select
            v-model="selectedProjectId"
            :items="projects"
            item-title="name"
            item-value="id"
            density="compact"
            variant="outlined"
            hide-details
            class="bg-white rounded-lg text-xs"
            @update:model-value="loadSchedules"
          />
        </div>

        <!-- ปุ่มจัดตารางเรียน -->
        <v-btn
          color="primary"
          size="small"
          prepend-icon="mdi-auto-fix"
          class="rounded-xl text-none font-semibold shadow-xs"
          :loading="isGenerating"
          :disabled="!selectedProjectId"
          @click="confirmGenDialog = true"
        >
          จัดตารางเรียนอัตโนมัติ
        </v-btn>

        <v-btn
          v-if="schedules.length > 0"
          variant="outlined"
          color="error"
          size="small"
          prepend-icon="mdi-delete-sweep-outline"
          class="rounded-xl text-none font-medium"
          :loading="isClearing"
          @click="triggerClear"
        >
          ล้าง
        </v-btn>
      </div>
    </div>

    <!-- Error Alert -->
    <v-alert v-if="errorMsg" type="error" variant="tonal" class="mb-5 rounded-xl" closable @click:close="errorMsg = ''">
      {{ errorMsg }}
    </v-alert>

    <!-- Sub-bar: สลับโหมด View (ตารางห้องเรียน / ตารางครู / ภาพรวม) -->
    <div class="bg-white border border-gray-200 rounded-2xl p-3 mb-6 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <!-- Tabs เลือกโหมด -->
      <div class="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl">
        <button
          type="button"
          class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
          :class="viewType === 'class' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'"
          @click="viewType = 'class'"
        >
          <v-icon icon="mdi-google-classroom" size="15" />
          <span>ตารางเรียนรายห้อง (Class)</span>
          <span v-if="uniqueClasses.length" class="text-[10px] px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded-full font-mono">
            {{ uniqueClasses.length }}
          </span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
          :class="viewType === 'teacher' ? 'bg-white text-teal-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'"
          @click="viewType = 'teacher'"
        >
          <v-icon icon="mdi-account-tie" size="15" />
          <span>ตารางสอนรายครู (Teacher)</span>
          <span v-if="uniqueTeachers.length" class="text-[10px] px-1.5 py-0.2 bg-teal-50 text-teal-700 rounded-full font-mono">
            {{ uniqueTeachers.length }}
          </span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
          :class="viewType === 'matrix' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'"
          @click="viewType = 'matrix'"
        >
          <v-icon icon="mdi-table" size="15" />
          <span>ตารางเปรียบเทียบ (Matrix)</span>
        </button>
      </div>

      <!-- Dropdown เลือกระบุคน/ห้อง -->
      <div class="flex items-center gap-2">
        <!-- Filter ห้องเรียน -->
        <div v-if="viewType === 'class' && uniqueClasses.length > 0" class="flex items-center gap-2">
          <label class="text-xs text-gray-500 whitespace-nowrap">เลือกชั้นเรียน:</label>
          <select
            v-model="selectedClassId"
            class="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white font-medium focus:border-blue-500 focus:outline-none"
          >
            <option value="all">แสดงทุกห้องเรียน ({{ uniqueClasses.length }} ห้อง)</option>
            <option v-for="c in uniqueClasses" :key="c.id" :value="c.id">
              {{ c.name }}
            </option>
          </select>
        </div>

        <!-- Filter ครู -->
        <div v-if="viewType === 'teacher' && uniqueTeachers.length > 0" class="flex items-center gap-2">
          <label class="text-xs text-gray-500 whitespace-nowrap">เลือกอาจารย์:</label>
          <select
            v-model="selectedTeacherId"
            class="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white font-medium focus:border-teal-500 focus:outline-none"
          >
            <option value="all">แสดงครูทุกคน ({{ uniqueTeachers.length }} ท่าน)</option>
            <option v-for="t in uniqueTeachers" :key="t.id" :value="t.id">
              {{ t.name }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="py-20 text-center bg-white rounded-2xl border border-gray-100 shadow-xs">
      <v-progress-circular indeterminate color="primary" />
      <p class="text-xs text-gray-400 mt-2 font-medium">กำลังโหลดตารางเรียน...</p>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="schedules.length === 0"
      class="py-16 text-center bg-white rounded-2xl border border-gray-200 shadow-xs p-6"
    >
      <v-icon icon="mdi-calendar-blank-outline" size="56" class="text-gray-300 mb-2" />
      <h4 class="text-base font-bold text-gray-800">ยังไม่มีตารางเรียนในโครงการนี้</h4>
      <p class="text-xs text-gray-400 mt-1 max-w-sm mx-auto mb-4">
        กดปุ่มจัดตารางเรียนอัตโนมัติ เพื่อให้ระบบจัดสรรวิชา ครู และห้องเรียนลงใน 5 วัน 8 คาบ โดยไม่มีคาบชนกัน
      </p>
      <div class="flex items-center justify-center gap-2">
        <v-btn
          color="primary"
          variant="flat"
          size="small"
          prepend-icon="mdi-auto-fix"
          class="rounded-xl text-none font-semibold shadow-xs"
          :loading="isGenerating"
          :disabled="!selectedProjectId"
          @click="confirmGenDialog = true"
        >
          จัดตารางเรียนอัตโนมัติเดี๋ยวนี้
        </v-btn>
        <NuxtLink :to="`/project/detail?id=${selectedProjectId}&tab=schedules`">
          <v-btn variant="outlined" size="small" class="rounded-xl text-none">
            ดูรายละเอียดโครงการ
          </v-btn>
        </NuxtLink>
      </div>
    </div>

    <!-- CONTENT: เมื่อมีตารางเรียนแล้ว -->
    <div v-else class="space-y-6">
      <!-- 1. โหมดตารางเรียนรายห้อง (Class Timetable) -->
      <template v-if="viewType === 'class'">
        <div v-for="cls in displayedClasses" :key="cls.id" class="space-y-4">
          <TimetableSheet
            type="class"
            :title="cls.name"
            :subtitle="`โครงการ: ${projects.find(p => p.id === selectedProjectId)?.name || '-'} (ห้องเรียนทั้งหมด ${getSchedulesForClass(cls.id).length} คาบ)`"
            :schedules="getSchedulesForClass(cls.id)"
            :periods-per-day="periodsPerDay"
            :total-periods="totalPeriods"
          />
        </div>
      </template>

      <!-- 2. โหมดตารางสอนรายครู (Teacher Timetable) -->
      <template v-else-if="viewType === 'teacher'">
        <div v-for="t in displayedTeachers" :key="t.id" class="space-y-4">
          <TimetableSheet
            type="teacher"
            :title="t.name"
            :subtitle="`อาจารย์ผู้สอน | โครงการ: ${projects.find(p => p.id === selectedProjectId)?.name || '-'} (ภาระงานสอน ${getSchedulesForTeacher(t.id).length} คาบ)`"
            :schedules="getSchedulesForTeacher(t.id)"
            :periods-per-day="periodsPerDay"
            :total-periods="totalPeriods"
          />
        </div>
      </template>

      <!-- 3. โหมดตารางเปรียบเทียบ (Matrix Overview) -->
      <div v-else-if="viewType === 'matrix'" class="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <v-icon icon="mdi-table" size="18" class="text-blue-600" />
            <h3 class="text-sm font-bold text-gray-800">ตารางรวมทุกห้องเรียน (Matrix)</h3>
          </div>
          <span class="text-xs text-gray-500 font-mono">ทั้งหมด {{ schedules.length }} คาบ</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-center border-collapse border border-gray-200 rounded-lg text-xs">
            <thead>
              <tr class="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                <th class="p-2.5 border-r border-gray-200 w-32">ชั้นเรียน / คาบ</th>
                <th v-for="p in periods" :key="p" class="p-2.5 border-r border-gray-200 min-w-[110px]">
                  คาบ {{ p }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="cls in uniqueClasses" :key="cls.id" class="border-b border-gray-200 hover:bg-gray-50/50">
                <td class="p-2.5 font-bold text-gray-800 bg-gray-50/50 border-r border-gray-200 text-left">
                  <div class="flex items-center gap-1.5">
                    <v-icon icon="mdi-google-classroom" size="14" class="text-blue-600" />
                    <span>{{ cls.name }}</span>
                  </div>
                </td>
                <td
                  v-for="p in periods"
                  :key="p"
                  class="p-1.5 border-r border-gray-200 align-top"
                >
                  <div
                    v-if="getScheduleCell(p, cls.id)"
                    class="bg-blue-50/90 border border-blue-200 rounded-lg p-1.5 text-left text-[11px]"
                  >
                    <div class="font-bold text-blue-900 truncate">
                      {{ getScheduleCell(p, cls.id)?.subject_code || getScheduleCell(p, cls.id)?.subject_name }}
                    </div>
                    <div class="text-[10px] text-gray-600 truncate mt-0.5">
                      {{ getScheduleCell(p, cls.id)?.teacher_name }}
                    </div>
                    <div class="text-[9px] text-gray-500 font-mono mt-0.5">
                      {{ getScheduleCell(p, cls.id)?.room_name }}
                    </div>
                  </div>
                  <div v-else class="text-gray-300 py-2 text-[10px]">
                    -
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Dialog ยืนยันการจัดตาราง -->
    <v-dialog v-model="confirmGenDialog" max-width="450">
      <v-card class="rounded-2xl pa-6 bg-white shadow-xl">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <v-icon icon="mdi-auto-fix" size="22" />
          </div>
          <div>
            <h3 class="font-bold text-base text-gray-900 leading-tight">จัดตารางเรียนอัตโนมัติ</h3>
            <p class="text-xs text-gray-400">โครงการ: {{ projects.find(p => p.id === selectedProjectId)?.name }}</p>
          </div>
        </div>

        <p class="text-xs text-gray-600 mb-3 leading-relaxed">
          ระบบจะจัดสรรรายวิชา ครูผู้สอน และห้องเรียนลงในแต่ละคาบ โดยป้องกันไม่ให้ครูและห้องซ้ำกันในคาบเดียวกัน (5 วัน วันละ 8 คาบ รวม 40 คาบ)
        </p>

        <div class="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label class="block text-[11px] font-semibold text-gray-700 mb-1">จำนวนคาบทั้งหมด</label>
            <input
              v-model.number="totalPeriods"
              type="number"
              min="8"
              max="60"
              class="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-gray-700 mb-1">คาบต่อวัน</label>
            <input
              v-model.number="periodsPerDay"
              type="number"
              min="4"
              max="12"
              class="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <v-btn variant="text" size="small" class="rounded-lg text-none" @click="confirmGenDialog = false">
            ยกเลิก
          </v-btn>
          <v-btn
            color="primary"
            size="small"
            class="rounded-lg text-none font-semibold px-4"
            :loading="isGenerating"
            @click="triggerGenerate"
          >
            ยืนยันจัดตาราง
          </v-btn>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>
