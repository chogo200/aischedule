import { describe, it, expect } from 'vitest';
import { generateSchedule, validateSchedule } from '../services/scheduler/scheduler.js';

describe('Scheduler Service', () => {
  it('should schedule lessons without teacher or room conflict', () => {
    const classes = [
      {
        id: 1,
        name: 'Class 1',
        subjects: [{ subject_id: 101, hours: 3, subject_name: 'Math' }]
      },
      {
        id: 2,
        name: 'Class 2',
        subjects: [{ subject_id: 101, hours: 2, subject_name: 'Math' }]
      }
    ];

    const teachers = [
      { id: 10, name: 'Teacher 1' }
    ];

    const rooms = [
      { id: 20, name: 'Room 101' }
    ];

    // Single teacher and single room for two classes.
    // They must NEVER be scheduled in the same period!
    const result = generateSchedule({
      classes,
      teachers,
      rooms,
      totalPeriods: 40,
      periodsPerDay: 8,
    });

    expect(result.totalPlaced).toBe(5);
    expect(result.unplacedLessons.length).toBe(0);

    // Verify no overlap
    const p1Slots = result.scheduledSlots.filter(s => s.class_id === 1).map(s => s.period);
    const p2Slots = result.scheduledSlots.filter(s => s.class_id === 2).map(s => s.period);

    // Intersection must be empty
    const overlap = p1Slots.filter(p => p2Slots.includes(p));
    expect(overlap.length).toBe(0);

    // Double check validator
    const val = validateSchedule(result.scheduledSlots);
    expect(val.valid).toBe(true);
  });

  it('should prioritize teachers and rooms with higher expert score', () => {
    const classes = [
      {
        id: 1,
        name: 'Class 1',
        subjects: [{ subject_id: 50, hours: 2, subject_name: 'Coding' }]
      }
    ];

    const teachers = [
      { id: 1, name: 'Novice' },
      { id: 2, name: 'Master' }
    ];

    const rooms = [
      { id: 10, name: 'Basic Room' },
      { id: 20, name: 'Pro Lab' }
    ];

    const teacherExperts = [
      { teacher_id: 2, subject_id: 50, score: 95 },
      { teacher_id: 1, subject_id: 50, score: 20 },
    ];

    const roomExperts = [
      { room_id: 20, subject_id: 50, expert: 5 },
      { room_id: 10, subject_id: 50, expert: 1 },
    ];

    const result = generateSchedule({
      classes,
      teachers,
      rooms,
      teacherExperts,
      roomExperts,
      totalPeriods: 40,
      periodsPerDay: 8,
    });

    expect(result.totalPlaced).toBe(2);
    // Both slots should be taught by Master (id: 2) in Pro Lab (id: 20)
    for (const slot of result.scheduledSlots) {
      expect(slot.teacher_id).toBe(2);
      expect(slot.room_id).toBe(20);
    }
  });

  it('should validate conflicts correctly', () => {
    const conflictedSlots = [
      { period: 1, class_id: 1, teacher_id: 1, room_id: 1 },
      { period: 1, class_id: 2, teacher_id: 1, room_id: 2 }, // Teacher 1 double-booked
    ];

    const val = validateSchedule(conflictedSlots);
    expect(val.valid).toBe(false);
    expect(val.errors.length).toBeGreaterThan(0);
  });
});

