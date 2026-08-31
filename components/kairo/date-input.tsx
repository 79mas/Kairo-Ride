"use client";
import {useEffect, useRef, useState} from "react";
import {CalendarDays, ChevronLeft, ChevronRight} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {calendarMonthDays, formatDateKey, formatMonthKey, parseDateText, validDateKey} from "@/lib/kairo/calendar";
import {today} from "@/lib/kairo/domain";
import {useI18n} from "@/lib/kairo/i18n";

type DateInputProps = {
  value: string; onValueChange: (value: string) => void; "aria-label": string;
  required?: boolean; disabled?: boolean; min?: string; max?: string;
};

/** Canonical YYYY-MM-DD storage with an explicitly chosen visible format.
 * A native date input cannot enforce its display format across phone/browser locales. */
export function DateInput({value, onValueChange, required, disabled, min, max, "aria-label": label}: DateInputProps) {
  const {dateFormat, weekStartsOn, locale, tr} = useI18n();
  const [edit, setEdit] = useState(() => ({source: value, format: dateFormat, draft: formatDateKey(value, dateFormat)}));
  const draft = edit.source === value && edit.format === dateFormat ? edit.draft : formatDateKey(value, dateFormat);
  const setDraft = (next: string, source = value) => setEdit({source, format: dateFormat, draft: next});
  const [month, setMonth] = useState(() => (validDateKey(value) ? value : today()).slice(0, 7));
  const input = useRef<HTMLInputElement>(null);
  const calendar = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const key = parseDateText(draft, dateFormat);
    const valid = !draft.trim() || !!key && (!min || key >= min) && (!max || key <= max);
    input.current?.setCustomValidity(valid ? "" : `${tr("Enter a valid date in this format", "Įvesk teisingą datą šiuo formatu")}: ${dateFormat}${min ? ` · ≥ ${formatDateKey(min, dateFormat)}` : ""}${max ? ` · ≤ ${formatDateKey(max, dateFormat)}` : ""}`);
  }, [draft, dateFormat, min, max, tr]);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (calendar.current && !calendar.current.contains(event.target as Node)) calendar.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  const inRange = (key: string) => (!min || key >= min) && (!max || key <= max);
  function accept(key: string) {
    setDraft(formatDateKey(key, dateFormat), key);
    input.current?.setCustomValidity("");
    onValueChange(key);
    if (calendar.current) calendar.current.open = false;
    input.current?.focus();
  }
  function moveMonth(offset: number) {
    const date = new Date(`${month}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + offset);
    if (date.getUTCFullYear() >= 1 && date.getUTCFullYear() <= 9999) setMonth(date.toISOString().slice(0, 7));
  }
  const weekdays = Array.from({length: 7}, (_, index) => new Intl.DateTimeFormat(locale, {weekday: "short", timeZone: "UTC"})
    .format(new Date(Date.UTC(2024, 0, 7 + (weekStartsOn + index) % 7))));
  return <div className="date-input">
    <Input ref={input} aria-label={label} type="text" inputMode="text" autoComplete="off"
      placeholder={dateFormat} required={required} disabled={disabled} value={draft}
      onChange={event => {
        const next = event.target.value;
        const key = parseDateText(next, dateFormat);
        const valid = !next.trim() || !!key && inRange(key);
        setDraft(next, !next.trim() ? "" : key && inRange(key) ? key : value);
        event.target.setCustomValidity(valid ? "" : `${tr("Enter a valid date in this format", "Įvesk teisingą datą šiuo formatu")}: ${dateFormat}${min ? ` · ≥ ${formatDateKey(min, dateFormat)}` : ""}${max ? ` · ≤ ${formatDateKey(max, dateFormat)}` : ""}`);
        if (!next.trim()) onValueChange("");
        else if (key && inRange(key)) onValueChange(key);
      }}
      onBlur={() => { const key = parseDateText(draft, dateFormat); if (key && inRange(key)) setDraft(formatDateKey(key, dateFormat)); }}/>
    <details className="date-picker" ref={calendar} onKeyDown={event => {if (event.key === "Escape" && calendar.current) {calendar.current.open = false; input.current?.focus();}}}>
      <summary aria-label={tr("Open calendar", "Atidaryti kalendorių")} aria-disabled={disabled}
        onClick={event => {if (disabled) event.preventDefault();else if (!calendar.current?.open) setMonth((validDateKey(value) ? value : today()).slice(0, 7));}}><CalendarDays/></summary>
      <div className="calendar-menu" role="group" aria-label={label}>
        <div className="calendar-heading">
          <Button size="icon" variant="ghost" type="button" aria-label={tr("Previous month", "Ankstesnis mėnuo")} onClick={() => moveMonth(-1)}><ChevronLeft/></Button>
          <strong aria-live="polite">{formatMonthKey(month, dateFormat)}</strong>
          <Button size="icon" variant="ghost" type="button" aria-label={tr("Next month", "Kitas mėnuo")} onClick={() => moveMonth(1)}><ChevronRight/></Button>
        </div>
        <div className="calendar-grid">
          {weekdays.map((day, index) => <span className="calendar-weekday" key={index}>{day}</span>)}
          {calendarMonthDays(month, weekStartsOn).map((day, index) => day
            ? <button type="button" key={day} disabled={disabled || !inRange(day)} aria-label={formatDateKey(day, dateFormat)}
                aria-pressed={day === value} aria-current={day === today() ? "date" : undefined} onClick={() => accept(day)}>{Number(day.slice(-2))}</button>
            : <span key={`empty-${index}`}/>)}
        </div>
        <div className="calendar-actions">
          <Button type="button" variant="ghost" size="sm" disabled={disabled || !inRange(today())} onClick={() => accept(today())}>{tr("Today", "Šiandien")}</Button>
          {!required && <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => accept("")}>{tr("Clear", "Išvalyti")}</Button>}
        </div>
      </div>
    </details>
  </div>;
}

export function DateTimeInput({value, onValueChange, required, disabled, "aria-label": label}: Omit<DateInputProps, "min" | "max">) {
  const {tr} = useI18n();
  const [edit, setEdit] = useState({source: value, date: value.slice(0, 10), time: value.slice(11, 16)});
  const {date, time} = edit.source === value ? edit : {date: value.slice(0, 10), time: value.slice(11, 16)};
  function change(nextDate: string, nextTime: string) {
    const next = nextDate && nextTime ? `${nextDate}T${nextTime}` : "";
    setEdit({source: next, date: nextDate, time: nextTime});
    onValueChange(next);
  }
  return <div className="date-time-input">
    <DateInput aria-label={label} value={date} onValueChange={next => change(next, time)} required={required} disabled={disabled}/>
    <Input type="time" aria-label={tr("Time", "Laikas")} value={time} required={required} disabled={disabled} onChange={event => change(date, event.target.value)}/>
  </div>;
}
