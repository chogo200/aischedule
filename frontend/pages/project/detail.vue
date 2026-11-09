<script setup>
definePageMeta({ layout: 'default' })
import { ref, onMounted, computed, watch } from 'vue'

const route = useRoute()
const router = useRouter()
const { $api } = useNuxtApp()

const project = ref(null)
const projectId = ref(null)
const loading = ref(true)
const activeTab = ref(route.query?.tab || 'schedules')
const errorMsg = ref('')

// Query name หรือ query id
const queryName = computed(() => route.query?.name)
const queryId = computed(() => route.query?.id)

// Inline Rename
const isRenaming = ref(false)
const renameInput = ref('')
const renameLoading = ref(false)

function startRename() {
  if (!project.value) return
  renameInput.value = project.value.name
  isRenaming.value = true
}

function cancelRename() {
  isRenaming.value = false
  renameInput.value = ''
}

async function submitRename() {
  if (!isRenaming.value || !project.value) return
  const trimmed = renameInput.value.trim()

  if (!trimmed || trimmed === project.value.name) {
    cancelRename()
    return
  }

  renameLoading.value = true
  try {
    await $api.put(`/api/projects/${projectId.value}`, { name: trimmed })
    project.value.name = trimmed
    route.meta.projectName = trimmed
    cancelRename()
    // อัปเดต query name ใน URL
    router.replace({
      path: '/project/detail',
      query: { ...route.query, name: trimmed }
    })
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'เปลี่ยนชื่อโครงการไม่สำเร็จ'
  } finally {
    renameLoading.value = false
  }
}

async function loadProject() {
  loading.value = true
  try {
    let resData
    if (queryName.value) {
      const { data } = await $api.get(`/api/projects/by-name/${encodeURIComponent(queryName.value)}`)
      resData = data.data || data
    } else if (queryId.value) {
      const { data } = await $api.get(`/api/projects/${queryId.value}`)
      resData = data.data || data
    } else {
      router.push('/project')
      return
    }

    project.value = resData
    if (project.value?.id) {
      projectId.value = project.value.id
    }
    if (project.value?.name) {
      route.meta.projectName = project.value.name
    }
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'ไม่พบข้อมูลโครงการนี้'
  } finally {
    loading.value = false
  }
}

/* -------------------------------------------------------------
   1. จัดการชั้นเรียน (Classes in Project)
---------------------------------------------------------------- */
const projectClasses = ref([])
const loadingClasses = ref(false)
const addingClassRow = ref(false)

// Input form fields สำหรับแถวบน (ตามรูป Wireframe)
const inputClassName = ref('')
const inputNameInProject = ref('')
const inputPlanId = ref(null)

// Autocomplete dropdown สำหรับค้นหาชั้นเรียน (เหมือน subject)
const isClassDropdownOpen = ref(false)
const filteredClassSuggestions = ref([])
const selectedClassFromDropdown = ref(null)
let classNameSearchTimeout = null

// Filter state สำหรับค้นหาในตาราง
const showClassFilter = ref(false)
const classFilterSearch = ref('')

const displayedProjectClasses = computed(() => {
  const q = (classFilterSearch.value || '').trim().toLowerCase()
  if (!q) return projectClasses.value
  return projectClasses.value.filter(c =>
    (c.class_name || '').toLowerCase().includes(q) ||
    (c.name_in_project || '').toLowerCase().includes(q) ||
    (c.plan_name || '').toLowerCase().includes(q)
  )
})

function onClassNameInput() {
  selectedClassFromDropdown.value = null
  isClassDropdownOpen.value = true
  clearTimeout(classNameSearchTimeout)

  classNameSearchTimeout = setTimeout(async () => {
    const q = inputClassName.value.trim()
    try {
      const { data } = await $api.get('/api/classes', {
        params: { search: q, limit: 5 }
      })
      filteredClassSuggestions.value = data.data || data.items || []
    } catch (e) {
      console.error(e)
    }
  }, 250)
}

function selectClassSuggestion(item) {
  inputClassName.value = item.name
  selectedClassFromDropdown.value = item
  isClassDropdownOpen.value = false
}

function onClassNameBlur() {
  setTimeout(() => {
    isClassDropdownOpen.value = false
  }, 200)
}

// Inline Rename ชื่อในโครงการ (name in project)
const renamingClassRelId = ref(null)
const renameClassInput = ref('')

// Inline Edit แผนการสอน (plan_id)
const editingClassPlanRelId = ref(null)

async function loadProjectClasses() {
  loadingClasses.value = true
  try {
    const [cRes, pRes] = await Promise.all([
      $api.get(`/api/projects/${projectId.value}/classes`),
      $api.get(`/api/projects/${projectId.value}/lesson-plans`)
    ])
    projectClasses.value = cRes.data.data || []
    lessonPlans.value = pRes.data.data || []
  } catch (e) {
    console.error(e)
  } finally {
    loadingClasses.value = false
  }
}

async function onAddClassSubmit() {
  const nameVal = inputClassName.value.trim()
  if (!nameVal) {
    errorMsg.value = 'กรุณาระบุชื่อชั้นเรียน'
    return
  }

  if (!inputPlanId.value) {
    errorMsg.value = 'กรุณาเลือกแผนการสอนก่อนเพิ่มชั้นเรียน'
    return
  }

  addingClassRow.value = true
  errorMsg.value = ''

  try {
    let targetClass = selectedClassFromDropdown.value

    // ถ้าไม่ได้เลือกจาก dropdown ให้หาในระบบก่อน
    if (!targetClass) {
      const { data } = await $api.get('/api/classes', {
        params: { search: nameVal, limit: 5 }
      })
      const list = data.data || data.items || []
      targetClass = list.find(c => c.name.trim().toLowerCase() === nameVal.toLowerCase())
    }

    // ถ้าไม่ตรงสักอันเลย ให้ create class ใหม่ทันที (เหมือน subject)
    if (!targetClass) {
      const createRes = await $api.post('/api/classes', {
        name: nameVal
      })
      targetClass = createRes.data.data || createRes.data
    }

    // เพิ่มเข้า class_in_project
    await $api.post(`/api/projects/${projectId.value}/classes`, {
      class_id: targetClass.id,
      name: inputNameInProject.value.trim() || null,
      plan_id: inputPlanId.value || null
    })

    // ล้างฟอร์ม
    inputClassName.value = ''
    inputNameInProject.value = ''
    inputPlanId.value = null
    selectedClassFromDropdown.value = null
    isClassDropdownOpen.value = false

    await loadProjectClasses()
    loadProject()
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'เพิ่มชั้นเรียนไม่สำเร็จ'
  } finally {
    addingClassRow.value = false
  }
}

function startRenameClass(item) {
  renamingClassRelId.value = item.rel_id
  renameClassInput.value = item.name_in_project || item.class_name
}

async function submitRenameClass(item) {
  if (!renamingClassRelId.value) return
  const trimmed = renameClassInput.value.trim()
  try {
    await $api.put(`/api/projects/${projectId.value}/classes/${item.rel_id}`, {
      name: trimmed || null
    })
    item.name_in_project = trimmed || null
    renamingClassRelId.value = null
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'บันทึกชื่อชั้นเรียนในโครงการไม่สำเร็จ'
  }
}

async function updateClassPlan(item, newPlanId) {
  try {
    await $api.put(`/api/projects/${projectId.value}/classes/${item.rel_id}`, {
      plan_id: newPlanId || null
    })
    item.plan_id = newPlanId || null
    const foundPlan = lessonPlans.value.find(p => p.id === newPlanId)
    item.plan_name = foundPlan ? foundPlan.name : null
    editingClassPlanRelId.value = null
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'เปลี่ยนแผนการสอนไม่สำเร็จ'
  }
}

async function removeClass(relId) {
  if (!confirm('ต้องการนำชั้นเรียนนี้ออกจากโครงการใช่หรือไม่?')) return
  try {
    await $api.delete(`/api/projects/${projectId.value}/classes/${relId}`)
    await loadProjectClasses()
    loadProject()
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'นำชั้นเรียนออกไม่สำเร็จ'
  }
}

/* -------------------------------------------------------------
   2. จัดการห้องเรียน (Rooms in Project)
---------------------------------------------------------------- */
const projectRooms = ref([])
const loadingRooms = ref(false)
const addingRoomRow = ref(false)

