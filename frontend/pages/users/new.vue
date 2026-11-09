<script setup>
definePageMeta({ layout: 'default' })
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const { $api } = useNuxtApp()

const errorMsg = ref('')
const loading = ref(false)
const showPassword = ref(false)

const form = ref({
  name_th: '',
  email: '',
  password: '',
  role: 'admin'
})

const roles = [
  { title: 'Admin (ผู้ดูแลระบบ)', value: 'admin', desc: 'จัดการระบบได้ทุกส่วน' },
  { title: 'Permis 1 (สิทธิ์ระดับ 1)', value: 'permis1', desc: 'เข้าถึงเมนูทั่วไป' },
  { title: 'Permis 2 (สิทธิ์ระดับ 2)', value: 'permis2', desc: 'จำกัดการเข้าถึงเฉพาะส่วน' }
]

const handleSubmit = async () => {
  if (!form.value.name_th.trim() || !form.value.email.trim() || !form.value.password) {
    errorMsg.value = 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน'
    return
  }

  loading.value = true
  errorMsg.value = ''

  try {
    await $api.post('/api/users', {
      name_th: form.value.name_th.trim(),
      email: form.value.email.trim(),
      password: form.value.password,
      role: form.value.role
    })
    router.push('/users')
  } catch (e) {
    errorMsg.value = e?.response?.data?.message || e.message || 'บันทึกข้อมูลไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-2xl">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
          <v-icon icon="mdi-account-plus" size="22" />
        </div>
        <div>
          <h1 class="text-xl font-bold text-gray-900 leading-tight">เพิ่มผู้ใช้งานใหม่</h1>
          <p class="text-xs text-gray-500 mt-0.5">สร้างบัญชีผู้ใช้งานและกำหนดสิทธิ์เข้าใช้งานระบบ</p>
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

    <!-- Main Card -->
    <v-card elevation="1" class="rounded-2xl border border-gray-100 pa-6 pa-md-8 bg-white shadow-xs">
      <form class="d-flex flex-column ga-6" @submit.prevent="handleSubmit">
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

        <!-- Field 3: Password -->
        <div>
          <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
            รหัสผ่าน (Password) <span class="text-red-500">*</span>
          </label>
          <v-text-field
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="กำหนดรหัสผ่านอย่างน้อย 6 ตัวอักษร"
            density="comfortable"
            variant="outlined"
            prepend-inner-icon="mdi-lock-outline"
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            hide-details
            required
            class="bg-gray-50/50 rounded-lg"
            @click:append-inner="showPassword = !showPassword"
          />
        </div>

        <!-- Field 4: Role -->
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
