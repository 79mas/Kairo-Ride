"use client";
import {toast} from "sonner";
import {formatDate, formatKm, wheelStatusLabels, type State, type Wheel} from "@/lib/kairo/domain";
import {effectiveWheelStatus, ltWheelStatusLabels, type VehicleReminder} from "@/lib/kairo/vehicle-status";
import {useI18n} from "@/lib/kairo/i18n";

export function VehicleStatusBadge({wheel, state}: {wheel: Wheel; state: State}) {
  const {language} = useI18n();
  if(wheel.archived)return <span className="vehicle-status vehicle-status-critical"><i aria-hidden="true"/>{language==="lt"?"Archyvuota":"Archived"}</span>;
  const status = effectiveWheelStatus(wheel, state);
  return <span className={`vehicle-status vehicle-status-${status}`}><i aria-hidden="true"/>{language === "lt" ? ltWheelStatusLabels[status] : wheelStatusLabels[status]}</span>;
}

type ReminderCopy = {tr: (en: string, lt: string) => string; locale: string};

export function VehicleReminderList({reminders, tr, locale}: {reminders: VehicleReminder[]} & ReminderCopy) {
  return <div className="vehicle-reminder-list">{reminders.map(({wheel, tasks, note}) => <div key={wheel.id} className="vehicle-reminder-item">
    <strong>{wheel.name}</strong>
    {note && <p className="preserve-lines">{note}</p>}
    {tasks.length > 0 && <ul>{tasks.map(task => <li key={task.id}><span>{task.title}</span>
      {(task.dueDate || task.dueOdometerKm !== null) && <small>
        {task.dueDate && `${tr("Due", "Terminas")}: ${formatDate(task.dueDate, false, undefined, locale)}`}
        {task.dueDate && task.dueOdometerKm !== null && " · "}
        {task.dueOdometerKm !== null && `${tr("Odometer", "Odometras")}: ${formatKm(task.dueOdometerKm, locale)} km`}
      </small>}
    </li>)}</ul>}
    {!note && !tasks.length && <p>{tr("Maintenance attention is flagged. Review this vehicle's tasks in Garage → Maintenance.", "Pažymėta, kad reikia priežiūros. Peržiūrėk priemonės užduotis: Garažas → Priežiūra.")}</p>}
  </div>)}</div>;
}

/** Event-driven rather than daily-deduplicated: every garage visit/new-record
 * selection presents the reminder again, independently of OS notification settings. */
export function notifyVehicleMaintenance(reminders: VehicleReminder[], copy: ReminderCopy, context: "garage" | "record") {
  const id = `kairo-vehicle-maintenance-${context}`;
  if (!reminders.length) { toast.dismiss(id); return; }
  toast.warning(copy.tr("Active! — maintenance reminder", "Aktyvus! — priežiūros priminimas"), {
    id, description: <VehicleReminderList reminders={reminders} {...copy}/>, duration: 15000, closeButton: true,
  });
}
