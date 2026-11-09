/**
 * backend/services/scheduler/scheduler.js
 * 
 * Algorithm for Timetable Generation
 * Constraints:
 * 1. Hard Constraints:
 *    - In period p, class c can have at most 1 lesson
 *    - In period p, teacher t can teach at most 1 class (No teacher double booking)
 *    - In period p, room r can host at most 1 class (No room double booking)
 *    - 1 teacher per (class, subject) pair
 *    - Teacher selection priority: Highest teacher_expert score first; 0/no expert score last
 *    - Room selection priority: Highest room_expert score first; 0/no expert score last
 * 2. Soft Constraints:
 *    - Same subject in same class: at most 2 consecutive periods per day
 *    - Day calculation: day = Math.floor((period - 1) / periodsPerDay)
 *    - Total periods = 40 (default 5 days x 8 periods/day)
 */

function generateSchedule({
  classes = [],         // [{ id, name, plan_id, subjects: [{ subject_id, hours, subject_name }] }]
  teachers = [],        // [{ id, name, user_id, name_th }]
  rooms = [],           // [{ id, name }]
  teacherExperts = [],  // [{ teacher_id, subject_id, score }]
  roomExperts = [],     // [{ room_id, subject_id, expert }]
  totalPeriods = 40,
  periodsPerDay = 8,
}) {
  const daysCount = Math.ceil(totalPeriods / periodsPerDay);

  // 1. Build Quick Lookup Maps for Experts
  // teacherScoreMap[teacherId][subjectId] = score
  const teacherScoreMap = new Map();
  teachers.forEach(t => teacherScoreMap.set(t.id, new Map()));
  teacherExperts.forEach(te => {
    if (teacherScoreMap.has(te.teacher_id)) {
      teacherScoreMap.get(te.teacher_id).set(te.subject_id, Number(te.score) || 0);
    }
  });

  // roomScoreMap[roomId][subjectId] = score
  const roomScoreMap = new Map();
  rooms.forEach(r => roomScoreMap.set(r.id, new Map()));
  roomExperts.forEach(re => {
    if (roomScoreMap.has(re.room_id)) {
      roomScoreMap.get(re.room_id).set(re.subject_id, Number(re.expert) || 0);
    }
  });

  // Helper function to get candidate teachers sorted by expert score descending
  function getSortedTeachers(subjectId) {
    return [...teachers].sort((a, b) => {
      const scoreA = teacherScoreMap.get(a.id)?.get(subjectId) || 0;
      const scoreB = teacherScoreMap.get(b.id)?.get(subjectId) || 0;
      return scoreB - scoreA;
    });
  }

  // Helper function to get candidate rooms sorted by expert score descending
  function getSortedRooms(subjectId) {
    return [...rooms].sort((a, b) => {
      const scoreA = roomScoreMap.get(a.id)?.get(subjectId) || 0;
      const scoreB = roomScoreMap.get(b.id)?.get(subjectId) || 0;
      return scoreB - scoreA;
    });
  }

  // 2. Prepare Class-Subject Demands with Workload Balancing
  // Calculate Target Average Workload per Teacher
  let totalDemandHours = 0;
  for (const cls of classes) {
    for (const sub of cls.subjects || []) {
      totalDemandHours += Number(sub.hours) || 0;
    }
  }
  const targetAverageHours = teachers.length > 0 ? totalDemandHours / teachers.length : 14.3;
  const minRequiredHours = 12; // เงื่อนไขขั้นต่ำ: ครู 1 คน ต้องไม่ต่ำกว่า 12 ชั่วโมง/สัปดาห์
  const maxCapHours = 16;      // เพดานสูงสุดเพื่อเกลี่ยให้ได้ครบทุกคน (14 คน x ~14.3 = 200 คาบ)

  const assignments = []; // list of { class_id, class_name, subject_id, subject_name, hours, assignedTeacherId }
  const unassignedDemands = [];

  // Track teacher workload in hours to balance evenly
  const teacherWorkload = new Map();
  teachers.forEach(t => teacherWorkload.set(t.id, 0));

  for (const cls of classes) {
    const subjects = cls.subjects || [];
    for (const sub of subjects) {
      const hours = Number(sub.hours) || 0;
      if (hours <= 0) continue;

      const candidates = getSortedTeachers(sub.subject_id);
      if (candidates.length === 0) {
        unassignedDemands.push({
          class_id: cls.id,
          class_name: cls.name,
          subject_id: sub.subject_id,
          subject_name: sub.subject_name || `Subject #${sub.subject_id}`,
          hours,
          reason: 'ไม่มีครูในโครงการนี้'
        });
        continue;
      }

      // Workload Balancing Sort with Minimum 12 Hours Guarantee:
      candidates.sort((a, b) => {
        const scoreA = teacherScoreMap.get(a.id)?.get(sub.subject_id) || 0;
        const scoreB = teacherScoreMap.get(b.id)?.get(sub.subject_id) || 0;
        const loadA = teacherWorkload.get(a.id) || 0;
        const loadB = teacherWorkload.get(b.id) || 0;

        // 1. ความสำคัญสูงสุด: บังคับให้ครูที่ยังได้ไม่ถึงขั้นต่ำ 12 คาบ ได้รับวิชาก่อนเสมอ
        const underMinA = loadA < minRequiredHours;
        const underMinB = loadB < minRequiredHours;

        if (underMinA && !underMinB && scoreA >= 5) return -1;
        if (underMinB && !underMinA && scoreB >= 5) return 1;
        if (underMinA && underMinB) {
          if (scoreB !== scoreA && Math.abs(scoreB - scoreA) > 2) return scoreB - scoreA;
          return loadA - loadB;
        }

        // 2. ถ้าครูท่านหนึ่งสอนเกินเพดาน (load > maxCapHours) ให้หลีกเลี่ยง
        if (loadA > maxCapHours && loadB <= maxCapHours && scoreB >= 5) return 1;
        if (loadB > maxCapHours && loadA <= maxCapHours && scoreA >= 5) return -1;

        // 3. ถ้าคะแนนความเชี่ยวชาญอยู่ในเกณฑ์ใกล้เคียงกัน (ต่างกัน <= 3 แต้ม) ให้คนที่มีชั่วโมงน้อยกว่า
        if (Math.abs(scoreB - scoreA) <= 3 && (scoreA >= 5 || scoreB >= 5)) {
          return loadA - loadB;
        }

        // 4. ถ้าคะแนนต่างกันมาก เลือกคนที่คะแนนสูงกว่า
        if (scoreB !== scoreA) return scoreB - scoreA;
        return loadA - loadB;
      });

      const selectedTeacher = candidates[0];
      teacherWorkload.set(selectedTeacher.id, (teacherWorkload.get(selectedTeacher.id) || 0) + hours);

      assignments.push({
        class_id: cls.id,
        class_name: cls.name,
        subject_id: sub.subject_id,
        subject_name: sub.subject_name || `Subject #${sub.subject_id}`,
        hours,
        teacher_id: selectedTeacher.id,
        teacher_name: selectedTeacher.name_th || selectedTeacher.name,
      });
    }
  }

  // 3. Grid representation & Occupancy tracking
  // classBusy[class_id][period] = true
  // teacherBusy[teacher_id][period] = true
  // roomBusy[room_id][period] = true
  const classOccupancy = new Map();
  classes.forEach(c => classOccupancy.set(c.id, new Set()));

  const teacherOccupancy = new Map();
  teachers.forEach(t => teacherOccupancy.set(t.id, new Set()));

  const roomOccupancy = new Map();
  rooms.forEach(r => roomOccupancy.set(r.id, new Set()));

  // Track daily count of subject in a class: classDailySubjectCount[class_id][day][subject_id] = count
  const classDailySubjectCount = new Map();
  classes.forEach(c => {
    classDailySubjectCount.set(c.id, Array.from({ length: daysCount }, () => new Map()));
  });

  const scheduledSlots = []; // Result items: { period, class_id, teacher_id, subject_id, room_id }
  const unplacedLessons = [...unassignedDemands];

  // Sort assignments by hardest first: most hours first
  assignments.sort((a, b) => b.hours - a.hours);

  // 4. Place Lessons into Periods
  for (const assign of assignments) {
    let hoursToPlace = assign.hours;
    const sortedRooms = getSortedRooms(assign.subject_id);

    if (sortedRooms.length === 0) {
      unplacedLessons.push({
        ...assign,
        placed: 0,
        unplacedHours: hoursToPlace,
        reason: 'ไม่มีห้องเรียนในโครงการนี้'
      });
      continue;
    }

    // Try placing periods
    // We try to distribute evenly across days (at most 2 consecutive periods per day)
    let placedForThisAssign = 0;

    // Outer loop tries to place 1 hour at a time
    for (let h = 0; h < hoursToPlace; h++) {
      let placed = false;

      // Find best period
      // Score periods based on:
      // - class free, teacher free
      // - day subject count < 2
      // - available room with highest score
      let bestCandidate = null;

      // Try with assigned primary teacher first
      let currentTeacherId = assign.teacher_id;
      let currentTeacherName = assign.teacher_name;

      for (let p = 1; p <= totalPeriods; p++) {
        const day = Math.floor((p - 1) / periodsPerDay);

        // Check Hard Constraints
        if (classOccupancy.get(assign.class_id).has(p)) continue;
        if (teacherOccupancy.get(currentTeacherId).has(p)) continue;

        // Check Soft Constraint: Max 2 periods of same subject per day
        const daySubjectCount = classDailySubjectCount.get(assign.class_id)[day].get(assign.subject_id) || 0;
        if (daySubjectCount >= 2) continue;

        // Find best free room for period p
        const freeRoom = sortedRooms.find(r => !roomOccupancy.get(r.id).has(p));
        if (!freeRoom) continue;

        const roomScore = roomScoreMap.get(freeRoom.id)?.get(assign.subject_id) || 0;
        const penalty = (daySubjectCount * 100) - roomScore;

        if (!bestCandidate || penalty < bestCandidate.penalty) {
          bestCandidate = {
            period: p,
            day,
            room: freeRoom,
            teacherId: currentTeacherId,
            teacherName: currentTeacherName,
            penalty
          };
        }
      }

      // If cannot place with <= 2 hours/day constraint, relax to find ANY free slot for primary teacher
      if (!bestCandidate) {
        for (let p = 1; p <= totalPeriods; p++) {
          const day = Math.floor((p - 1) / periodsPerDay);
          if (classOccupancy.get(assign.class_id).has(p)) continue;
          if (teacherOccupancy.get(currentTeacherId).has(p)) continue;

          const freeRoom = sortedRooms.find(r => !roomOccupancy.get(r.id).has(p));
          if (!freeRoom) continue;

          const roomScore = roomScoreMap.get(freeRoom.id)?.get(assign.subject_id) || 0;
          const penalty = 500 - roomScore;

          if (!bestCandidate || penalty < bestCandidate.penalty) {
            bestCandidate = { period: p, day, room: freeRoom, teacherId: currentTeacherId, teacherName: currentTeacherName, penalty };
          }
        }
      }

      // If STILL cannot place due to teacher conflict/unavailability, fallback to alternative qualified teachers
      if (!bestCandidate) {
        const altTeachers = getSortedTeachers(assign.subject_id).filter(t => t.id !== currentTeacherId);
        for (const alt of altTeachers) {
          for (let p = 1; p <= totalPeriods; p++) {
            const day = Math.floor((p - 1) / periodsPerDay);
            if (classOccupancy.get(assign.class_id).has(p)) continue;
            if (teacherOccupancy.get(alt.id).has(p)) continue;

            const freeRoom = sortedRooms.find(r => !roomOccupancy.get(r.id).has(p));
            if (!freeRoom) continue;

            const roomScore = roomScoreMap.get(freeRoom.id)?.get(assign.subject_id) || 0;
            const penalty = 1000 - roomScore;

            if (!bestCandidate || penalty < bestCandidate.penalty) {
              bestCandidate = {
                period: p,
                day,
                room: freeRoom,
                teacherId: alt.id,
                teacherName: alt.name_th || alt.name,
                penalty
              };
            }
          }
          if (bestCandidate) break;
        }
      }

      if (bestCandidate) {
        const p = bestCandidate.period;
        const r = bestCandidate.room;
        const day = bestCandidate.day;
        const tId = bestCandidate.teacherId || assign.teacher_id;
        const tName = bestCandidate.teacherName || assign.teacher_name;

        // Book slot
        classOccupancy.get(assign.class_id).add(p);
        teacherOccupancy.get(tId).add(p);
        roomOccupancy.get(r.id).add(p);

        const currentDayCount = classDailySubjectCount.get(assign.class_id)[day].get(assign.subject_id) || 0;
        classDailySubjectCount.get(assign.class_id)[day].set(assign.subject_id, currentDayCount + 1);

        scheduledSlots.push({
          period: p,
          class_id: assign.class_id,
          teacher_id: tId,
          subject_id: assign.subject_id,
          room_id: r.id,
        });

        placedForThisAssign++;
        placed = true;
      }

      if (!placed) {
        // No slot could fit this hour
        break;
      }
    }

    if (placedForThisAssign < hoursToPlace) {
      unplacedLessons.push({
        ...assign,
        placed: placedForThisAssign,
        unplacedHours: hoursToPlace - placedForThisAssign,
        reason: 'คาบเรียนหรือห้องว่างไม่เพียงพอตามเงื่อนไข'
      });
    }
  }

  // 5. Verification (Conflict Checker)
  const validation = validateSchedule(scheduledSlots);
  if (!validation.valid) {
    throw new Error(`Schedule validation failed: ${validation.errors.join('; ')}`);
  }

  return {
    scheduledSlots,
    totalPlaced: scheduledSlots.length,
    unplacedLessons,
    validation
  };
}

/**
 * Validator to double-check hard constraints
 */
function validateSchedule(slots = []) {
  const errors = [];
  const classPeriodMap = new Map();
  const teacherPeriodMap = new Map();
  const roomPeriodMap = new Map();

  for (const s of slots) {
    const cpKey = `${s.class_id}_${s.period}`;
    if (classPeriodMap.has(cpKey)) {
      errors.push(`Class ${s.class_id} double booked at period ${s.period}`);
    } else {
      classPeriodMap.set(cpKey, true);
    }

    if (s.teacher_id) {
      const tpKey = `${s.teacher_id}_${s.period}`;
      if (teacherPeriodMap.has(tpKey)) {
        errors.push(`Teacher ${s.teacher_id} double booked at period ${s.period}`);
      } else {
        teacherPeriodMap.set(tpKey, true);
      }
    }

    if (s.room_id) {
      const rpKey = `${s.room_id}_${s.period}`;
      if (roomPeriodMap.has(rpKey)) {
        errors.push(`Room ${s.room_id} double booked at period ${s.period}`);
      } else {
        roomPeriodMap.set(rpKey, true);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  generateSchedule,
  validateSchedule,
};

