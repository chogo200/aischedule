<script setup>
definePageMeta({ layout: 'default' })
import { ref, onMounted, computed } from 'vue'

const router = useRouter()
const { $api } = useNuxtApp()

const name = ref('')
const level = ref('')
const loading = ref(false)
const errorMsg = ref('')

const allSubjects = ref([])

// Dropdown state สำหรับชื่อวิชา
const isNameDropdownOpen = ref(false)
// Dropdown state สำหรับ Level
const isLevelDropdownOpen = ref(false)

async function loadSubjects() {
  try {
    const { data } = await $api.get('/api/subjects')
    allSubjects.value = data.data || data.items || []
  } catch (e) {
    console.error(e)
  }
}

// 5 อันดับแรกที่ใกล้เคียงสำหรับชื่อวิชา
const filteredNameSuggestions = computed(() => {
  const query = (name.value || '').trim().toLowerCase()
  if (!query) return []
  return allSubjects.value
    .filter(s => (s.name || '').toLowerCase().includes(query))
    .slice(0, 5)
})

// รายการ Level ทั้งหมดที่มีในระบบ
const availableLevels = computed(() => {
  const set = new Set()
  allSubjects.value.forEach(s => {
    if (s.level && s.level.trim()) {
      set.add(s.level.trim())
    }
  })
  if (set.size === 0) {
    set.add('ปวช.')
    set.add('ปวส.')
  }
  return Array.from(set)
})

// 5 อันดับแรกที่ใกล้เคียงสำหรับ Level
const filteredLevelSuggestions = computed(() => {
  const query = (level.value || '').trim().toLowerCase()
  if (!query) {
    return availableLevels.value.slice(0, 5)
  }
  return availableLevels.value
    .filter(lvl => lvl.toLowerCase().includes(query))
    .slice(0, 5)
})

function selectNameSuggestion(item) {
  name.value = item.name
  if (item.level) {
    level.value = item.level
  }
  isNameDropdownOpen.value = false
}

