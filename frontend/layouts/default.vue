<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMenu } from '~/composables/useMenu'
import AppChatDrawer from '~/components/AppChatDrawer.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const role = ref(auth.user?.role || 'permis1')
const { menu } = useMenu(role)

const drawer = ref(true)      // เปิด/ปิด sidebar
const rail = ref(false)       // โหมดพับ sidebar แบบไอคอนย่อ (rail mode)
const logoHovered = ref(false) // สถานะ hover ที่ logo เมื่ออยู่ในโหมดพับ
const chatDrawer = ref(true)  // เปิด/ปิด AI chat ด้านขวา

function logout() {
  auth.logout()
  router.push('/login')
}

// แผนที่แปลง Path เป็นชื่อโฟลเดอร์ภาษาไทย/อังกฤษที่เข้าใจง่าย
const pathNameMap = {
  users: 'ผู้ใช้งาน (Users)',
  subject: 'รายวิชา (Subjects)',
  room: 'ห้องเรียน (Rooms)',
  class: 'ชั้นเรียน (Classes)',
  teacher: 'อาจารย์ (Teachers)',
  project: 'โครงการ (Projects)',
  schedule: 'ตารางสอน (Schedule)',
  new: 'สร้างใหม่ (Create)',
  me: 'ข้อมูลส่วนตัว (Profile)',
  upload: 'อัปโหลดไฟล์ (Upload)',
  // หมวดหมู่ย่อย
  schedules: 'ตาราง',
  plans: 'แผนการสอน',
  classes: 'ชั้นเรียน',
  teachers: 'ครู',
  rooms: 'ห้องเรียน'
}

// คำนวณ Breadcrumbs แบบ Path โฟลเดอร์ (เช่น root / โครงการ / [ชื่อโปรเจกต์] / [หมวดย่อย])
const breadcrumbs = computed(() => {
  const fullPath = route.path
  if (!fullPath || fullPath === '/') {
    return [{ label: 'แดชบอร์ด', to: '/', isLast: true, isRoot: true }]
  }

  // คำนวณ Breadcrumbs แบบ Path โฟลเดอร์
  const segments = fullPath.split('/').filter(Boolean)
  const crumbs = [{ label: 'หน้าแรก', to: '/', isLast: false, isRoot: true }]

  // กรณีพิเศษสำหรับหน้ารายละเอียดโปรเจกต์ที่เป็น Query: /project/detail?name=xxx&tab=classes
  if (segments[0] === 'project' && segments[1] === 'detail') {
    crumbs.push({
      label: pathNameMap['project'],
      to: '/project',
      isLast: false
    })

    const projName = route.query?.name
    const subTab = route.query?.tab
    if (projName) {
      crumbs.push({
        label: projName,
        to: `/project/detail?name=${encodeURIComponent(projName)}`,
        isLast: !subTab
      })
    }

    if (subTab && pathNameMap[subTab]) {
      crumbs.push({
        label: pathNameMap[subTab],
        to: `/project/detail?name=${encodeURIComponent(projName || '')}&tab=${subTab}`,
        isLast: true
      })
    } else if (crumbs.length > 0) {
      crumbs[crumbs.length - 1].isLast = true
    }

    return crumbs
  }

  // กรณีพิเศษสำหรับหน้าจัดการวิชาในแผนการสอน: /project/plan?name=xxx&plan_id=yyy
  if (segments[0] === 'project' && segments[1] === 'plan') {
    crumbs.push({
      label: pathNameMap['project'],
      to: '/project',
      isLast: false
    })

    const projName = route.query?.name
    if (projName) {
      crumbs.push({
        label: projName,
        to: `/project/detail?name=${encodeURIComponent(projName)}&tab=plans`,
        isLast: false
      })
    }

    crumbs.push({
      label: 'แผนการสอน',
      to: `/project/detail?name=${encodeURIComponent(projName || '')}&tab=plans`,
      isLast: false
    })

    crumbs.push({
      label: 'จัดการรายวิชา',
      to: route.fullPath,
      isLast: true
    })

    return crumbs
  }

  let accumulated = ''
  segments.forEach((seg, idx) => {
    accumulated += `/${seg}`

    let label = pathNameMap[seg]
    if (!label) {
      label = isNaN(seg) ? decodeURIComponent(seg) : `#${seg}`
    }

    crumbs.push({
      label,
      to: accumulated,
      isLast: false
    })
  })

  // ถ้าอยู่ใน /project และมี query (เช่น /project?name=xxx หรือ /project?name=xxx&tab=classes)
  const projName = route.query?.name
  const subTab = route.query?.tab
  if (segments[0] === 'project' && segments.length === 1 && projName) {
    // เพิ่มชื่อโปรเจกต์ลงใน breadcrumb
    crumbs.push({
      label: projName,
      to: `/project?name=${encodeURIComponent(projName)}`,
      isLast: !subTab
    })

    if (subTab && pathNameMap[subTab]) {
      crumbs.push({
        label: pathNameMap[subTab],
        to: `/project?name=${encodeURIComponent(projName)}&tab=${subTab}`,
        isLast: true
      })
    }
  } else if (subTab && pathNameMap[subTab]) {
    crumbs.push({
      label: pathNameMap[subTab],
      to: `${accumulated}?tab=${subTab}`,
      isLast: true
    })
  } else if (crumbs.length > 0) {
    crumbs[crumbs.length - 1].isLast = true
  }

  return crumbs
})
</script>

