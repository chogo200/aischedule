<script setup>
definePageMeta({ layout: 'default' })
import { ref, onMounted } from 'vue'

const route = useRoute()
const router = useRouter()
const { $api } = useNuxtApp()

const teacherId = route.params.id
const name = ref('')
const userId = ref(null)
const portfolio = ref('')
const users = ref([])
const loading = ref(false)
const fetching = ref(true)
const errorMsg = ref('')

async function loadDetail() {
  fetching.value = true
  errorMsg.value = ''
  try {
    const [tRes, uRes] = await Promise.all([
      $api.get(`/api/teachers/${teacherId}`),
      $api.get('/api/users')
    ])

    const row = tRes.data.data || tRes.data
    name.value = row.name || ''
    userId.value = row.user_id || null
    portfolio.value = row.portfolio || ''

    const uList = uRes.data.items || uRes.data.data || []
    users.value = [
      { title: '— ไม่ผูกกับบัญชีผู้ใช้ (ระบุเฉพาะชื่ออาจารย์) —', value: null },
      ...uList.map(u => ({
        title: `${u.name_th ? u.name_th + ' ' : ''}(${u.email})`,
        value: u.id,
        userName: u.name_th || ''
      }))
    ]
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'ไม่พบข้อมูลอาจารย์นี้'
  } finally {
    fetching.value = false
  }
}

function onUserChange(selectedVal) {
  if (selectedVal) {
    const found = users.value.find(u => u.value === selectedVal)
    if (found && found.userName && !name.value.trim()) {
      name.value = found.userName
    }
  }
}

async function onSubmit() {
  if (!name.value.trim()) {
    errorMsg.value = 'กรุณาระบุชื่ออาจารย์'
    return
  }

  loading.value = true
  errorMsg.value = ''
  try {
    await $api.put(`/api/teachers/${teacherId}`, {
      name: name.value.trim(),
      user_id: userId.value || null,
      portfolio: portfolio.value.trim() || null
    })
    router.push('/teacher')
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'อัปเดตข้อมูลไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

onMounted(loadDetail)
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-xl">
    <div class="mb-5 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-gray-800">แก้ไขข้อมูลอาจารย์</h1>
        <p class="text-xs text-gray-500 mt-0.5">รหัสอาจารย์ #{{ teacherId }}</p>
      </div>
      <div class="flex items-center gap-2">
        <NuxtLink :to="`/teacher/expert?id=${teacherId}`">
          <v-btn variant="tonal" color="primary" size="small" prepend-icon="mdi-school-outline">
            จัดการความเชี่ยวชาญ (Expert)
          </v-btn>
        </NuxtLink>
        <NuxtLink to="/teacher">
          <v-btn variant="outlined" size="small" prepend-icon="mdi-arrow-left">
            ย้อนกลับ
          </v-btn>
        </NuxtLink>
      </div>
    </div>

    <v-alert v-if="errorMsg" type="error" variant="tonal" class="mb-4" closable @click:close="errorMsg = ''">
      {{ errorMsg }}
    </v-alert>

    <div v-if="fetching" class="text-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <v-card v-else class="rounded-2xl border border-gray-100 pa-6 pa-md-8 bg-white shadow-xs" elevation="1">
      <form class="d-flex flex-column ga-6" @submit.prevent="onSubmit">
        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1.5">
            ชื่ออาจารย์ (Teacher Name) <span class="text-red-500">*</span>
          </label>
          <v-text-field
            v-model="name"
            placeholder="เช่น อาจารย์ สมชาย ใจดี"
            density="comfortable"
            variant="outlined"
            prepend-inner-icon="mdi-account-tie"
            hide-details
            required
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1.5">
            บัญชีผู้ใช้งาน (User Account) <span class="text-xs text-gray-400 font-normal">(ไม่บังคับ - ปล่อยว่างได้)</span>
          </label>
          <v-select
            v-model="userId"
            :items="users"
            item-title="title"
            item-value="value"
            placeholder="เลือกบัญชีผู้ใช้ (ถ้ามี)..."
            density="comfortable"
            variant="outlined"
            prepend-inner-icon="mdi-account-outline"
            clearable
            hide-details
            @update:model-value="onUserChange"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1.5">
            ผลงาน / ประวัติ / Portfolio
          </label>
          <v-textarea
            v-model="portfolio"
            placeholder="เช่น ผลงานวิชาการ, ความเชี่ยวชาญพิเศษ, ประวัติการสอน"
            density="comfortable"
            variant="outlined"
            rows="4"
            hide-details
          />
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
          <NuxtLink to="/teacher">
            <v-btn variant="text" :disabled="loading">ยกเลิก</v-btn>
          </NuxtLink>
          <v-btn
            type="submit"
            color="primary"
            variant="flat"
            prepend-icon="mdi-content-save-edit"
            :loading="loading"
            class="px-6"
          >
            บันทึกการแก้ไข
          </v-btn>
        </div>
      </form>
    </v-card>
  </div>
</template>