function selectLevelSuggestion(lvl) {
  level.value = lvl
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

async function onSubmit() {
  if (!name.value.trim()) {
    errorMsg.value = 'กรุณากรอกชื่อรายวิชา'
    return
  }

  loading.value = true
  errorMsg.value = ''
  try {
    await $api.post('/api/subjects', {
      name: name.value.trim(),
      level: level.value.trim() || null
    })
    router.push('/subject')
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'บันทึกข้อมูลไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadSubjects()
})
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-2xl">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
          <v-icon icon="mdi-book-plus" size="22" />
        </div>
        <div>
          <h1 class="text-xl font-bold text-gray-900 leading-tight">เพิ่มรายวิชาใหม่</h1>
          <p class="text-xs text-gray-500 mt-0.5">กรอกชื่อรายวิชาและระดับชั้นเพื่อจัดเก็บในระบบ</p>
        </div>
      </div>
      <NuxtLink to="/subject">
        <v-btn variant="outlined" size="small" prepend-icon="mdi-arrow-left" class="rounded-lg text-none">
          ย้อนกลับ
        </v-btn>
      </NuxtLink>
    </div>

    <!-- Error Alert -->
    <v-alert
      v-if="errorMsg"
      type="error"
      variant="tonal"
      class="mb-5 rounded-xl text-sm"
      closable
      @click:close="errorMsg = ''"
    >
      {{ errorMsg }}
    </v-alert>

    <!-- Main Card -->
    <v-card elevation="1" class="rounded-2xl border border-gray-100 pa-6 pa-md-8 bg-white shadow-xs">
      <form class="d-flex flex-column ga-6" @submit.prevent="onSubmit">
        <!-- 1. ชื่อรายวิชา พร้อม Dropdown ค้นหา/เลือก -->
        <div class="relative">
          <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
            ชื่อรายวิชา <span class="text-red-500">*</span>
          </label>
          <div class="relative">
            <v-text-field
              v-model="name"
              placeholder="พิมพ์ชื่อวิชา เช่น คณิตศาสตร์, ฟิสิกส์"
              density="comfortable"
              variant="outlined"
              prepend-inner-icon="mdi-book-outline"
              hide-details
              autocomplete="off"
              required
              class="bg-gray-50/50 rounded-lg"
              @focus="isNameDropdownOpen = true"
              @input="isNameDropdownOpen = true"
              @blur="onNameBlur"
            />

            <!-- Dropdown แนะนำ 5 อันดับแรก -->
            <div
              v-if="isNameDropdownOpen && filteredNameSuggestions.length > 0"
              class="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden py-1 max-h-52 overflow-y-auto"
            >
              <div
                v-for="item in filteredNameSuggestions"
                :key="item.id"
                class="px-4 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                @mousedown.prevent="selectNameSuggestion(item)"
              >
                <span class="font-medium text-gray-900">{{ item.name }}</span>
                <span v-if="item.level" class="text-gray-400 bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                  {{ item.level }}
                </span>
              </div>
            </div>

            <!-- แจ้งเตือนเมื่อพิมพ์ชื่อใหม่ -->
            <div
              v-else-if="isNameDropdownOpen && name.trim() && filteredNameSuggestions.length === 0"
              class="absolute z-50 left-0 right-0 mt-1 bg-amber-50 border border-amber-200 rounded-xl shadow-md px-3.5 py-2 text-xs text-amber-800"
            >
              <span>ไม่พบวิชานี้ในระบบ (สามารถกดบันทึกเพื่อสร้างวิชาใหม่ได้ทันที)</span>
            </div>
          </div>
        </div>

        <!-- 2. ระดับชั้น (Level) พร้อม Dropdown ค้นหา/เลือก -->
        <div class="relative">
          <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
            ระดับชั้น / หลักสูตร
          </label>
          <div class="relative">
            <v-text-field
              v-model="level"
              placeholder="เลือกหรือพิมพ์ระดับชั้น เช่น ปวช., ปวส."
              density="comfortable"
              variant="outlined"
              prepend-inner-icon="mdi-school-outline"
              hide-details
              autocomplete="off"
              class="bg-gray-50/50 rounded-lg"
              @focus="isLevelDropdownOpen = true"
              @input="isLevelDropdownOpen = true"
              @blur="onLevelBlur"
            />

            <!-- Dropdown แนะนำ Level ที่มีในระบบ -->
            <div
              v-if="isLevelDropdownOpen && filteredLevelSuggestions.length > 0"
              class="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden py-1 max-h-48 overflow-y-auto"
            >
              <div
                v-for="lvl in filteredLevelSuggestions"
                :key="lvl"
                class="px-4 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                @mousedown.prevent="selectLevelSuggestion(lvl)"
              >
                <span class="font-medium text-gray-800">{{ lvl }}</span>
                <v-icon icon="mdi-check" size="14" class="text-blue-500 opacity-60" />
              </div>
            </div>

            <!-- แจ้งเตือนเมื่อพิมพ์ Level ใหม่ -->
            <div
              v-else-if="isLevelDropdownOpen && level.trim() && filteredLevelSuggestions.length === 0"
              class="absolute z-50 left-0 right-0 mt-1 bg-amber-50 border border-amber-200 rounded-xl shadow-md px-3.5 py-2 text-xs text-amber-800"
            >
              <span>ใช้เป็นระดับชั้นใหม่: "{{ level.trim() }}"</span>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <NuxtLink to="/subject">
            <v-btn variant="text" :disabled="loading" class="rounded-lg text-none text-gray-600">
              ยกเลิก
            </v-btn>
          </NuxtLink>
          <v-btn
            type="submit"
            color="primary"
            variant="flat"
            prepend-icon="mdi-content-save"
            height="44"
            class="px-6 rounded-xl font-medium shadow-sm text-none"
            :loading="loading"
          >
            บันทึกข้อมูล
          </v-btn>
        </div>
      </form>
    </v-card>
  </div>
</template>
