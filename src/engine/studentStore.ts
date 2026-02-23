export const STUDENTS_KEY = "slp.students.v1";
export const SELECTED_STUDENT_KEY = "slp.student.selected.v1";

export type StudentInitials = string;

export function loadStudents(): StudentInitials[] {
  try {
    const raw = localStorage.getItem(STUDENTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.map(x => String(x)).filter(x => x.length > 0);
  } catch {
    return [];
  }
}

export function saveStudents(list: StudentInitials[]): void {
  const unique = Array.from(new Set(list.map(s => s.trim().toUpperCase()))).filter(Boolean);
  localStorage.setItem(STUDENTS_KEY, JSON.stringify(unique));
}

export function loadSelectedStudent(): StudentInitials | null {
  try {
    const raw = localStorage.getItem(SELECTED_STUDENT_KEY);
    if (!raw) return null;
    const v = String(raw).trim().toUpperCase();
    return v.length ? v : null;
  } catch {
    return null;
  }
}

export function saveSelectedStudent(initials: StudentInitials): void {
  localStorage.setItem(SELECTED_STUDENT_KEY, initials.trim().toUpperCase());
}

export function normalizeInitials(input: string): StudentInitials {
  return input.replace(/[^A-Za-z]/g, "").toUpperCase();
}


export const LAST_REPORT_EXPORT_PREFIX = "slp.report.last_export."; // + initials

export function loadLastReportExportIso(initials: string): string | null {
  try {
    const key = LAST_REPORT_EXPORT_PREFIX + initials.trim().toUpperCase();
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return String(raw);
  } catch {
    return null;
  }
}

export function saveLastReportExportIso(initials: string, iso: string): void {
  const key = LAST_REPORT_EXPORT_PREFIX + initials.trim().toUpperCase();
  localStorage.setItem(key, iso);
}
