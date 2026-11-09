<template>
  <div class="timetable-sheet bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 text-slate-800">
    <!-- Header ส่วนหัวตาราง สะอาดตา สไตล์โมเดิร์น -->
    <div class="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm"
          :class="type === 'class' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'"
        >
          <v-icon :icon="type === 'class' ? 'mdi-google-classroom' : 'mdi-account-tie'" size="20" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h3 class="text-lg font-bold text-slate-800 tracking-tight">
              {{ title }}
            </h3>
            <span
              class="px-2 py-0.5 text-[11px] font-semibold rounded-full border"
              :class="type === 'class' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'"
            >
              {{ type === 'class' ? 'ตารางเรียนห้อง' : 'ตารางสอนครู' }}
            </span>
          </div>
          <p v-if="subtitle" class="text-xs text-slate-500 mt-0.5">
            {{ subtitle }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 self-end sm:self-auto text-xs font-mono text-slate-600">
        <span class="inline-flex items-center gap-1.5 bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200 font-semibold">
          <v-icon icon="mdi-clock-time-four-outline" size="15" class="text-slate-500" />
          {{ totalScheduledPeriods }} คาบ / สัปดาห์
        </span>
        <button
          type="button"
          class="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-medium transition shadow-2xs cursor-pointer"
          title="ดาวน์โหลดตารางเป็นไฟล์ CSV"
          @click="downloadCSV"
        >
          <v-icon icon="mdi-file-delimited-outline" size="15" class="text-emerald-600" />
          <span>CSV</span>
        </button>
        <button
          type="button"
          class="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-medium transition shadow-2xs cursor-pointer"
          @click="printTable"
        >
          <v-icon icon="mdi-printer-outline" size="15" />
          <span>พิมพ์</span>
        </button>
      </div>
    </div>

    <!-- ตัวตารางเรียน พร้อมช่องขนาดเท่ากันเป๊ะทุกคอลัมน์ -->
    <div class="overflow-x-auto">
      <table class="timetable-table w-full border-collapse text-center table-fixed min-w-[960px]">
        <!-- กำหนด colgroup ให้ 10 คอลัมน์กว้าง 10% เท่ากันเป๊ะในระดับเบราว์เซอร์ -->
        <colgroup>
          <col class="w-[10%]">
          <col class="w-[10%]">
          <col class="w-[10%]">
          <col class="w-[10%]">
          <col class="w-[10%]">
          <col class="w-[10%]">
          <col class="w-[10%]">
          <col class="w-[10%]">
          <col class="w-[10%]">
          <col class="w-[10%]">
        </colgroup>
        <thead>
          <!-- แถวที่ 1: แถบเวลา -->
          <tr class="bg-slate-100/80 text-slate-600 text-xs font-semibold border-b border-slate-200">
            <th class="border-r border-b border-slate-200 py-2.5 px-3 bg-slate-200/50">
              เวลา
            </th>
            <th
              v-for="time in periodTimes"
              :key="time.period"
              class="border-r border-b border-slate-200 py-2.5 px-1 font-mono text-[11px]"
              :class="{ 'bg-amber-50/70 font-bold text-amber-900': time.isLunch }"
            >
              {{ time.label }}
            </th>
          </tr>

          <!-- แถวที่ 2: เลขคาบ -->
          <tr class="bg-slate-50 text-slate-500 text-xs font-bold border-b border-slate-200">
            <th class="border-r border-b border-slate-200 py-2 px-3 bg-slate-100/70">
              วัน / คาบ
            </th>
            <th
              v-for="time in periodTimes"
              :key="'p-' + time.period"
              class="border-r border-b border-slate-200 py-1.5 px-1 font-mono text-xs"
              :class="{ 'bg-amber-50/70 text-amber-800 font-bold': time.isLunch }"
            >
              <span v-if="time.isLunch">พัก</span>
              <span v-else>คาบ {{ time.periodDisplay }}</span>
            </th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="(day, dayIndex) in days"
            :key="day.name"
            class="border-b border-slate-200 hover:bg-slate-50/50 transition-colors"
          >
            <!-- คอลัมน์วัน (จันทร์ - ศุกร์) -->
            <td class="border-r border-slate-200 py-3.5 px-2.5 font-bold text-xs bg-slate-50/60 text-slate-700 whitespace-nowrap">
              <div class="flex items-center justify-center gap-2">
                <span
                  class="w-2.5 h-2.5 rounded-full inline-block shadow-2xs"
                  :style="{ backgroundColor: day.color }"
                />
                <span>{{ day.name }}</span>
              </div>
            </td>

            <!-- แต่ละช่วงคาบของวัน (คำนวณ Colspan รวมวิชาที่เรียนต่อเนื่องกัน) -->
            <template v-for="cell in getDayCells(dayIndex)" :key="day.name + '-' + cell.key">
              <!-- กรณีพักเที่ยง -->
              <td
                v-if="cell.isLunch"
                class="border-r border-slate-200 py-2 px-1 bg-amber-50/40 text-amber-800 select-none align-middle h-24"
              >
                <div class="flex items-center justify-center h-full">
                  <span class="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-100/80 text-amber-900 border border-amber-200/80 shadow-2xs">
                    พัก
                  </span>
                </div>
              </td>

              <!-- กรณีมีวิชาเรียน (รวมเซลล์ต่อเนื่องด้วย colspan) -->
              <td
                v-else-if="cell.slot"
                :colspan="cell.span"
                class="border-r border-slate-200 p-1.5 align-middle h-24"
              >
                <div
                  class="h-full w-full flex flex-col justify-between items-center rounded-xl p-2 transition-all duration-200 shadow-2xs hover:shadow-sm"
                  :class="getSubjectCardStyle(cell.slot)"
                >
                  <!-- หัวการ์ด: รหัสวิชา + Badge จำนวนคาบ (ถ้าเรียนติดกันมากกว่า 1 คาบ) -->
                  <div class="w-full flex items-center justify-between gap-1">
                    <span class="font-mono font-bold text-xs tracking-tight">
                      {{ cell.slot.subject_code || 'วิชา' }}
                    </span>
                    <span
                      v-if="cell.span > 1"
                      class="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-white/80 border shadow-2xs font-mono text-slate-700"
                    >
                      {{ cell.span }} คาบ
                    </span>
                  </div>

                  <!-- ชื่อวิชาเต็ม อ่านง่าย ไม่รก -->
                  <div
                    class="font-semibold text-xs text-center my-0.5 leading-snug line-clamp-2"
                    :title="cell.slot.subject_name"
                  >
                    {{ cell.slot.subject_name }}
                  </div>

                  <!-- ท้ายการ์ด: ข้อมูลห้องเรียน และ ผู้สอน/ชั้นเรียน -->
                  <div class="w-full pt-1 border-t border-black/5 flex items-center justify-between text-[11px] gap-1 font-medium">
                    <!-- ข้อมูลห้องเรียน -->
                    <span class="inline-flex items-center gap-1 font-mono text-[10.5px] truncate" :title="cell.slot.room_name">
                      <v-icon icon="mdi-map-marker-outline" size="12" class="opacity-70" />
                      <span>{{ formatRoomName(cell.slot.room_name) }}</span>
                    </span>

                    <!-- ข้อมูลครูผู้สอน หรือ ห้องเรียน -->
                    <span
                      class="inline-flex items-center gap-1 truncate text-[10.5px]"
                      :title="type === 'class' ? cell.slot.teacher_name : cell.slot.class_name"
                    >
                      <v-icon :icon="type === 'class' ? 'mdi-account-outline' : 'mdi-google-classroom'" size="12" class="opacity-70" />
                      <span>{{ type === 'class' ? formatTeacherName(cell.slot.teacher_name) : cell.slot.class_name }}</span>
                    </span>
                  </div>
                </div>
              </td>

              <!-- กรณีคาบว่าง ไม่มีเรียน -->
              <td
                v-else
                :colspan="cell.span"
                class="border-r border-slate-200 p-2 align-middle h-24 bg-slate-50/20"
              >
                <div class="h-full flex items-center justify-center text-slate-300 text-xs font-mono">
                  -
                </div>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ส่วนท้ายตาราง: สรุปวิชาในตาราง ดีไซน์เป็นการ์ดสะอาดตา -->
    <div v-if="subjectSummary.length > 0" class="p-4 sm:p-5 bg-slate-50/60 border-t border-slate-200 text-xs">
      <div class="font-bold text-slate-700 mb-3 flex items-center gap-2">
        <v-icon icon="mdi-book-open-page-variant-outline" size="16" class="text-blue-600" />
        <span>สรุปรายวิชาในตารางเรียน ({{ subjectSummary.length }} วิชา รวม {{ totalScheduledPeriods }} คาบ):</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
        <div
          v-for="sub in subjectSummary"
          :key="sub.subject_id"
          class="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs hover:shadow-sm transition-shadow flex flex-col justify-between"
        >
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                {{ sub.subject_code || '-' }}
              </span>
              <span class="font-bold font-mono text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {{ sub.count }} คาบ
              </span>
            </div>
            <div class="text-slate-800 font-semibold text-xs leading-snug line-clamp-2" :title="sub.subject_name">
              {{ sub.subject_name }}
            </div>
          </div>
          <div class="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span class="truncate">{{ type === 'class' ? (formatTeacherName(sub.teacher_name) || 'ครูผู้สอน') : (sub.class_name || 'ชั้นเรียน') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  type: {
    type: String,
    default: 'class' // 'class' หรือ 'teacher'
  },
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  schedules: {
    type: Array,
    default: () => []
  },
  periodsPerDay: {
    type: Number,
    default: 8
  },
  totalPeriods: {
    type: Number,
    default: 40
  }
})

