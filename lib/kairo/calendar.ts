import {appPath} from "./paths";

export const DATE_FORMATS = ["yyyy/mm/dd", "dd/mm/yyyy", "dd.mm.yyyy", "mm/dd/yyyy", "yyyy-mm-dd"] as const;
export type DateFormat = typeof DATE_FORMATS[number];
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type CalendarPreferences = {dateFormat: DateFormat; weekStartsOn: WeekStart};
export const DEFAULT_CALENDAR: CalendarPreferences = {dateFormat: "yyyy/mm/dd", weekStartsOn: 1};
export const calendarPreferenceKey = () => `kairo-calendar@${appPath()}`;
let memoryPreferences = {...DEFAULT_CALENDAR};

export function readCalendarPreferences(): CalendarPreferences {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(calendarPreferenceKey());
    if (!raw) return {...memoryPreferences};
    const value = JSON.parse(raw);
    return {
      dateFormat: DATE_FORMATS.includes(value.dateFormat) ? value.dateFormat : DEFAULT_CALENDAR.dateFormat,
      weekStartsOn: Number.isInteger(value.weekStartsOn) && value.weekStartsOn >= 0 && value.weekStartsOn <= 6 ? value.weekStartsOn : 1,
    };
  } catch { return {...memoryPreferences}; }
}
export function saveCalendarPreferences(value: CalendarPreferences) {
  memoryPreferences = {...value};
  try { localStorage.setItem(calendarPreferenceKey(), JSON.stringify(value)); } catch { /* Still usable in this window. */ }
}
export function validDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}
export function formatDateKey(value: string, format: DateFormat = readCalendarPreferences().dateFormat): string {
  if (!validDateKey(value)) return "";
  const [year, month, day] = value.split("-");
  return format.replace("yyyy", year).replace("mm", month).replace("dd", day);
}
export function parseDateText(value: string, format: DateFormat): string | null {
  const parts = format.match(/yyyy|mm|dd/g)!;
  const separator = format.includes(".") ? "." : format.includes("-") ? "-" : "/";
  const input = value.trim().split(separator);
  if (input.length !== 3 || input.some((part, index) => !new RegExp(`^\\d{${parts[index] === "yyyy" ? 4 : 2}}$`).test(part))) return null;
  const values = Object.fromEntries(parts.map((part, index) => [part, input[index]]));
  const key = `${values.yyyy}-${values.mm}-${values.dd}`;
  return validDateKey(key) ? key : null;
}
export function formatMonthKey(value: string, format: DateFormat = readCalendarPreferences().dateFormat): string {
  const [year, month] = value.split("-");
  if (!year || !month || !validDateKey(`${year}-${month}-01`)) return value;
  const separator = format.includes(".") ? "." : format.includes("-") ? "-" : "/";
  return format.startsWith("yyyy") ? `${year}${separator}${month}` : `${month}${separator}${year}`;
}
export function displayDate(value: string, time = false, timeZone?: string, locale = "en-US", format: DateFormat = readCalendarPreferences().dateFormat): string {
  if (validDateKey(value)) return formatDateKey(value, format);
  const date = new Date(value);
  if (!Number.isFinite(+date)) return "—";
  const parts = Object.fromEntries(new Intl.DateTimeFormat(locale, {
    calendar: "gregory", numberingSystem: "latn", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", ...(timeZone ? {timeZone} : {}),
  }).formatToParts(date).map(part => [part.type, part.value]));
  const formatted = formatDateKey(`${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`, format);
  return time ? `${formatted} ${parts.hour}:${parts.minute}` : formatted;
}
export function shiftDateKey(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function calendarDayNumber(value: string): number { return Date.parse(`${value}T12:00:00Z`) / 86_400_000; }
export function calendarMonthDays(month: string, weekStartsOn: WeekStart): (string | null)[] {
  const first = `${month}-01`;
  if (!validDateKey(first)) return [];
  const date = new Date(`${first}T12:00:00Z`);
  const offset = (date.getUTCDay() - weekStartsOn + 7) % 7;
  const next = new Date(date); next.setUTCMonth(next.getUTCMonth() + 1); next.setUTCDate(0);
  return [...Array.from({length: offset}, () => null), ...Array.from({length: next.getUTCDate()}, (_, index) => shiftDateKey(first, index))];
}
