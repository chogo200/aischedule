<script setup>
definePageMeta({ layout: 'default' })
import { ref, onMounted } from 'vue'

const route = useRoute()
const router = useRouter()
const { $api } = useNuxtApp()

const roomId = route.params.id
const name = ref('')
const feature = ref('')
const loading = ref(false)
const fetching = ref(true)
const errorMsg = ref('')

async function loadDetail() {
  fetching.value = true
  errorMsg.value = ''
  try {
    const { data } = await $api.get(`/api/rooms/${roomId}`)
    const row = data.data || data
    name.value = row.name || ''
    feature.value = row.feature || ''
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'ไม่พบข้อมูลห้องเรียนนี้'
  } finally {
    fetching.value = false
  }
}

async function onSubmit() {
  if (!name.value.trim()) {
    errorMsg.value = 'กรุณากรอกชื่อห้องเรียน'
    return
  }

  loading.value = true
  errorMsg.value = ''
  try {
    await $api.put(`/api/rooms/${roomId}`, {
      name: name.value.trim(),
      feature: feature.value.trim() || null
    })
    router.push('/room')
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'อัปเดตข้อมูลไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

onMounted(loadDetail)
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-2xl">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
          <v-icon icon="mdi-door-sliding" size="22" />
        </div>
        <div>
          <h1 class="text-xl font-bold text-gray-900 leading-tight">แก้ไขข้อมูลห้องเรียน</h1>
          <p class="text-xs text-gray-500 mt-0.5">รหัสห้องเรียน #{{ roomId }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <NuxtLink :to="`/room/expert?id=${roomId}`">
          <v-btn variant="tonal" color="primary" size="small" prepend-icon="mdi-school-outline" class="rounded-lg text-none">
            จัดการวิชาที่รองรับ (Expert)
          </v-btn>
        </NuxtLink>
        <NuxtLink to="/room">
          <v-btn variant="outlined" size="small" prepend-icon="mdi-arrow-left" class="rounded-lg text-none">
            ย้อนกลับ
          </v-btn>
        </NuxtLink>
      </div>
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

    <div v-if="fetching" class="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-xs">
      <v-progress-circular indeterminate color="primary" size="32" />
      <p class="text-xs text-gray-400 mt-3 font-medium">กำลังโหลดข้อมูลห้องเรียน...</p>
    </div>

    <v-card v-else elevation="1" class="rounded-2xl border border-gray-100 pa-6 pa-md-8 bg-white shadow-xs">
      <form class="d-flex flex-column ga-6" @submit.prevent="onSubmit">
        <div>
          <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
            ชื่อห้องเรียน / สถานที่ <span class="text-red-500">*</span>
          </label>
          <v-text-field
            v-model="name"
            placeholder="เช่น ห้องปฏิบัติการคอมพิวเตอร์ 1, ห้อง 421"
            density="comfortable"
            variant="outlined"
            prepend-inner-icon="mdi-door-closed"
            hide-details
            required
            class="bg-gray-50/50 rounded-lg"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
            คุณสมบัติ / อุปกรณ์ / Feature
          </label>
          <v-textarea
            v-model="feature"
            placeholder="เช่น มีคอมพิวเตอร์ 40 เครื่อง, จอโปรเจกเตอร์, เครื่องปรับอากาศ"
            density="comfortable"
            variant="outlined"
            rows="4"
            hide-details
            class="bg-gray-50/50 rounded-lg"
          />
        </div>

        <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <NuxtLink to="/room">
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