// ข้อมูล 5 วันในสัปดาห์
const days = [
  { name: 'วันจันทร์', color: '#eab308' },
  { name: 'วันอังคาร', color: '#ec4899' },
  { name: 'วันพุธ', color: '#22c55e' },
  { name: 'วันพฤหัสบดี', color: '#f97316' },
  { name: 'วันศุกร์', color: '#3b82f6' },
]

// แถบเวลาของแต่ละคาบเรียน
const periodTimes = [
  { period: 1, periodDisplay: '1', slotIndex: 1, label: '08:00 - 09:00', isLunch: false },
  { period: 2, periodDisplay: '2', slotIndex: 2, label: '09:00 - 10:00', isLunch: false },
  { period: 3, periodDisplay: '3', slotIndex: 3, label: '10:00 - 11:00', isLunch: false },
  { period: 4, periodDisplay: '4', slotIndex: 4, label: '11:00 - 12:00', isLunch: false },
  { period: 'lunch', periodDisplay: 'พัก', slotIndex: null, label: '12:00 - 13:00', isLunch: true },
  { period: 5, periodDisplay: '5', slotIndex: 5, label: '13:00 - 14:00', isLunch: false },
  { period: 6, periodDisplay: '6', slotIndex: 6, label: '14:00 - 15:00', isLunch: false },
  { period: 7, periodDisplay: '7', slotIndex: 7, label: '15:00 - 16:00', isLunch: false },
  { period: 8, periodDisplay: '8', slotIndex: 8, label: '16:00 - 17:00', isLunch: false },
]

