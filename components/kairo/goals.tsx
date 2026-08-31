"use client";
import {useState, type FormEvent} from "react";
import {Check, Globe2, LoaderCircle, Plus, Target, Trash2} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Progress} from "@/components/ui/progress";
import {Field, Pick} from "./form-fields";
import {VehicleStatusBadge} from "./vehicle-status";
import {EARTH_EQUATOR_KM, earthProgress, forecastGoal} from "@/lib/kairo/goals";
import {formatDate, formatKm, type State} from "@/lib/kairo/domain";
import {useI18n} from "@/lib/kairo/i18n";
import {vehicleSelectOptions} from "@/lib/kairo/vehicle-status";
import {friendlyError} from "@/lib/kairo/storage";
import type {ViewActions} from "./views";

export function GoalForecasts({state, actions}: {state: State; actions?: ViewActions}) {
  const {tr, locale, language} = useI18n();
  const [scope, setScope] = useState("all"), [target, setTarget] = useState(""), [busy, setBusy] = useState(false);
  const chosenScope = scope === "all" || state.wheel.some(wheel => wheel.id === scope) ? scope : "all";
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !actions?.addGoal) return;
    const value = Number(target.trim().replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {toast.error(tr("Enter a target greater than zero.", "Įvesk tikslą, didesnį už nulį.")); return;}
    setBusy(true);
    try {await actions.addGoal(value, chosenScope === "all" ? null : chosenScope); setTarget("");}
    catch (error) {toast.error(friendlyError(error));}
    finally {setBusy(false);}
  }
  return <section className="goal-section panel">
    <div className="chart-heading"><div><p className="eyebrow">{tr("NEXT MILESTONES", "KITI TIKSLAI")}</p><h2><Target/>{tr("Distance goals", "Ridos tikslai")}</h2></div></div>
    <p className="field-hint">{tr("Choose a personal mileage target for all vehicles or just one. Targets use your tracked distance, excluding each vehicle’s baseline odometer.", "Pasirink asmeninį visų arba vienos priemonės ridos tikslą. Naudojama tavo užfiksuota rida, neįtraukiant pradinio odometro.")}</p>
    <form className="goal-form" onSubmit={event => void submit(event)}>
      <Field label={tr("Goal scope", "Kam taikomas tikslas")}><Pick label={tr("Goal scope", "Kam taikomas tikslas")} value={chosenScope} onChange={setScope}
        options={[{value: "all", label: tr("All vehicles", "Visos priemonės")}, ...vehicleSelectOptions(state, language)]}/></Field>
      <Field label={tr("Target distance, km", "Tikslinė rida, km")}><Input aria-label={tr("Target distance", "Tikslinė rida")} inputMode="decimal"
        required value={target} onChange={event => setTarget(event.target.value)} placeholder="10 000" maxLength={20}/></Field>
      <Button type="submit" disabled={busy || !actions?.addGoal}>{busy ? <LoaderCircle className="spin"/> : <Plus/>}{tr("Add goal", "Pridėti tikslą")}</Button>
    </form>
    {!!state.goal.length && <div className="goal-grid">{state.goal.map(goal => {
      const forecast = forecastGoal(state, goal), wheel = goal.wheelId ? state.wheel.find(item => item.id === goal.wheelId) : undefined;
      const scopeLabel = goal.wheelId ? wheel?.name ?? tr("Vehicle unavailable", "Priemonė nepasiekiama") : tr("All vehicles", "Visos priemonės");
      const status = forecast.status === "achieved" ? tr("Goal reached", "Tikslas pasiektas")
        : forecast.status === "inactive" ? tr("Forecast paused · vehicle inactive", "Prognozė sustabdyta · priemonė neaktyvi")
        : forecast.status === "invalid_history" ? tr("Review incomplete or inconsistent records", "Patikrink nepilnus arba prieštaringus įrašus")
        : forecast.status === "out_of_range" ? tr("Not enough recent distance for a useful date", "Per mažai naujausios ridos prasmingai datai")
        : tr("No distance recorded in the last 30 days", "Per paskutines 30 dienų rida neužfiksuota");
      return <article className="goal-card" key={goal.id}>
        <div className="section-heading"><strong>{scopeLabel}</strong><Button type="button" variant="ghost" size="icon"
          disabled={!actions} aria-label={`${tr("Delete goal", "Pašalinti tikslą")}: ${formatKm(goal.targetKm, locale)} km · ${scopeLabel}`}
          onClick={() => actions?.askDelete("goal", goal)}><Trash2/></Button></div>
        {wheel && <VehicleStatusBadge wheel={wheel} state={state}/>}
        <div className="goal-distance"><strong>{formatKm(goal.targetKm, locale)}</strong><span>km</span></div>
        <Progress value={Math.min(100, forecast.progressPercent)} aria-label={`${scopeLabel} · ${tr("Goal progress", "Tikslo progresas")}`}
          aria-valuetext={`${formatKm(forecast.currentKm, locale)} / ${formatKm(goal.targetKm, locale)} km`}/>
        <p className="goal-caption">{formatKm(forecast.currentKm, locale)} / {formatKm(goal.targetKm, locale)} km · {formatKm(forecast.progressPercent, locale)}%</p>
        <p className="goal-eta" aria-live="polite">{forecast.estimatedDate
          ? <><span>{tr("Estimated date", "Numatoma data")}</span><strong>{formatDate(forecast.estimatedDate, false, undefined, locale)}</strong></>
          : <span>{forecast.status === "achieved" && <Check/>}{status}</span>}</p>
        <p className="field-hint">{formatKm(forecast.averageKmPerDay, locale)} km/d · {tr("30-day rolling average", "30 dienų slenkantis vidurkis")}</p>
      </article>;
    })}</div>}
    <details className="forecast-explanation"><summary>{tr("How the forecast works", "Kaip skaičiuojama prognozė")}</summary>
      <p>{tr("Remaining kilometres ÷ average km/day from the last 30 calendar days, including today and zero-distance days. Sparse odometer intervals are spread evenly across their days; this is an estimate, not measured daily activity. Future-dated records are excluded. An inactive vehicle retains its progress but has no arrival date. There is no prediction without recent distance.", "Likę kilometrai ÷ paskutinių 30 kalendorinių dienų vidurkis, įskaitant šiandieną ir dienas be ridos. Reti odometro intervalai tolygiai paskirstomi jų dienoms; tai įvertis, ne išmatuota kiekvienos dienos veikla. Ateities įrašai neįtraukiami. Neaktyvios priemonės progresas išlieka, bet data neprognozuojama. Be naujausios ridos prognozės nėra.")}</p>
    </details>
  </section>;
}

export function EarthProgress({state}: {state: State}) {
  const {tr, locale} = useI18n(), progress = earthProgress(state);
  const percent = new Intl.NumberFormat(locale, {maximumFractionDigits: 2}).format(progress.percent);
  return <section className="earth-progress" aria-label={tr("Around the Earth", "Aplink Žemę")}>
    <div><span><Globe2/>{tr("Around the Earth", "Aplink Žemę")}</span><span>{formatKm(progress.totalKm, locale)} / {formatKm(EARTH_EQUATOR_KM, locale)} km <strong>{percent}%</strong></span></div>
    <Progress value={progress.barPercent} aria-label={tr("All-time distance as a share of the equator", "Visa rida kaip pusiaujo ilgio dalis")} aria-valuetext={`${percent}%`}/>
  </section>;
}
