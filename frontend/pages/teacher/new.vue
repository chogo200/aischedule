<script setup>
definePageMeta({ layout: 'default' })
import { ref, onMounted } from 'vue'

const router = useRouter()
const { $api } = useNuxtApp()

const name = ref('')
const userId = ref(null)
const portfolio = ref('')
const users = ref([])
const loading = ref(false)
const loadingUsers = ref(true)
const errorMsg = ref('')

async function loadUsers() {
  loadingUsers.value = true
  try {
    const { data } = await $api.get('/api/users')
    const list = data.items || data.data || []
    users.value = [
      { title: '— ไม่ผูกกับบัญชีผู้ใช้ (ระบุเฉพาะชื่ออาจารย์) —', value: null },
      ...list.map(u => ({
        title: `${u.name_th ? u.name_th + ' ' : ''}(${u.email})`,
        value: u.id,
        userName: u.name_th || ''
      }))
    ]
  } catch (e) {
    console.error(e)
  } finally {
    loadingUsers.value = false
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
    await $api.post('/api/teachers', {
      name: name.value.trim(),
      user_id: userId.value || null,
      portfolio: portfolio.value.trim() || null
    })
    router.push('/teacher')
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'บันทึกข้อมูลไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

onMounted(loadUsers)
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-xl">
    <div class="mb-5 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-gray-800">เพิ่มข้อมูลอาจารย์ใหม่</h1>
        <p class="text-xs text-gray-500 mt-0.5">ระบุชื่ออาจารย์ และสามารถเลือกเชื่อมโยงบัญชีผู้ใช้หรือไม่ก็ได้</p>
      </div>
      <NuxtLink to="/teacher">
        <v-btn variant="outlined" size="small" prepend-icon="mdi-arrow-left">
          ย้อนกลับ
        </v-btn>
      </NuxtLink>
    </div>

    <v-alert v-if="errorMsg" type="error" variant="tonal" class="mb-4" closable @click:close="errorMsg = ''">
      {{ errorMsg }}
    </v-alert>

    <v-card class="rounded-2xl border border-gray-100 pa-6 pa-md-8 bg-white shadow-xs" elevation="1">
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
            :loading="loadingUsers"
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
            prepend-icon="mdi-content-save"
            :loading="loading"
            class="px-6"
          >
            บันทึก
          </v-btn>
        </div>
      </form>
    </v-card>
  </div>
</template>