// Input form field สำหรับแถวบน (ตามรูป Wireframe)
const inputRoomName = ref('')
const inputRoomFeature = ref('')

// Autocomplete dropdown สำหรับค้นหาห้องเรียน (เหมือน subject/teacher)
const isRoomDropdownOpen = ref(false)
const filteredRoomSuggestions = ref([])
const selectedRoomFromDropdown = ref(null)
let roomNameSearchTimeout = null

// Filter state สำหรับค้นหาในตาราง
const showRoomFilter = ref(false)
const roomFilterSearch = ref('')

const displayedProjectRooms = computed(() => {
  const q = (roomFilterSearch.value || '').trim().toLowerCase()
  if (!q) return projectRooms.value
  return projectRooms.value.filter(r =>
    (r.room_name || '').toLowerCase().includes(q) ||
    (r.feature || '').toLowerCase().includes(q)
  )
})

function onRoomNameInput() {
  selectedRoomFromDropdown.value = null
  isRoomDropdownOpen.value = true
  clearTimeout(roomNameSearchTimeout)

  roomNameSearchTimeout = setTimeout(async () => {
    const q = inputRoomName.value.trim()
    try {
      const { data } = await $api.get('/api/rooms', {
        params: { search: q, limit: 5 }
      })
      filteredRoomSuggestions.value = data.data || []
    } catch (e) {
      console.error(e)
    }
  }, 250)
}

function selectRoomSuggestion(item) {
  inputRoomName.value = item.name
  inputRoomFeature.value = item.feature || ''
  selectedRoomFromDropdown.value = item
  isRoomDropdownOpen.value = false
}

function onRoomNameBlur() {
  setTimeout(() => {
    isRoomDropdownOpen.value = false
  }, 200)
}

async function loadProjectRooms() {
  loadingRooms.value = true
  try {
    const { data } = await $api.get(`/api/projects/${projectId.value}/rooms`)
    projectRooms.value = data.data || []
  } catch (e) {
    console.error(e)
  } finally {
    loadingRooms.value = false
  }
}

async function onAddRoomSubmit() {
  const nameVal = inputRoomName.value.trim()
  if (!nameVal) {
    errorMsg.value = 'กรุณาระบุชื่อห้องเรียน'
    return
  }

  addingRoomRow.value = true
  errorMsg.value = ''

  try {
    let targetRoom = selectedRoomFromDropdown.value

    // ถ้าไม่ได้เลือกจาก dropdown ให้หาในระบบก่อน
    if (!targetRoom) {
      const { data } = await $api.get('/api/rooms', {
        params: { search: nameVal, limit: 5 }
      })
      const list = data.data || []
      targetRoom = list.find(r => (r.name || '').trim().toLowerCase() === nameVal.toLowerCase())
    }

    // ถ้าไม่ตรงสักห้อง ให้สร้างห้องเรียนใหม่ในระบบทันที (เหมือน subject/teacher)
    if (!targetRoom) {
      const createRes = await $api.post('/api/rooms', {
        name: nameVal,
        feature: inputRoomFeature.value.trim() || null
      })
      targetRoom = createRes.data.data || createRes.data
    }

    // เพิ่มเข้า room_in_project
    await $api.post(`/api/projects/${projectId.value}/rooms`, {
      room_id: targetRoom.id
    })

    // ล้างฟอร์ม
    inputRoomName.value = ''
    inputRoomFeature.value = ''
    selectedRoomFromDropdown.value = null
    isRoomDropdownOpen.value = false

    await loadProjectRooms()
    loadProject()
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'เพิ่มห้องเรียนเข้าโครงการไม่สำเร็จ'
  } finally {
    addingRoomRow.value = false
  }
}

async function removeRoom(relId) {
  if (!confirm('ต้องการนำห้องเรียนนี้ออกจากโครงการใช่หรือไม่?')) return
  try {
    await $api.delete(`/api/projects/${projectId.value}/rooms/${relId}`)
    await loadProjectRooms()
    loadProject()
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'นำห้องเรียนออกไม่สำเร็จ'
  }
}

/* -------------------------------------------------------------
   3. จัดการอาจารย์ (Teachers in Project)
---------------------------------------------------------------- */
const projectTeachers = ref([])
const loadingTeachers = ref(false)
const addingTeacherRow = ref(false)

// Input form field สำหรับแถวบน (ตามรูป Wireframe)
const inputTeacherName = ref('')

// Autocomplete dropdown สำหรับค้นหาอาจารย์ (เหมือน subject)
const isTeacherDropdownOpen = ref(false)
const filteredTeacherSuggestions = ref([])
const selectedTeacherFromDropdown = ref(null)
let teacherNameSearchTimeout = null

// Filter state สำหรับค้นหาในตาราง
const showTeacherFilter = ref(false)
const teacherFilterSearch = ref('')

const displayedProjectTeachers = computed(() => {
  const q = (teacherFilterSearch.value || '').trim().toLowerCase()
  if (!q) return projectTeachers.value
  return projectTeachers.value.filter(t =>
    (t.name || t.teacher_name || t.user_name || '').toLowerCase().includes(q) ||
    (t.email || '').toLowerCase().includes(q) ||
    (t.portfolio || '').toLowerCase().includes(q)
  )
})

function onTeacherNameInput() {
  selectedTeacherFromDropdown.value = null
  isTeacherDropdownOpen.value = true
  clearTimeout(teacherNameSearchTimeout)

  teacherNameSearchTimeout = setTimeout(async () => {
    const q = inputTeacherName.value.trim()
    try {
      const { data } = await $api.get('/api/teachers', {
        params: { search: q, limit: 5 }
      })
      filteredTeacherSuggestions.value = data.data || []
    } catch (e) {
      console.error(e)
    }
  }, 250)
}

function selectTeacherSuggestion(item) {
  inputTeacherName.value = item.name || item.user_name || ''
  selectedTeacherFromDropdown.value = item
  isTeacherDropdownOpen.value = false
}

function onTeacherNameBlur() {
  setTimeout(() => {
    isTeacherDropdownOpen.value = false
  }, 200)
}

async function loadProjectTeachers() {
  loadingTeachers.value = true
  try {
    const { data } = await $api.get(`/api/projects/${projectId.value}/teachers`)
    projectTeachers.value = data.data || []
  } catch (e) {
    console.error(e)
  } finally {
    loadingTeachers.value = false
  }
}

async function onAddTeacherSubmit() {
  const nameVal = inputTeacherName.value.trim()
  if (!nameVal) {
    errorMsg.value = 'กรุณาระบุชื่ออาจารย์'
    return
  }

  addingTeacherRow.value = true
  errorMsg.value = ''

  try {
    let targetTeacher = selectedTeacherFromDropdown.value

    // ถ้าไม่ได้เลือกจาก dropdown ให้หาในระบบก่อน
    if (!targetTeacher) {
      const { data } = await $api.get('/api/teachers', {
        params: { search: nameVal, limit: 5 }
      })
      const list = data.data || []
      targetTeacher = list.find(t => (t.name || t.user_name || '').trim().toLowerCase() === nameVal.toLowerCase())
    }

    // ถ้าไม่ตรงสักคน ให้สร้างอาจารย์คนใหม่ในระบบทันที (เหมือน subject)
    if (!targetTeacher) {
      const createRes = await $api.post('/api/teachers', {
        name: nameVal,
        user_id: null,
        portfolio: null
      })
      targetTeacher = createRes.data.data || createRes.data
    }

    // เพิ่มเข้า teacher_in_project
    await $api.post(`/api/projects/${projectId.value}/teachers`, {
      teacher_id: targetTeacher.id
    })

    // ล้างฟอร์ม
    inputTeacherName.value = ''
    selectedTeacherFromDropdown.value = null
    isTeacherDropdownOpen.value = false

    await loadProjectTeachers()
    loadProject()
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'เพิ่มอาจารย์เข้าโครงการไม่สำเร็จ'
  } finally {
    addingTeacherRow.value = false
  }
}

