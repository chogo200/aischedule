// ~/composables/useMenu.js
import { ref, isRef, computed } from 'vue'

// ถ้า backend ส่ง 'evaluatee' ให้ map มาเป็น 'user'
function normalizeRole(r) {
  const x = (r || '').toString().toLowerCase()
  if (x === 'evaluatee') return 'user'
  return ['admin', 'evaluator', 'user'].includes(x) ? x : 'user'
}

const MAP = {
  admin: [
    {
      items: [
        { label: 'ตารางเรียน (Schedule)', to: '/', icon: 'mdi-calendar-clock-outline' },
        { label: 'Project', to: '/project', icon: 'mdi-folder-table-outline' },
        { label: 'User', to: '/users', icon: 'mdi-account-group-outline' },
        { label: 'Teacher', to: '/teacher', icon: 'mdi-account-tie-outline' },
        { label: 'Room', to: '/room', icon: 'mdi-door-sliding' },
        { label: 'Class', to: '/class', icon: 'mdi-google-classroom' },
        { label: 'Subject', to: '/subject', icon: 'mdi-book-education-outline' },
        { label: 'AI Agent Assistant', to: '/agent', icon: 'mdi-robot-excited-outline' },
      ]
    }
  ]
}

export function useMenu(roleInput = 'admin') {
  const r = isRef(roleInput) ? roleInput : ref(roleInput)

  const menu = computed(() => {
    // เน้นทำเฉพาะ Role Admin ก่อนตามความต้องการ
    return MAP.admin
  })

  return { menu }
}
