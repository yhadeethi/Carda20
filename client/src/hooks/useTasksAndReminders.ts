import { useState, useCallback, useMemo } from "react";
import { loadContactsV2 } from "@/lib/contacts/storage";
import type { ContactTask, ContactReminder } from "@/lib/contacts/types";

interface ContactInfo {
  id: string;
  fullName: string;
  companyName: string;
}

export interface TaskWithContact {
  task: ContactTask;
  contact: ContactInfo;
}

export interface ReminderWithContact {
  reminder: ContactReminder;
  contact: ContactInfo;
}

export interface UseTasksAndRemindersResult {
  overdueTasks: TaskWithContact[];
  todayTasks: TaskWithContact[];
  upcomingTasks: TaskWithContact[];      // next 7 days (exclusive of today)
  todayReminders: ReminderWithContact[];
  upcomingReminders: ReminderWithContact[]; // next 7 days (exclusive of today)
  totalDueCount: number;                  // overdue + today tasks + today reminders
  refresh: () => void;
}

function getDateBoundaries() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return { todayStart, todayEnd, weekEnd };
}

function computeData(): Omit<UseTasksAndRemindersResult, "refresh"> {
  const { todayStart, todayEnd, weekEnd } = getDateBoundaries();
  const todayStartMs = todayStart.getTime();
  const todayEndMs = todayEnd.getTime();
  const weekEndMs = weekEnd.getTime();

  const overdueTasks: TaskWithContact[] = [];
  const todayTasks: TaskWithContact[] = [];
  const upcomingTasks: TaskWithContact[] = [];
  const todayReminders: ReminderWithContact[] = [];
  const upcomingReminders: ReminderWithContact[] = [];

  try {
    const contacts = loadContactsV2();

    for (const contact of contacts) {
      const contactInfo: ContactInfo = {
        id: contact.id,
        fullName: contact.name || "Unknown",
        companyName: contact.company || "",
      };

      // Tasks: only incomplete tasks that have a dueAt date
      for (const task of contact.tasks ?? []) {
        if (task.done || !task.dueAt) continue;
        const dueMs = new Date(task.dueAt).getTime();
        if (isNaN(dueMs)) continue;

        if (dueMs < todayStartMs) {
          overdueTasks.push({ task, contact: contactInfo });
        } else if (dueMs <= todayEndMs) {
          todayTasks.push({ task, contact: contactInfo });
        } else if (dueMs <= weekEndMs) {
          upcomingTasks.push({ task, contact: contactInfo });
        }
      }

      // Reminders: all incomplete reminders
      for (const reminder of contact.reminders ?? []) {
        if (reminder.done) continue;
        const remindMs = new Date(reminder.remindAt).getTime();
        if (isNaN(remindMs)) continue;

        if (remindMs <= todayEndMs) {
          todayReminders.push({ reminder, contact: contactInfo });
        } else if (remindMs <= weekEndMs) {
          upcomingReminders.push({ reminder, contact: contactInfo });
        }
      }
    }
  } catch {
    // localStorage unavailable or parse error — return empty
  }

  // Sort all buckets by date ascending
  overdueTasks.sort((a, b) => new Date(a.task.dueAt!).getTime() - new Date(b.task.dueAt!).getTime());
  todayTasks.sort((a, b) => new Date(a.task.dueAt!).getTime() - new Date(b.task.dueAt!).getTime());
  upcomingTasks.sort((a, b) => new Date(a.task.dueAt!).getTime() - new Date(b.task.dueAt!).getTime());
  todayReminders.sort((a, b) => new Date(a.reminder.remindAt).getTime() - new Date(b.reminder.remindAt).getTime());
  upcomingReminders.sort((a, b) => new Date(a.reminder.remindAt).getTime() - new Date(b.reminder.remindAt).getTime());

  const totalDueCount = overdueTasks.length + todayTasks.length + todayReminders.length;

  return { overdueTasks, todayTasks, upcomingTasks, todayReminders, upcomingReminders, totalDueCount };
}

export function useTasksAndReminders(): UseTasksAndRemindersResult {
  const [tick, setTick] = useState(0);

  const data = useMemo(() => computeData(), [tick]);

  const refresh = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  return { ...data, refresh };
}