async function removeTeacher(relId) {
  if (!confirm('ต้องการนำอาจารย์ท่านนี้ออกจากโครงการใช่หรือไม่?')) return
  try {
    await $api.delete(`/api/projects/${projectId.value}/teachers/${relId}`)
    await loadProjectTeachers()
    loadProject()
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'นำอาจารย์ออกไม่สำเร็จ'
  }
}

/* -------------------------------------------------------------
   4. จัดการแผนการสอน (Lesson Plans: name + subjects[{subject_id, hours}])
---------------------------------------------------------------- */
const lessonPlans = ref([])
const loadingPlans = ref(false)
const addPlanDialog = ref(false)
const planName = ref('')
const planSubjects = ref([]) // [{ subject_id, hours }]
const allSystemSubjects = ref([])
const savingPlan = ref(false)

async function loadLessonPlans() {
  loadingPlans.value = true
  try {
    const { data } = await $api.get(`/api/projects/${projectId.value}/lesson-plans`)
    lessonPlans.value = data.data || []
  } catch (e) {
    console.error(e)
  } finally {
    loadingPlans.value = false
  }
}

// Plan Management: Modal สร้างเฉพาะชื่อ & Modal จัดการวิชาในแผน
const isEditingPlan = ref(false)
const editingPlanId = ref(null)
const manageSubjectsDialog = ref(false)
const selectedPlan = ref(null)

// Inline Rename เฉพาะชื่อแผนการสอน
const renamingPlanId = ref(null)
const renamePlanInput = ref('')

function startRenamePlan(plan, event) {
  if (event) event.stopPropagation()
  renamingPlanId.value = plan.id
  renamePlanInput.value = plan.name
}

function cancelRenamePlan() {
  renamingPlanId.value = null
  renamePlanInput.value = ''
}

async function submitRenamePlan(plan) {
  if (!renamingPlanId.value) return
  const trimmed = renamePlanInput.value.trim()
  if (!trimmed || trimmed === plan.name) {
    cancelRenamePlan()
    return
  }

  try {
    await $api.put(`/api/projects/${projectId.value}/lesson-plans/${plan.id}`, {
      name: trimmed
    })
    plan.name = trimmed
    cancelRenamePlan()
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'เปลี่ยนชื่อแผนการสอนไม่สำเร็จ'
  }
}

// ไปยังหน้าจัดการรายวิชาในแผนการสอน (แยกเป็น Page ต่างหาก)
function goToPlanPage(plan) {
  router.push({
    path: '/project/plan',
    query: {
      name: project.value?.name || route.query?.name,
      plan_id: plan.id
    }
  })
}

// 1. เปิด Modal สร้างแผนการสอน (ใส่แค่ชื่อแผน แล้วกดสร้างได้เลย)
function openAddPlanModal() {
  planName.value = ''
  addPlanDialog.value = true
}

// สร้างแผนการสอนทันทีโดยใส่แค่ชื่อ แล้วนำทางไปยังหน้าจัดการวิชาทันที
async function submitCreatePlan() {
  const trimmed = planName.value.trim()
  if (!trimmed) {
    errorMsg.value = 'กรุณาระบุชื่อแผนการสอน'
    return
  }

  savingPlan.value = true
  try {
    const { data } = await $api.post(`/api/projects/${projectId.value}/lesson-plans`, {
      name: trimmed,
      subjects: []
    })
    addPlanDialog.value = false
    await loadLessonPlans()
    loadProject()

    const created = data.data || data
    if (created && created.id) {
      goToPlanPage(created)
    }
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'บันทึกแผนการสอนไม่สำเร็จ'
  } finally {
    savingPlan.value = false
  }
}

// 2. จัดการรายวิชาและชั่วโมงในแผนการสอน (หรือแก้ไขแผน)
async function openManageSubjectsModal(plan) {
  selectedPlan.value = plan
  editingPlanId.value = plan.id
  planName.value = plan.name
  planSubjects.value = (plan.subjects || []).map(s => ({
    subject_id: s.subject_id,
    hours: s.hours || 1
  }))
  if (planSubjects.value.length === 0) {
    planSubjects.value.push({ subject_id: null, hours: 2 })
  }
  manageSubjectsDialog.value = true
  await fetchAllSubjects()
  if (allSystemSubjects.value.length > 0 && !planSubjects.value[0].subject_id) {
    planSubjects.value[0].subject_id = allSystemSubjects.value[0].value
  }
}

async function fetchAllSubjects() {
  try {
    const { data } = await $api.get('/api/subjects')
    const list = data.data || data.items || []
    allSystemSubjects.value = list.map(s => ({
      title: `${s.name} ${s.level ? `(${s.level})` : ''}`,
      value: s.id
    }))
  } catch (e) {
    console.error(e)
  }
}

function addSubjectRow() {
  const defaultSub = allSystemSubjects.value[0]?.value || null
  planSubjects.value.push({ subject_id: defaultSub, hours: 2 })
}

function removeSubjectRow(index) {
  planSubjects.value.splice(index, 1)
}

// บันทึกรายวิชาในแผนการสอน
async function submitSaveSubjects() {
  const trimmed = planName.value.trim()
  if (!trimmed) {
    errorMsg.value = 'กรุณาระบุชื่อแผนการสอน'
    return
  }

  // กรองเฉพาะแถวที่เลือกวิชา
  const validSubjects = planSubjects.value
    .filter(s => s.subject_id)
    .map(s => ({
      subject_id: Number(s.subject_id),
      hours: Number(s.hours) || 1
    }))

  savingPlan.value = true
  try {
    await $api.put(`/api/projects/${projectId.value}/lesson-plans/${editingPlanId.value}`, {
      name: trimmed,
      subjects: validSubjects
    })
    manageSubjectsDialog.value = false
    await loadLessonPlans()
    loadProject()
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'บันทึกรายวิชาในแผนการสอนไม่สำเร็จ'
  } finally {
    savingPlan.value = false
  }
}

async function removePlan(planId) {
  if (!confirm('ต้องการลบแผนการสอนนี้ใช่หรือไม่?')) return
  try {
    await $api.delete(`/api/projects/${projectId.value}/lesson-plans/${planId}`)
    await loadLessonPlans()
    loadProject()
  } catch (e) {
    errorMsg.value = e.response?.data?.message || e.message || 'ลบแผนการสอนไม่สำเร็จ'
  }
}

/* -------------------------------------------------------------
   5. ตารางสอนที่ AI จัดให้ (Schedules)
---------------------------------------------------------------- */
const schedules = ref([])
const loadingSchedules = ref(false)

async function loadSchedules() {
  loadingSchedules.value = true
  try {
    const { data } = await $api.get(`/api/projects/${projectId.value}/schedules`)
    schedules.value = data.data || []
  } catch (e) {
    console.error(e)
  } finally {
    loadingSchedules.value = false
  }
}

// สลับแท็บพร้อมอัปเดตลงใน URL Query (ใช้เฉพาะ query)
function switchTab(tab) {
  activeTab.value = tab
  router.replace({
    path: '/project/detail',
    query: {
      ...route.query,
      tab
    }
  })

  if (tab === 'classes') loadProjectClasses()
  else if (tab === 'rooms') loadProjectRooms()
  else if (tab === 'teachers') loadProjectTeachers()
  else if (tab === 'plans') loadLessonPlans()
  else if (tab === 'schedules') loadSchedules()
}

onMounted(async () => {
  await loadProject()
  const initialTab = route.query?.tab || 'schedules'
  switchTab(initialTab)
})
</script>