// แปลงชื่อห้องให้กระชับ
function formatRoomName(rawName) {
  if (!rawName) return 'ไม่ระบุห้อง'
  const match = rawName.match(/^(R\d+)/i)
  return match ? match[1] : rawName
}

// แปลงชื่อครูให้กระชับ
function formatTeacherName(rawName) {
  if (!rawName) return '-'
  return rawName.replace(/^(นาย|นางสาว|นาง|อ\.|อาจารย์)/g, '').trim()
}

// ชุดโทนสีพาสเทลสวยงามสำหรับวิชาเรียน เพื่อให้อ่านง่ายไม่ลายตา
const SUBJECT_COLORS = [
  'bg-blue-50/90 border-blue-200 text-blue-900',
  'bg-indigo-50/90 border-indigo-200 text-indigo-900',
  'bg-violet-50/90 border-violet-200 text-violet-900',
  'bg-purple-50/90 border-purple-200 text-purple-900',
  'bg-teal-50/90 border-teal-200 text-teal-900',
  'bg-emerald-50/90 border-emerald-200 text-emerald-900',
  'bg-cyan-50/90 border-cyan-200 text-cyan-900',
  'bg-sky-50/90 border-sky-200 text-sky-900',
  'bg-amber-50/90 border-amber-200 text-amber-900',
  'bg-rose-50/90 border-rose-200 text-rose-900',
]

function getSubjectCardStyle(slot) {
  if (!slot?.subject_id) return 'bg-slate-50 border-slate-200 text-slate-800'
  const colorIdx = (slot.subject_id * 7) % SUBJECT_COLORS.length
  return `border ${SUBJECT_COLORS[colorIdx]}`
}

function getSlot(dayIndex, slotIndex) {
  if (!slotIndex) return null
  const globalPeriod = dayIndex * props.periodsPerDay + slotIndex
  return props.schedules.find(s => Number(s.period) === globalPeriod)
}

