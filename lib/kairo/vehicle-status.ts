import {canRecordWithWheel, storedWheelStatus, type Maintenance, type State, type Wheel, type WheelStatus} from "./domain";
import {maintenanceStatus} from "./stats";

export const ltWheelStatusLabels: Record<WheelStatus, string> = {
  active: "Aktyvus", attention: "Aktyvus!", critical: "Sugedęs", in_repair: "Remontuojamas", spare: "Atsarginis", sold: "Parduotas",
};

export type VehicleReminder = {wheel: Wheel; tasks: Maintenance[]; note: string};

/** Scheduled checks warn when due/overdue, not merely because a future task exists.
 * A manually flagged vehicle additionally shows all of its open maintenance tasks.
 * Inactive vehicles never become rideable just because they have a reminder. */
export function vehicleReminder(wheel: Wheel, state: State, now = new Date()): VehicleReminder | null {
  if (!canRecordWithWheel(wheel)) return null;
  const manual = storedWheelStatus(wheel) === "attention";
  const pending = state.maintenance.filter(item => item.targetKind === "wheel" && item.targetId === wheel.id && !item.completedAt);
  const rank = {overdue: 0, due: 1, upcoming: 2, planned: 3, completed: 4};
  const tasks = pending.filter(item => manual || ["due", "overdue"].includes(maintenanceStatus(item, state, now)))
    .sort((a, b) => rank[maintenanceStatus(a, state, now)] - rank[maintenanceStatus(b, state, now)] || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.title.localeCompare(b.title));
  return manual || tasks.length ? {wheel, tasks, note: manual ? wheel.statusNote?.trim() ?? "" : ""} : null;
}

export function effectiveWheelStatus(wheel: Wheel, state: State, now = new Date()): WheelStatus {
  return vehicleReminder(wheel, state, now) ? "attention" : storedWheelStatus(wheel);
}

export function garageReminders(state: State, now = new Date()): VehicleReminder[] {
  return state.wheel.flatMap(wheel => { const reminder = vehicleReminder(wheel, state, now); return reminder ? [reminder] : []; });
}