<template>
  <div class="container mx-auto px-4 py-6 max-w-7xl">
    <!-- Navigation Header -->
    <div class="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs shrink-0">
          <v-icon icon="mdi-folder-open" size="30" />
        </div>
        <div class="flex-1">
          <!-- Inline Rename -->
          <div v-if="isRenaming" class="flex items-center gap-2 max-w-md">
            <input
              v-model="renameInput"
              type="text"
              autofocus
              class="px-3 py-1 text-lg font-bold text-gray-900 bg-blue-50 border-2 border-blue-500 rounded-lg focus:outline-none shadow-xs select-text w-full"
              @keydown.enter.prevent="submitRename"
              @keydown.esc.prevent="cancelRename"
              @blur="submitRename"
            />
            <span class="text-[11px] text-gray-400 whitespace-nowrap">กด Enter เพื่อบันทึก</span>
          </div>

          <div v-else class="flex items-center gap-2">
            <h1 class="text-xl font-bold text-gray-900 leading-tight">
              {{ project?.name || 'กำลังโหลด...' }}
            </h1>
            <button
              v-if="project"
              type="button"
              class="text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all p-1 rounded-md flex items-center justify-center cursor-pointer"
              title="แก้ไขชื่อโครงการ"
              @click="startRename"
            >
              <v-icon icon="mdi-pencil" size="18" />
            </button>
          </div>

          <p class="text-xs text-gray-400 mt-1">
            เนื้อหาและทรัพยากรที่จัดสรรอยู่ภายในโครงการนี้
          </p>
        </div>
      </div>

      <NuxtLink to="/project">
        <v-btn variant="outlined" size="small" prepend-icon="mdi-arrow-left" class="rounded-lg text-none">
          ย้อนกลับ
        </v-btn>
      </NuxtLink>
    </div>

    <!-- Error Alert -->
    <v-alert v-if="errorMsg" type="error" variant="tonal" class="mb-4" closable @click:close="errorMsg = ''">
      {{ errorMsg }}
    </v-alert>

    <!-- Workspace Tabs: จัดลำดับเป็น ตาราง, แผนการสอน, ชั้นเรียน, ครู, ห้องเรียน -->
    <v-card elevation="1" class="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-xs">
      <div class="border-b border-gray-100 px-4 bg-gray-50/60 flex items-center gap-1 overflow-x-auto">
        <!-- 1. ตาราง -->
        <button
          :class="[
            'flex items-center gap-2 px-4 py-3.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap',
            activeTab === 'schedules' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-800'
          ]"
          @click="switchTab('schedules')"
        >
          <v-icon icon="mdi-calendar-clock" size="17" />
          <span>ตาราง</span>
          <v-chip size="x-small" :color="activeTab === 'schedules' ? 'primary' : undefined" variant="flat">
            {{ schedules.length }}
          </v-chip>
        </button>

        <!-- 2. แผนการสอน -->
        <button
          :class="[
            'flex items-center gap-2 px-4 py-3.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap',
            activeTab === 'plans' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-800'
          ]"
          @click="switchTab('plans')"
        >
          <v-icon icon="mdi-book-clock-outline" size="17" />
          <span>แผนการสอน</span>
          <v-chip size="x-small" :color="activeTab === 'plans' ? 'primary' : undefined" variant="flat">
            {{ lessonPlans.length }}
          </v-chip>
        </button>

        <!-- 3. ชั้นเรียน -->
        <button
          :class="[
            'flex items-center gap-2 px-4 py-3.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap',
            activeTab === 'classes' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-800'
          ]"
          @click="switchTab('classes')"
        >
          <v-icon icon="mdi-google-classroom" size="17" />
          <span>ชั้นเรียน</span>
          <v-chip size="x-small" :color="activeTab === 'classes' ? 'primary' : undefined" variant="flat">
            {{ projectClasses.length }}
          </v-chip>
        </button>

        <!-- 4. ครู -->
        <button
          :class="[
            'flex items-center gap-2 px-4 py-3.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap',
            activeTab === 'teachers' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-800'
          ]"
          @click="switchTab('teachers')"
        >
          <v-icon icon="mdi-account-tie" size="17" />
          <span>ครู</span>
          <v-chip size="x-small" :color="activeTab === 'teachers' ? 'primary' : undefined" variant="flat">
            {{ projectTeachers.length }}
          </v-chip>
        </button>

        <!-- 5. ห้องเรียน -->
        <button
          :class="[
            'flex items-center gap-2 px-4 py-3.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap',
            activeTab === 'rooms' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-800'
          ]"
          @click="switchTab('rooms')"
        >
          <v-icon icon="mdi-door-sliding" size="17" />
          <span>ห้องเรียน</span>
          <v-chip size="x-small" :color="activeTab === 'rooms' ? 'primary' : undefined" variant="flat">
            {{ projectRooms.length }}
          </v-chip>
        </button>
      </div>

      <!-- <slot> พื้นที่แสดงผลเนื้อหาของแต่ละแท็บ -->
      <div class="p-6">
        <!-- ==========================================
             SLOT 1: ชั้นเรียนในโครงการ (UI สไตล์เดียวกับ subject/plan)
             ========================================== -->
        <div v-if="activeTab === 'classes'">
          <!-- Filter Controls ด้านบนขวา -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-sm font-bold text-gray-800">ชั้นเรียนที่เข้าร่วมโครงการนี้</h2>
              <p class="text-xs text-gray-400">ค้นหาหรือพิมพ์ชื่อชั้นเรียนเพื่อเพิ่มเข้าโครงการ หรือสร้างชั้นเรียนใหม่ทันที</p>
            </div>

            <!-- Filter Button & Slide Search Box -->
            <div class="flex items-center gap-2">
              <transition name="fade-slide">
                <div v-if="showClassFilter" class="relative flex items-center">
                  <input
                    v-model="classFilterSearch"
                    type="text"
                    placeholder="ค้นหาชั้นเรียน, แผน..."
                    autofocus
                    class="h-9 px-3 pr-8 text-xs bg-white border border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none transition-all w-48 sm:w-56 shadow-xs"
                  />
                  <button
                    v-if="classFilterSearch"
                    type="button"
                    class="absolute right-2.5 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                    @click="classFilterSearch = ''"
                  >
                    <v-icon icon="mdi-close-circle" size="14" />
                  </button>
                </div>
              </transition>

              <button
                type="button"
                :class="[
                  'h-9 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-all shadow-xs',
                  showClassFilter || classFilterSearch
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700'
                ]"
                title="ค้นหา/กรองชั้นเรียนในโครงการ"
                @click="showClassFilter = !showClassFilter"
              >
                <v-icon icon="mdi-filter-variant" size="16" />
                <span>ฟิลเตอร์</span>
                <span
                  v-if="classFilterSearch"
                  class="ml-1 w-2 h-2 rounded-full bg-blue-600"
                />
              </button>
            </div>
          </div>

          <!-- Loading -->
          <div v-if="loadingClasses" class="py-12 text-center">
            <v-progress-circular indeterminate color="primary" />
          </div>

          <div v-else>
            <!-- 1. แถว Form เพิ่มชั้นเรียน (ทำเหมือน Subject Wireframe) -->
            <form class="flex items-start gap-2 mb-8 relative" @submit.prevent="onAddClassSubmit">
              <!-- Input ชื่อชั้นเรียน + Dropdown 5 อันดับแรกที่ใกล้เคียง -->
              <div class="relative flex-1">
                <input
                  v-model="inputClassName"
                  type="text"
                  placeholder="ชื่อชั้นเรียน (Class name)"
                  autocomplete="off"
                  class="w-full h-11 px-3.5 text-sm bg-white border border-black focus:border-blue-600 focus:outline-none transition-all placeholder:text-gray-400 font-normal"
                  @input="onClassNameInput"
                  @focus="isClassDropdownOpen = true"
                  @blur="onClassNameBlur"
                />

                <!-- Dropdown รายการ 5 อันแรกที่ใกล้เคียง -->
                <div
                  v-if="isClassDropdownOpen && filteredClassSuggestions.length > 0"
                  class="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden py-1"
                >
                  <div
                    v-for="item in filteredClassSuggestions"
                    :key="item.id"
                    class="px-3.5 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs text-gray-800 transition-colors"
                    @mousedown.prevent="selectClassSuggestion(item)"
                  >
                    <span class="font-medium text-gray-900">{{ item.name }}</span>
                    <span class="text-gray-400 bg-gray-100 px-2 py-0.5 rounded text-[11px]">#{{ item.id }}</span>
                  </div>
                </div>

                <!-- แจ้งเตือนถ้าพิมพ์แล้วไม่ตรงเลย จะสร้างชั้นเรียนใหม่เมื่อกด + -->
                <div
                  v-else-if="isClassDropdownOpen && inputClassName.trim() && filteredClassSuggestions.length === 0"
                  class="absolute z-50 left-0 right-0 mt-1 bg-amber-50 border border-amber-200 rounded-lg shadow-md px-3.5 py-2 text-xs text-amber-800"
                >
                  <span>ไม่พบชั้นเรียนนี้ในระบบ (กด <strong>+</strong> เพื่อสร้างชั้นเรียนใหม่ทันที)</span>
                </div>
              </div>

              <!-- Input ชื่อในโครงการ (name in project) -->
              <div class="relative w-36 sm:w-48">
                <input
                  v-model="inputNameInProject"
                  type="text"
                  placeholder="ชื่อในโครงการ (ถ้ามี)"
                  autocomplete="off"
                  class="w-full h-11 px-3.5 text-sm bg-white border border-black focus:border-blue-600 focus:outline-none transition-all placeholder:text-gray-400"
                />
              </div>

              <!-- Select แผนการสอน (plan_id) - บังคับเลือก -->
              <div class="w-36 sm:w-56">
                <select
                  v-model="inputPlanId"
                  required
                  class="w-full h-11 px-3 text-xs bg-white border border-black focus:border-blue-600 focus:outline-none transition-all text-gray-700"
                >
                  <option :value="null" disabled>— เลือกแผนการสอน * —</option>
                  <option v-for="p in lessonPlans" :key="p.id" :value="p.id">
                    {{ p.name }}
                  </option>
                </select>
              </div>

              <!-- ปุ่ม Add (+) ตามรูปสีเทาอ่อน -->
              <button
                type="submit"
                :disabled="addingClassRow || !inputClassName.trim() || !inputPlanId"
                class="w-12 h-11 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 disabled:opacity-40 transition-all text-gray-800 flex items-center justify-center font-bold text-lg cursor-pointer shrink-0"
                title="เพิ่มชั้นเรียนเข้าโครงการ (ต้องระบุแผนการสอนก่อน)"
              >
                <v-progress-circular v-if="addingClassRow" indeterminate size="16" width="2" color="gray" />
                <span v-else>+</span>
              </button>
            </form>

            <!-- 2. ตารางแสดงรายการชั้นเรียนในโครงการ (Wireframe Table) -->
            <div class="mt-4">
              <!-- Header Labels -->
              <div class="grid grid-cols-12 text-sm text-gray-700 font-normal pb-3 px-1 border-b border-gray-100 select-none">
                <div class="col-span-4 sm:col-span-4">ชื่อชั้นเรียนเดิม (Class)</div>
                <div class="col-span-4 sm:col-span-4">ชื่อในโครงการ (Name in project)</div>
                <div class="col-span-3 sm:col-span-3">แผนการสอน (Plan)</div>
                <div class="col-span-1 sm:col-span-1 text-right">จัดการ</div>
              </div>

              <!-- Rows List (ผ่าน displayedProjectClasses) -->
              <div v-if="displayedProjectClasses.length > 0" class="divide-y divide-gray-100">
                <div
                  v-for="c in displayedProjectClasses"
                  :key="c.rel_id"
                  class="grid grid-cols-12 items-center py-3.5 px-1 hover:bg-gray-50/80 transition-colors text-sm text-gray-800 group"
                >
                  <!-- ชื่อชั้นเรียนเดิม -->
                  <div class="col-span-4 sm:col-span-4 font-semibold text-gray-800 pr-2 truncate" :title="c.class_name">
                    {{ c.class_name }}
                  </div>

                  <!-- ชื่อในโครงการ (Name in Project) + Inline Edit -->
                  <div class="col-span-4 sm:col-span-4 pr-2">
                    <div v-if="renamingClassRelId === c.rel_id" class="flex items-center gap-1 max-w-xs">
                      <input
                        v-model="renameClassInput"
                        type="text"
                        autofocus
                        class="px-2 py-1 text-xs border border-blue-500 rounded bg-blue-50 w-full focus:outline-none"
                        @keydown.enter="submitRenameClass(c)"
                        @keydown.esc="renamingClassRelId = null"
                        @blur="submitRenameClass(c)"
                      />
                    </div>
                    <div v-else class="flex items-center gap-1.5 group/rename">
                      <span v-if="c.name_in_project" class="font-medium text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md text-xs">
                        {{ c.name_in_project }}
                      </span>
                      <span v-else class="text-gray-400 text-xs italic">
                        (ใช้ชื่อเดียวกับระบบ)
                      </span>
                      <button
                        type="button"
                        class="text-gray-400 hover:text-blue-600 p-0.5 rounded"
                        title="แก้ไขชื่อในโครงการ"
                        @click="startRenameClass(c)"
                      >
                        <v-icon icon="mdi-pencil" size="13" />
                      </button>
                    </div>
                  </div>

                  <!-- แผนการสอน (Plan) + Dropdown เปลี่ยนแผน -->
                  <div class="col-span-3 sm:col-span-3 text-xs pr-2">
                    <div v-if="editingClassPlanRelId === c.rel_id" class="max-w-[200px]">
                      <select
                        :value="c.plan_id"
                        class="w-full py-1 px-1.5 text-xs border border-blue-500 rounded bg-blue-50 focus:outline-none"
                        @change="updateClassPlan(c, $event.target.value ? Number($event.target.value) : null)"
                        @blur="editingClassPlanRelId = null"
                      >
                        <option :value="null">— ไม่มีแผน —</option>
                        <option v-for="p in lessonPlans" :key="p.id" :value="p.id">
                          {{ p.name }}
                        </option>
                      </select>
                    </div>
                    <div v-else class="flex items-center gap-1.5">
                      <span v-if="c.plan_name" class="font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded text-[11px] truncate" :title="c.plan_name">
                        {{ c.plan_name }}
                      </span>
                      <span v-else class="text-gray-400 text-xs italic">
                        (ยังไม่ระบุแผน)
                      </span>
                      <button
                        type="button"
                        class="text-gray-400 hover:text-purple-600 p-0.5 rounded"
                        title="กำหนด/เปลี่ยนแผนการสอน"
                        @click="editingClassPlanRelId = c.rel_id"
                      >
                        <v-icon icon="mdi-pencil" size="13" />
                      </button>
                    </div>
                  </div>

                  <!-- จัดการ (ลบออกจากโครงการ) -->
                  <div class="col-span-1 sm:col-span-1 flex items-center justify-end">
                    <v-btn
                      icon="mdi-trash-can-outline"
                      size="small"
                      variant="text"
                      color="error"
                      title="นำชั้นเรียนนี้ออกจากโครงการ"
                      @click="removeClass(c.rel_id)"
                    />
                  </div>
                </div>
              </div>

              <!-- Empty Filter Result -->
              <div v-else-if="projectClasses.length > 0 && displayedProjectClasses.length === 0" class="text-center py-10 text-gray-400 text-xs">
                ไม่พบชั้นเรียนที่ตรงกับคำค้นหา "{{ classFilterSearch }}"
              </div>

              <!-- Empty State -->
              <div v-else class="text-center py-12 text-gray-400 text-xs">
                ยังไม่มีชั้นเรียนในโครงการนี้ (พิมพ์ชื่อชั้นเรียนด้านบนแล้วกด + เพื่อเพิ่ม)
              </div>
            </div>
          </div>
        </div>

        <!-- ==========================================
             SLOT 2: ห้องเรียนในโครงการ (UI สไตล์เดียวกับ subject/plan/teacher)
             ========================================== -->
        <div v-else-if="activeTab === 'rooms'">
          <!-- Filter Controls ด้านบนขวา -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-sm font-bold text-gray-800">ห้องเรียนที่จัดสรรในโครงการนี้</h2>
              <p class="text-xs text-gray-400">ค้นหาหรือพิมพ์ชื่อห้องเรียนเพื่อเพิ่มเข้าโครงการ หรือสร้างห้องเรียนใหม่ทันที</p>
            </div>

            <!-- Filter Button & Slide Search Box -->
            <div class="flex items-center gap-2">
              <transition name="fade-slide">
                <div v-if="showRoomFilter" class="relative flex items-center">
                  <input
                    v-model="roomFilterSearch"
                    type="text"
                    placeholder="ค้นหาห้องเรียน, อุปกรณ์..."
                    autofocus
                    class="h-9 px-3 pr-8 text-xs bg-white border border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none transition-all w-48 sm:w-56 shadow-xs"
                  />
                  <button
                    v-if="roomFilterSearch"
                    type="button"
                    class="absolute right-2.5 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                    @click="roomFilterSearch = ''"
                  >
                    <v-icon icon="mdi-close-circle" size="14" />
                  </button>
                </div>
              </transition>

              <button
                type="button"
                :class="[
                  'h-9 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-all shadow-xs',
                  showRoomFilter || roomFilterSearch
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700'
                ]"
                title="ค้นหา/กรองห้องเรียนในโครงการ"
                @click="showRoomFilter = !showRoomFilter"
              >
                <v-icon icon="mdi-filter-variant" size="16" />
                <span>ฟิลเตอร์</span>
                <span
                  v-if="roomFilterSearch"
                  class="ml-1 w-2 h-2 rounded-full bg-blue-600"
                />
              </button>
            </div>
          </div>

          <!-- Loading -->
          <div v-if="loadingRooms" class="py-12 text-center">
            <v-progress-circular indeterminate color="primary" />
          </div>

          <div v-else>
            <!-- 1. แถว Form เพิ่มห้องเรียน (Wireframe Form เหมือน subject/teacher) -->
            <form class="flex items-start gap-2 mb-8 relative" @submit.prevent="onAddRoomSubmit">
              <!-- Input ชื่อห้องเรียน + Dropdown 5 อันดับแรกที่ใกล้เคียง -->
              <div class="relative flex-1">
                <input
                  v-model="inputRoomName"
                  type="text"
                  placeholder="ชื่อห้องเรียน (Room name)"
                  autocomplete="off"
                  class="w-full h-11 px-3.5 text-sm bg-white border border-black focus:border-blue-600 focus:outline-none transition-all placeholder:text-gray-400 font-normal"
                  @input="onRoomNameInput"
                  @focus="isRoomDropdownOpen = true"
                  @blur="onRoomNameBlur"
                />

                <!-- Dropdown รายการ 5 อันแรกที่ใกล้เคียง -->
                <div
                  v-if="isRoomDropdownOpen && filteredRoomSuggestions.length > 0"
                  class="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden py-1"
                >
                  <div
                    v-for="item in filteredRoomSuggestions"
                    :key="item.id"
                    class="px-3.5 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs text-gray-800 transition-colors"
                    @mousedown.prevent="selectRoomSuggestion(item)"
                  >
                    <div>
                      <span class="font-medium text-gray-900">{{ item.name }}</span>
                      <span v-if="item.feature" class="text-gray-400 text-[11px] ml-1.5">({{ item.feature }})</span>
                    </div>
                    <span class="text-gray-400 bg-gray-100 px-2 py-0.5 rounded text-[11px]">#{{ item.id }}</span>
                  </div>
                </div>

                <!-- แจ้งเตือนถ้าพิมพ์แล้วไม่ตรงเลย จะสร้างห้องใหม่เมื่อกด + -->
                <div
                  v-else-if="isRoomDropdownOpen && inputRoomName.trim() && filteredRoomSuggestions.length === 0"
                  class="absolute z-50 left-0 right-0 mt-1 bg-amber-50 border border-amber-200 rounded-lg shadow-md px-3.5 py-2 text-xs text-amber-800"
                >
                  <span>ไม่พบห้องเรียนนี้ในระบบ (กด <strong>+</strong> เพื่อสร้างห้องเรียนใหม่ทันที)</span>
                </div>
              </div>

              <!-- Input คุณสมบัติ/อุปกรณ์ (Feature) -->
              <div class="relative w-44 sm:w-60">
                <input
                  v-model="inputRoomFeature"
                  type="text"
                  placeholder="คุณสมบัติ/อุปกรณ์ (Feature ถ้ามี)"
                  autocomplete="off"
                  class="w-full h-11 px-3.5 text-sm bg-white border border-black focus:border-blue-600 focus:outline-none transition-all placeholder:text-gray-400"
                />
              </div>

              <!-- ปุ่ม Add (+) ตามรูปสีเทาอ่อน -->
              <button
                type="submit"
                :disabled="addingRoomRow || !inputRoomName.trim()"
                class="w-12 h-11 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 disabled:opacity-40 transition-all text-gray-800 flex items-center justify-center font-bold text-lg cursor-pointer shrink-0"
                title="เพิ่มห้องเรียนเข้าโครงการ"
              >
                <v-progress-circular v-if="addingRoomRow" indeterminate size="16" width="2" color="gray" />
                <span v-else>+</span>
              </button>
            </form>

            <!-- 2. ตารางแสดงรายการห้องเรียนในโครงการ (Wireframe Table) -->
            <div class="mt-4">
              <!-- Header Labels -->
              <div class="grid grid-cols-12 text-sm text-gray-700 font-normal pb-3 px-1 border-b border-gray-100 select-none">
                <div class="col-span-4 sm:col-span-4">ชื่อห้องเรียน</div>
                <div class="col-span-7 sm:col-span-7">คุณสมบัติ / อุปกรณ์ (Feature)</div>
                <div class="col-span-1 sm:col-span-1 text-right">จัดการ</div>
              </div>

              <!-- Rows List (ผ่าน displayedProjectRooms) -->
              <div v-if="displayedProjectRooms.length > 0" class="divide-y divide-gray-100">
                <div
                  v-for="r in displayedProjectRooms"
                  :key="r.rel_id"
                  class="grid grid-cols-12 items-center py-3.5 px-1 hover:bg-gray-50/80 transition-colors text-sm text-gray-800 group"
                >
                  <!-- ชื่อห้องเรียน -->
                  <div class="col-span-4 sm:col-span-4 font-semibold text-gray-800 pr-2 truncate" :title="r.room_name">
                    {{ r.room_name }}
                  </div>

                  <!-- Feature -->
                  <div class="col-span-7 sm:col-span-7 text-xs text-gray-600 truncate pr-2" :title="r.feature">
                    {{ r.feature || '-' }}
                  </div>

                  <!-- จัดการ (ลบออกจากโครงการ) -->
                  <div class="col-span-1 sm:col-span-1 flex items-center justify-end">
                    <v-btn
                      icon="mdi-trash-can-outline"
                      size="small"
                      variant="text"
                      color="error"
                      title="นำห้องเรียนนี้ออกจากโครงการ"
                      @click="removeRoom(r.rel_id)"
                    />
                  </div>
                </div>
              </div>

              <!-- Empty Filter Result -->
              <div v-else-if="projectRooms.length > 0 && displayedProjectRooms.length === 0" class="text-center py-10 text-gray-400 text-xs">
                ไม่พบห้องเรียนที่ตรงกับคำค้นหา "{{ roomFilterSearch }}"
              </div>

              <!-- Empty State -->
              <div v-else class="text-center py-12 text-gray-400 text-xs">
                ยังไม่มีห้องเรียนในโครงการนี้ (พิมพ์ชื่อห้องเรียนด้านบนแล้วกด + เพื่อเพิ่ม)
              </div>
            </div>
          </div>
        </div>

        <!-- ==========================================
             SLOT 3: ครู / อาจารย์ในโครงการ (UI สไตล์เดียวกับ subject/plan)
             ========================================== -->
        <div v-else-if="activeTab === 'teachers'">
          <!-- Filter Controls ด้านบนขวา -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-sm font-bold text-gray-800">ครู/อาจารย์ผู้สอนในโครงการนี้</h2>
              <p class="text-xs text-gray-400">ค้นหาหรือพิมพ์ชื่ออาจารย์เพื่อเพิ่มเข้าโครงการ หรือเพิ่มอาจารย์ใหม่เข้าระบบทันที</p>
            </div>

            <!-- Filter Button & Slide Search Box -->
            <div class="flex items-center gap-2">
              <transition name="fade-slide">
                <div v-if="showTeacherFilter" class="relative flex items-center">
                  <input
                    v-model="teacherFilterSearch"
                    type="text"
                    placeholder="ค้นหาอาจารย์, อีเมล..."
                    autofocus
                    class="h-9 px-3 pr-8 text-xs bg-white border border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none transition-all w-48 sm:w-56 shadow-xs"
                  />
                  <button
                    v-if="teacherFilterSearch"
                    type="button"
                    class="absolute right-2.5 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                    @click="teacherFilterSearch = ''"
                  >
                    <v-icon icon="mdi-close-circle" size="14" />
                  </button>
                </div>
              </transition>

              <button
                type="button"
                :class="[
                  'h-9 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-all shadow-xs',
                  showTeacherFilter || teacherFilterSearch
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700'
                ]"
                title="ค้นหา/กรองอาจารย์ในโครงการ"
                @click="showTeacherFilter = !showTeacherFilter"
              >
                <v-icon icon="mdi-filter-variant" size="16" />
                <span>ฟิลเตอร์</span>
                <span
                  v-if="teacherFilterSearch"
                  class="ml-1 w-2 h-2 rounded-full bg-blue-600"
                />
              </button>
            </div>
          </div>

          <!-- Loading -->
          <div v-if="loadingTeachers" class="py-12 text-center">
            <v-progress-circular indeterminate color="primary" />
          </div>

          <div v-else>
            <!-- 1. แถว Form เพิ่มอาจารย์ (Wireframe Form เหมือน subject) -->
            <form class="flex items-start gap-2 mb-8 relative" @submit.prevent="onAddTeacherSubmit">
              <!-- Input ชื่ออาจารย์ + Dropdown 5 อันดับแรกที่ใกล้เคียง -->
              <div class="relative flex-1">
                <input
                  v-model="inputTeacherName"
                  type="text"
                  placeholder="ชื่ออาจารย์ (Teacher name)"
                  autocomplete="off"
                  class="w-full h-11 px-3.5 text-sm bg-white border border-black focus:border-blue-600 focus:outline-none transition-all placeholder:text-gray-400 font-normal"
                  @input="onTeacherNameInput"
                  @focus="isTeacherDropdownOpen = true"
                  @blur="onTeacherNameBlur"
                />

                <!-- Dropdown รายการ 5 อันแรกที่ใกล้เคียง -->
                <div
                  v-if="isTeacherDropdownOpen && filteredTeacherSuggestions.length > 0"
                  class="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden py-1"
                >
                  <div
                    v-for="item in filteredTeacherSuggestions"
                    :key="item.id"
                    class="px-3.5 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs text-gray-800 transition-colors"
                    @mousedown.prevent="selectTeacherSuggestion(item)"
                  >
                    <div>
                      <span class="font-medium text-gray-900">{{ item.name || item.user_name }}</span>
                      <span v-if="item.email" class="text-gray-400 text-[11px] ml-1.5">({{ item.email }})</span>
                    </div>
                    <span class="text-gray-400 bg-gray-100 px-2 py-0.5 rounded text-[11px]">#{{ item.id }}</span>
                  </div>
                </div>

                <!-- แจ้งเตือนถ้าพิมพ์แล้วไม่ตรงเลย จะสร้างอาจารย์ใหม่เมื่อกด + -->
                <div
                  v-else-if="isTeacherDropdownOpen && inputTeacherName.trim() && filteredTeacherSuggestions.length === 0"
                  class="absolute z-50 left-0 right-0 mt-1 bg-amber-50 border border-amber-200 rounded-lg shadow-md px-3.5 py-2 text-xs text-amber-800"
                >
                  <span>ไม่พบอาจารย์ท่านนี้ในระบบ (กด <strong>+</strong> เพื่อสร้างข้อมูลอาจารย์ใหม่ทันที)</span>
                </div>
              </div>

              <!-- ปุ่ม Add (+) ตามรูปสีเทาอ่อน -->
              <button
                type="submit"
                :disabled="addingTeacherRow || !inputTeacherName.trim()"
                class="w-12 h-11 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 disabled:opacity-40 transition-all text-gray-800 flex items-center justify-center font-bold text-lg cursor-pointer shrink-0"
                title="เพิ่มอาจารย์เข้าโครงการ"
              >
                <v-progress-circular v-if="addingTeacherRow" indeterminate size="16" width="2" color="gray" />
                <span v-else>+</span>
              </button>
            </form>

            <!-- 2. ตารางแสดงรายการอาจารย์ในโครงการ (Wireframe Table) -->
            <div class="mt-4">
              <!-- Header Labels -->
              <div class="grid grid-cols-12 text-sm text-gray-700 font-normal pb-3 px-1 border-b border-gray-100 select-none">
                <div class="col-span-5 sm:col-span-4">ชื่ออาจารย์</div>
                <div class="col-span-4 sm:col-span-4">อีเมล (บัญชีผู้ใช้)</div>
                <div class="col-span-2 sm:col-span-3">ผลงาน / Portfolio</div>
                <div class="col-span-1 sm:col-span-1 text-right">จัดการ</div>
              </div>

              <!-- Rows List (ผ่าน displayedProjectTeachers) -->
              <div v-if="displayedProjectTeachers.length > 0" class="divide-y divide-gray-100">
                <div
                  v-for="t in displayedProjectTeachers"
                  :key="t.rel_id"
                  class="grid grid-cols-12 items-center py-3.5 px-1 hover:bg-gray-50/80 transition-colors text-sm text-gray-800 group"
                >
                  <!-- ชื่ออาจารย์ -->
                  <div class="col-span-5 sm:col-span-4 font-semibold text-gray-800 pr-2 truncate" :title="t.name || t.teacher_name || t.user_name">
                    {{ t.name || t.teacher_name || t.user_name || '-' }}
                  </div>

                  <!-- อีเมล -->
                  <div class="col-span-4 sm:col-span-4 text-xs text-gray-600 truncate pr-2" :title="t.email">
                    {{ t.email || '-' }}
                  </div>

                  <!-- Portfolio -->
                  <div class="col-span-2 sm:col-span-3 text-xs text-gray-500 truncate pr-2" :title="t.portfolio">
                    {{ t.portfolio || '-' }}
                  </div>

                  <!-- จัดการ (ลบออกจากโครงการ) -->
                  <div class="col-span-1 sm:col-span-1 flex items-center justify-end">
                    <v-btn
                      icon="mdi-trash-can-outline"
                      size="small"
                      variant="text"
                      color="error"
                      title="นำอาจารย์ท่านนี้ออกจากโครงการ"
                      @click="removeTeacher(t.rel_id)"
                    />
                  </div>
                </div>
              </div>

              <!-- Empty Filter Result -->
              <div v-else-if="projectTeachers.length > 0 && displayedProjectTeachers.length === 0" class="text-center py-10 text-gray-400 text-xs">
                ไม่พบอาจารย์ที่ตรงกับคำค้นหา "{{ teacherFilterSearch }}"
              </div>

              <!-- Empty State -->
              <div v-else class="text-center py-12 text-gray-400 text-xs">
                ยังไม่มีอาจารย์ในโครงการนี้ (พิมพ์ชื่ออาจารย์ด้านบนแล้วกด + เพื่อเพิ่ม)
              </div>
            </div>
          </div>
        </div>

        <!-- ==========================================
             SLOT 4: แผนการสอน (Lesson Plan: name + subjects JSON)
             ========================================== -->
        <div v-else-if="activeTab === 'plans'">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-sm font-bold text-gray-800">แผนการสอนประจำโครงการ (Lesson Plans)</h2>
              <p class="text-xs text-gray-400">คลิกที่แผนการสอนเพื่อเข้าไปจัดการรายวิชาและชั่วโมงสอน</p>
            </div>
            <v-btn
              color="primary"
              variant="flat"
              prepend-icon="mdi-plus"
              size="small"
              class="rounded-lg text-none font-medium"
              @click="openAddPlanModal"
            >
              สร้างแผนการสอนใหม่
            </v-btn>
          </div>

          <div v-if="loadingPlans" class="py-12 text-center">
            <v-progress-circular indeterminate color="primary" />
          </div>

          <div v-else-if="lessonPlans.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="plan in lessonPlans"
              :key="plan.id"
              class="border border-gray-200/90 hover:border-blue-500 rounded-2xl p-4 bg-white relative group transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer flex items-center justify-between"
              @click="goToPlanPage(plan)"
            >
              <div class="flex items-center gap-3 overflow-hidden flex-1 mr-2">
                <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0 shadow-xs">
                  <v-icon icon="mdi-book-clock" size="22" />
                </div>
                <div class="truncate flex-1">
                  <!-- Inline Rename ชื่อแผนการสอน -->
                  <div v-if="renamingPlanId === plan.id" class="flex items-center gap-1.5" @click.stop>
                    <input
                      v-model="renamePlanInput"
                      type="text"
                      autofocus
                      class="px-2 py-0.5 text-sm font-bold text-gray-900 bg-blue-50 border border-blue-500 rounded focus:outline-none w-full"
                      @keydown.enter.prevent="submitRenamePlan(plan)"
                      @keydown.esc.prevent="cancelRenamePlan"
                      @blur="submitRenamePlan(plan)"
                    />
                  </div>
                  <div v-else>
                    <h3 class="font-bold text-sm text-gray-800 truncate" :title="plan.name">
                      {{ plan.name }}
                    </h3>
                    <div class="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                      <span>สร้างเมื่อ {{ new Date(plan.created_at).toLocaleDateString('th-TH') }}</span>
                      <span class="text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded text-[10px] font-semibold">
                        {{ plan.subjects?.length || 0 }} วิชา
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Action Buttons: แก้ไขชื่อ และ ลบ -->
              <div class="flex items-center gap-0.5 shrink-0" @click.stop>
                <v-btn
                  icon="mdi-pencil-outline"
                  size="small"
                  variant="text"
                  color="primary"
                  title="แก้ไขชื่อแผนการสอน"
                  @click="startRenamePlan(plan, $event)"
                />
                <v-btn
                  icon="mdi-delete-outline"
                  size="small"
                  variant="text"
                  color="error"
                  title="ลบแผนการสอน"
                  @click="removePlan(plan.id)"
                />
              </div>
            </div>
          </div>

          <div v-else class="py-12 text-center border border-dashed border-gray-200 rounded-xl">
            <v-icon icon="mdi-book-clock-outline" size="44" class="text-gray-300 mb-2" />
            <h4 class="text-sm font-semibold text-gray-700">ยังไม่มีแผนการสอนในโครงการนี้</h4>
            <p class="text-xs text-gray-400 mt-0.5 mb-3">กดปุ่มด้านบนเพื่อสร้างแผนการสอนใหม่</p>
          </div>
        </div>

        <!-- ==========================================
             SLOT 5: ตารางเรียนที่ AI จัดให้ (Schedules)
             ========================================== -->
        <div v-else-if="activeTab === 'schedules'">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-sm font-bold text-gray-800">ตารางเรียนที่ AI จัดสรรเรียบร้อยแล้ว</h2>
              <p class="text-xs text-gray-400">ผลการจัดสรรคาบสอน ชั้นเรียน ห้องเรียน และผู้สอนอัตโนมัติ</p>
            </div>
            <v-chip color="success" size="small" variant="tonal" prepend-icon="mdi-check-circle">
              AI Auto-Scheduled
            </v-chip>
          </div>

          <div v-if="loadingSchedules" class="py-12 text-center">
            <v-progress-circular indeterminate color="primary" />
          </div>

          <div v-else-if="schedules.length > 0" class="overflow-x-auto border border-gray-100 rounded-xl">
            <table class="w-full text-left text-sm border-collapse">
              <thead>
                <tr class="bg-gray-50/70 border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase">
                  <th class="py-3 px-4 w-20">คาบเรียน</th>
                  <th class="py-3 px-4">ชั้นเรียน</th>
                  <th class="py-3 px-4">รายวิชา</th>
                  <th class="py-3 px-4">อาจารย์ผู้สอน</th>
                  <th class="py-3 px-4">ห้องเรียน</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="s in schedules" :key="s.id" class="hover:bg-blue-50/30 transition-colors">
                  <td class="py-3 px-4 font-bold text-blue-600">คาบที่ {{ s.period }}</td>
                  <td class="py-3 px-4 font-semibold text-gray-800">{{ s.class_name || '-' }}</td>
                  <td class="py-3 px-4 text-gray-700">{{ s.subject_name || '-' }}</td>
                  <td class="py-3 px-4 text-gray-600 text-xs">{{ s.teacher_name || '-' }}</td>
                  <td class="py-3 px-4">
                    <span class="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-mono">
                      {{ s.room_name || '-' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="py-12 text-center border border-dashed border-gray-200 rounded-xl">
            <v-icon icon="mdi-robot-confused-outline" size="44" class="text-gray-300 mb-2" />
            <h4 class="text-sm font-semibold text-gray-700">ยังไม่มีผลตารางเรียนจาก AI ในโครงการนี้</h4>
            <p class="text-xs text-gray-400 mt-0.5">เมื่อระบบ AI Agent ประมวลผลการจัดตาราง ข้อมูลคาบสอนจะปรากฏที่นี่</p>
          </div>
        </div>
      </div>
    </v-card>




    <!-- 1. Modal: สร้างแผนการสอนใหม่ (ใส่แค่ชื่อแผน แล้วสร้างได้เลย) -->
    <v-dialog v-model="addPlanDialog" max-width="450">
      <v-card class="rounded-2xl pa-6 bg-white shadow-lg">
        <h3 class="font-bold text-base text-gray-800 mb-1">สร้างแผนการสอนใหม่</h3>
        <p class="text-xs text-gray-400 mb-4">ระบุชื่อแผนการสอนเพื่อเริ่มต้นสร้างแผน</p>

        <form class="space-y-4" @submit.prevent="submitCreatePlan">
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1">ชื่อแผนการสอน *</label>
            <v-text-field
              v-model="planName"
              placeholder="เช่น แผนการสอน ปวช.1 ภาคเรียนที่ 1/2568"
              density="comfortable"
              variant="outlined"
              hide-details
              autofocus
              required
            />
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <v-btn variant="text" size="small" @click="addPlanDialog = false">ยกเลิก</v-btn>
            <v-btn type="submit" color="primary" variant="flat" size="small" :loading="savingPlan">
              สร้างแผนการสอน
            </v-btn>
          </div>
        </form>
      </v-card>
    </v-dialog>

    <!-- 2. Modal: จัดการรายวิชาและชั่วโมงสอนในแผนการสอน -->
    <v-dialog v-model="manageSubjectsDialog" max-width="540">
      <v-card class="rounded-2xl pa-6 bg-white shadow-lg">
        <div class="flex items-center justify-between mb-1">
          <h3 class="font-bold text-base text-gray-800">จัดการรายวิชาในแผนการสอน</h3>
          <span class="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-semibold">{{ selectedPlan?.name }}</span>
        </div>
        <p class="text-xs text-gray-400 mb-4">กำหนดหรือแก้ไขรายวิชา และชั่วโมงสอนต่อสัปดาห์</p>

        <form class="space-y-4" @submit.prevent="submitSaveSubjects">
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1">ชื่อแผนการสอน *</label>
            <v-text-field
              v-model="planName"
              placeholder="ชื่อแผนการสอน"
              density="comfortable"
              variant="outlined"
              hide-details
              required
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-xs font-semibold text-gray-700">รายวิชาและชั่วโมงสอนต่อสัปดาห์</label>
              <button type="button" class="text-xs text-blue-600 font-semibold hover:underline" @click="addSubjectRow">
                + เพิ่มวิชา
              </button>
            </div>

            <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
              <div
                v-for="(sub, idx) in planSubjects"
                :key="idx"
                class="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200"
              >
                <div class="flex-1">
                  <v-select
                    v-model="sub.subject_id"
                    :items="allSystemSubjects"
                    item-title="title"
                    item-value="value"
                    density="compact"
                    variant="outlined"
                    hide-details
                    placeholder="เลือกวิชา..."
                  />
                </div>
                <div class="w-24">
                  <v-text-field
                    v-model.number="sub.hours"
                    type="number"
                    min="1"
                    density="compact"
                    variant="outlined"
                    suffix="ชม."
                    hide-details
                  />
                </div>
                <v-btn
                  v-if="planSubjects.length > 1"
                  icon="mdi-close"
                  size="x-small"
                  variant="text"
                  color="error"
                  @click="removeSubjectRow(idx)"
                />
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <v-btn variant="text" size="small" @click="manageSubjectsDialog = false">ยกเลิก</v-btn>
            <v-btn type="submit" color="primary" variant="flat" size="small" :loading="savingPlan">
              บันทึกรายวิชา
            </v-btn>
          </div>
        </form>
      </v-card>
    </v-dialog>
  </div>
</template>