/**
 * รวมคาบเรียนที่ติดกันและเป็นวิชาเดียวกัน (Colspan Calculation)
 * แยกช่วงเช้า (คาบ 1-4) และช่วงบ่าย (คาบ 5-8) ไม่ให้ข้ามพักเที่ยง
 */
function getDayCells(dayIndex) {
  const morningSlots = [1, 2, 3, 4]
  const afternoonSlots = [5, 6, 7, 8]

  function mergeRange(slotsRange) {
    const cells = []
    let i = 0
    while (i < slotsRange.length) {
      const slotIndex = slotsRange[i]
      const currentSlot = getSlot(dayIndex, slotIndex)

      if (!currentSlot) {
        let span = 1
        while (
          i + span < slotsRange.length &&
          !getSlot(dayIndex, slotsRange[i + span])
        ) {
          span++
        }
        cells.push({
          key: `empty-${slotIndex}`,
          slot: null,
          span,
          isLunch: false
        })
        i += span
      } else {
        let span = 1
        while (
          i + span < slotsRange.length
        ) {
          const nextSlot = getSlot(dayIndex, slotsRange[i + span])
          if (
            nextSlot &&
            nextSlot.subject_id === currentSlot.subject_id &&
            nextSlot.teacher_id === currentSlot.teacher_id &&
            nextSlot.room_id === currentSlot.room_id
          ) {
            span++
          } else {
            break
          }
        }

        cells.push({
          key: `slot-${slotIndex}-${currentSlot.id}`,
          slot: currentSlot,
          span,
          isLunch: false
        })
        i += span
      }
    }
    return cells
  }

  const morningCells = mergeRange(morningSlots)
  const lunchCell = [{ key: 'lunch', slot: null, span: 1, isLunch: true }]
  const afternoonCells = mergeRange(afternoonSlots)

  return [...morningCells, ...lunchCell, ...afternoonCells]
}

const totalScheduledPeriods = computed(() => props.schedules.length)

const subjectSummary = computed(() => {
  const map = new Map()
  props.schedules.forEach(s => {
    const key = `${s.subject_id}_${props.type === 'class' ? s.teacher_id : s.class_id}`
    if (!map.has(key)) {
      map.set(key, {
        subject_id: s.subject_id,
        subject_code: s.subject_code,
        subject_name: s.subject_name,
        teacher_name: s.teacher_name,
        class_name: s.class_name,
        count: 0
      })
    }
    map.get(key).count++
  })
  return Array.from(map.values())
})

function printTable() {
  window.print()
}

function downloadCSV() {
  const headers = [
    'วัน',
    'คาบที่',
    'เวลา',
    'รหัสวิชา',
    'ชื่อวิชา',
    props.type === 'class' ? 'ผู้สอน' : 'ห้องเรียน/กลุ่มเรียน',
    'ห้องเรียน'
  ]

  const rows = []
  days.forEach((day, dayIndex) => {
    for (let p = 1; p <= props.periodsPerDay; p++) {
      const globalPeriod = dayIndex * props.periodsPerDay + p
      const slot = props.schedules.find(s => s.period === globalPeriod)
      const pTime = periodTimes.find(t => t.slotIndex === p)?.label || ''

      if (slot) {
        rows.push([
          day.name,
          `คาบ ${p}`,
          pTime,
          slot.subject_code || '',
          slot.subject_name || '',
          props.type === 'class' ? (slot.teacher_name || '') : (slot.class_name || ''),
          slot.room_name || ''
        ])
      } else {
        rows.push([
          day.name,
          `คาบ ${p}`,
          pTime,
          '-',
          '-',
          '-',
          '-'
        ])
      }
    }
  })

  // สร้างเนื้อหา CSV พร้อม BOM (\uFEFF) เพื่อรองรับภาษาไทยใน Microsoft Excel
  const csvContent = [
    headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\r\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const filename = `${props.title.replace(/[\\/:*?"<>|]/g, '_')}_ตารางสอน.csv`
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.timetable-sheet {
  font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.timetable-table {
  table-layout: fixed;
  width: 100%;
}

.timetable-table col {
  width: 10% !important;
}

.timetable-table th {
  border-color: #e2e8f0;
  width: 10% !important;
  max-width: 10% !important;
}

.timetable-table td {
  border-color: #e2e8f0;
}

@media print {
  .no-print {
    display: none !important;
  }
}
</style>
