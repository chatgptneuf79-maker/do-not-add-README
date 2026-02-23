export type NavMode = "guided" | "locked" | "free";

export type StudentNavSettings = {
  nav_mode: NavMode;
  remedial_rule: "off" | "on";
};

export const SETTINGS_PREFIX = "slp.student.settings.v1."; // + initials

export function loadStudentSettings(initials: string): StudentNavSettings {
  const key = SETTINGS_PREFIX + initials.trim().toUpperCase();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { nav_mode: "guided", remedial_rule: "on" };
    const obj = JSON.parse(raw) as Partial<StudentNavSettings>;
    const nav_mode = (obj.nav_mode === "locked" || obj.nav_mode === "free" || obj.nav_mode === "guided") ? obj.nav_mode : "guided";
    const remedial_rule = (obj.remedial_rule === "off" || obj.remedial_rule === "on") ? obj.remedial_rule : "on";
    return { nav_mode, remedial_rule };
  } catch {
    return { nav_mode: "guided", remedial_rule: "on" };
  }
}

export function saveStudentSettings(initials: string, settings: StudentNavSettings): void {
  const key = SETTINGS_PREFIX + initials.trim().toUpperCase();
  localStorage.setItem(key, JSON.stringify(settings));
}
