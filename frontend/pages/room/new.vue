<script setup>
definePageMeta({ layout: 'default' })
import { ref } from 'vue'

const router = useRouter()
const { $api } = useNuxtApp()

const name = ref('')
const feature = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function onSubmit() {
  if (!name.value.trim()) {
    errorMsg.value = 'กรุณากรอกชื่อห้องเรียน'
    return
  }

  loading.value = true
  errorMsg.value = ''
  try {
    await $api.post('/api/rooms', {
      name: name.value.trim(),
      feature: feature.value.trim() || null
    })
    router.push('/room')
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'บันทึกข้อมูลไม่สำเร็จ'
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
          <v-icon icon="mdi-door-sliding" size="22" />
        </div>
        <div>
          <h1 class="text-xl font-bold text-gray-900 leading-tight">เพิ่มห้องเรียนใหม่</h1>
          <p class="text-xs text-gray-500 mt-0.5">ระบุชื่อห้องเรียน สถานที่ และสิ่งอำนวยความสะดวก</p>
        </div>
      </div>
      <NuxtLink to="/room">
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
