<script setup>
definePageMeta({ layout: 'default' })
import { ref, onMounted } from 'vue'

const route = useRoute()
const router = useRouter()
const { $api } = useNuxtApp()

const userId = route.params.id
const loading = ref(false)
const fetching = ref(true)
const errorMsg = ref('')

const form = ref({
  name_th: '',
  email: '',
  role: 'admin'
})

const roles = [
  { title: 'Admin (ผู้ดูแลระบบ)', value: 'admin' },
  { title: 'Permis 1 (สิทธิ์ระดับ 1)', value: 'permis1' },
  { title: 'Permis 2 (สิทธิ์ระดับ 2)', value: 'permis2' }
]

async function loadUser() {
  fetching.value = true
  errorMsg.value = ''
  try {
    const { data } = await $api.get(`/api/users/${userId}`)
    const row = data.data || data
    form.value.name_th = row.name_th || ''
    form.value.email = row.email || ''
    form.value.role = row.role || 'admin'
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'ไม่พบข้อมูลผู้ใช้นี้'
  } finally {
    fetching.value = false
  }
}

async function onSubmit() {
  if (!form.value.name_th.trim() || !form.value.email.trim()) {
    errorMsg.value = 'กรุณากรอกชื่อและอีเมล'
    return
  }

  loading.value = true
  errorMsg.value = ''
  try {
    await $api.put(`/api/users/${userId}`, {
      name_th: form.value.name_th.trim(),
      email: form.value.email.trim(),
      role: form.value.role
    })
    router.push('/users')
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'อัปเดตข้อมูลไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

onMounted(loadUser)
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-2xl">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
          <v-icon icon="mdi-account-edit" size="22" />
        </div>
        <div>
          <h1 class="text-xl font-bold text-gray-900 leading-tight">แก้ไขข้อมูลผู้ใช้งาน</h1>
          <p class="text-xs text-gray-500 mt-0.5">รหัสผู้ใช้งาน #{{ userId }}</p>
        </div>
      </div>
      <NuxtLink to="/users">
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

    <!-- Loading State -->
    <div v-if="fetching" class="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-xs">
      <v-progress-circular indeterminate color="primary" size="32" />
      <p class="text-xs text-gray-400 mt-3 font-medium">กำลังโหลดข้อมูลผู้ใช้...</p>
    </div>

    <!-- Main Card -->
    <v-card v-else elevation="1" class="rounded-2xl border border-gray-100 pa-6 pa-md-8 bg-white shadow-xs">
      <form class="d-flex flex-column ga-6" @submit.prevent="onSubmit">
        <!-- Field 1: Name -->
        <div>
          <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
            ชื่อ - นามสกุล <span class="text-red-500">*</span>
          </label>
          <v-text-field
            v-model="form.name_th"
            placeholder="เช่น สมชาย ใจดี"
            density="comfortable"
            variant="outlined"
            prepend-inner-icon="mdi-account-outline"
            hide-details
            required
            class="bg-gray-50/50 rounded-lg"
          />
        </div>

        <!-- Field 2: Email -->
        <div>
          <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
            อีเมล (Email) <span class="text-red-500">*</span>
          </label>
          <v-text-field
            v-model="form.email"
            type="email"
            placeholder="user@bncc.ac.th"
            density="comfortable"
            variant="outlined"
            prepend-inner-icon="mdi-email-outline"
            hide-details
            required
            class="bg-gray-50/50 rounded-lg"
          />
        </div>

        <!-- Field 3: Role -->
        <div>
          <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
            ระดับสิทธิ์ (Role) <span class="text-red-500">*</span>
          </label>
          <v-select
            v-model="form.role"
            :items="roles"
            item-title="title"
            item-value="value"
            density="comfortable"
            variant="outlined"
            prepend-inner-icon="mdi-shield-account-outline"
            hide-details
            class="bg-gray-50/50 rounded-lg"
          />
        </div>

        <!-- Form Actions -->
        <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <NuxtLink to="/users">
            <v-btn variant="text" :disabled="loading" class="rounded-lg text-none text-gray-600">
              ยกเลิก
            </v-btn>
          </NuxtLink>
          <v-btn
            type="submit"
            color="primary"
            variant="flat"
            prepend-icon="mdi-content-save-edit"
            height="44"
            class="px-6 rounded-xl font-medium shadow-sm text-none"
            :loading="loading"
          >
            บันทึกการแก้ไข
          </v-btn>
        </div>
      </form>
    </v-card>
  </div>
</template>
