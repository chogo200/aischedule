<script setup>
definePageMeta({ layout: 'default' })
import { ref, onMounted } from 'vue'

const route = useRoute()
const router = useRouter()
const { $api } = useNuxtApp()

const classId = route.params.id
const name = ref('')
const loading = ref(false)
const fetching = ref(true)
const errorMsg = ref('')

async function loadDetail() {
  fetching.value = true
  errorMsg.value = ''
  try {
    const { data } = await $api.get(`/api/classes/${classId}`)
    const row = data.data || data
    name.value = row.name || ''
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'ไม่พบข้อมูลชั้นเรียนนี้'
  } finally {
    fetching.value = false
  }
}

async function onSubmit() {
  if (!name.value.trim()) {
    errorMsg.value = 'กรุณากรอกชื่อชั้นเรียน'
    return
  }

  loading.value = true
  errorMsg.value = ''
  try {
    await $api.put(`/api/classes/${classId}`, { name: name.value.trim() })
    router.push('/class')
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
        <h1 class="text-xl font-bold text-gray-800">แก้ไขชั้นเรียน</h1>
        <p class="text-xs text-gray-500 mt-0.5">รหัสชั้นเรียน #{{ classId }}</p>
      </div>
      <NuxtLink to="/class">
        <v-btn variant="outlined" size="small" prepend-icon="mdi-arrow-left">
          ย้อนกลับ
        </v-btn>
      </NuxtLink>
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
            ชื่อชั้นเรียน / รหัสกลุ่ม <span class="text-red-500">*</span>
          </label>
          <v-text-field
            v-model="name"
            placeholder="เช่น ปวช.1/1 ช่างไฟฟ้า, สทส.67-1"
            density="comfortable"
            variant="outlined"
            prepend-inner-icon="mdi-google-classroom"
            hide-details
            required
          />
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
          <NuxtLink to="/class">
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