<template>
  <v-app class="app-root">
    <!-- 1. Full-Height Left Sidebar (สูงเต็มตั้งแต่บนสุดถึงล่างสุด) -->
    <v-navigation-drawer
      v-model="drawer"
      :rail="rail"
      permanent
      width="250"
      class="border-e border-gray-200 full-sidebar"
    >
      <!-- Header:
           - ตอนเปิด: [ Logo + ชื่อ ] --------- [ ปุ่ม < ]
           - ตอนปิด: แสดง Logo วงกลมตรงกลาง และเมื่อ hover Logo จะกลายเป็นปุ่ม >
      -->
      <div
        class="h-14 px-3 flex items-center transition-all"
        :class="rail ? 'justify-center' : 'justify-between'"
      >
        <!-- 1. กรณีเปิด (กางเต็ม): แสดง Logo + ชื่อทางซ้าย -->
        <template v-if="!rail">
          <div class="flex items-center gap-2.5 overflow-hidden">
            <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <v-icon icon="mdi-school" size="18" />
            </div>
            <div class="flex flex-col leading-tight select-none truncate">
              <span class="font-bold text-sm tracking-tight text-gray-800">
                BNCC-Ai
              </span>
              <span class="text-[10px] text-gray-400">
                Schedule System
              </span>
            </div>
          </div>

          <!-- ปุ่มพับ < อยู่ขวาสุดของ Header -->
          <v-btn
            icon="mdi-chevron-left"
            variant="text"
            size="small"
            density="comfortable"
            title="พับแถบเมนู"
            class="text-gray-500 hover:text-gray-800"
            @click="rail = true"
          />
        </template>

        <!-- 2. กรณีปิด (พับอยู่): แสดง Logo ตรงกลาง แต่พอ hover จะกลายเป็นปุ่ม > ชัดเจน 100% -->
        <template v-else>
          <div
            class="relative w-9 h-9 rounded-full cursor-pointer flex items-center justify-center shrink-0 transition-transform active:scale-95"
            :title="logoHovered ? 'ขยายแถบเมนู' : ''"
            @mouseenter="logoHovered = true"
            @mouseleave="logoHovered = false"
            @click="rail = false; logoHovered = false"
          >
            <!-- ตอนปกติ: แสดง Logo สีน้ำเงิน -->
            <div
              v-if="!logoHovered"
              class="w-full h-full rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm"
            >
              <v-icon icon="mdi-school" size="18" />
            </div>

            <!-- ตอน Hover: เปลี่ยนเป็นปุ่ม > สีฟ้าอ่อนเด่นชัด -->
            <div
              v-else
              class="w-full h-full rounded-full bg-blue-100 text-blue-700 border-2 border-blue-500 flex items-center justify-center shadow-md animate-pulse"
            >
              <v-icon icon="mdi-chevron-right" size="22" />
            </div>
          </div>
        </template>
      </div>


      <!-- Menu Navigation Items -->
      <v-list density="compact" nav class="px-2 py-2">
        <template v-for="(section, i) in menu" :key="i">
          <v-list-subheader v-if="!rail" class="text-[10px] font-bold tracking-wider text-gray-400 uppercase mt-2">
            {{ section.label }}
          </v-list-subheader>
          <v-list-item
            v-for="(it, j) in section.items"
            :key="j"
            :to="it.to"
            :href="it.href"
            :target="it.target"
            :prepend-icon="it.icon"
            :title="it.label"
            :value="it.to || it.href"
            rounded="lg"
            class="mb-1"
          />
          <v-divider v-if="!rail" class="my-1.5" />
        </template>
      </v-list>
    </v-navigation-drawer>

    <!-- 2. Topbar: แสดง Path โฟลเดอร์ (Breadcrumb File Explorer style) -->
    <v-app-bar color="surface" flat density="comfortable" class="border-b border-gray-200">
      <div class="px-3 flex items-center gap-1.5 overflow-x-auto text-xs font-medium">
        <template v-for="(crumb, i) in breadcrumbs" :key="crumb.to">
          <!-- Separator slash icon -->
          <span v-if="i > 0" class="text-gray-300 font-normal">/</span>

          <!-- Folder / Page pill -->
          <NuxtLink
            v-if="!crumb.isLast"
            :to="crumb.to"
            class="flex items-center gap-1 px-2 py-1 rounded-md text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition-colors"
          >
            <v-icon
              :icon="crumb.isRoot ? 'mdi-home-outline' : 'mdi-folder-outline'"
              size="15"
              class="text-gray-400"
            />
            <span>{{ crumb.label }}</span>
          </NuxtLink>

          <!-- Active current folder/path -->
          <div
            v-else
            class="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50/70 text-blue-700 font-semibold"
          >
            <v-icon
              :icon="crumb.isRoot ? 'mdi-home' : 'mdi-folder-open-outline'"
              size="15"
              class="text-blue-600"
            />
            <span>{{ crumb.label }}</span>
          </div>
        </template>
      </div>

      <v-spacer />

      <div class="flex items-center gap-2 pr-4">
        <!-- ปุ่มเปิด/ปิด AI Chat ด้านขวา -->
        <v-btn
          :variant="chatDrawer ? 'tonal' : 'text'"
          :color="chatDrawer ? 'primary' : undefined"
          size="small"
          prepend-icon="mdi-robot"
          class="text-none font-medium"
          @click="chatDrawer = !chatDrawer"
        >
          AI Agent
        </v-btn>

        <!-- โปรไฟล์ -->
        <v-btn icon="mdi-account-circle" variant="text" size="small" />

        <!-- ปุ่ม Logout (ขวาสุดตามรูป Wireframe) -->
        <v-btn
          color="error"
          variant="outlined"
          size="small"
          prepend-icon="mdi-logout"
          class="text-none ml-1"
          @click="logout"
        >
          Logout
        </v-btn>
      </div>
    </v-app-bar>

    <!-- 3. Main Area: Feature page (ตรงกลาง) + AI Chat (ด้านขวา) -->
    <v-main class="bg-gray-50">
      <div class="flex h-[calc(100vh-48px)] overflow-hidden">
        <!-- Feature Page Content -->
        <div class="flex-1 overflow-y-auto flex flex-col justify-between">
          <div class="p-6">
            <slot />
          </div>
        </div>

        <!-- AI Chat Drawer (ขวาสุด) -->
        <AppChatDrawer v-if="chatDrawer" v-model="chatDrawer" />
      </div>
    </v-main>
  </v-app>
</template>

<style scoped>
.app-root {
  min-height: 100vh;
}
.full-sidebar {
  height: 100vh !important;
  z-index: 1005 !important;
}
</style>
