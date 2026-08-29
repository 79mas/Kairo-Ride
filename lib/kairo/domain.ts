import { z } from "zod";

export const SCHEMA_VERSION = 1 as const;
export const KINDS = ["wheel", "reading", "ride", "trip", "gear", "attachment"] as const;
export type Kind = typeof KINDS[number];
const id = z.string().min(1).max(160).regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().max(20_000);
const name = z.string().trim().min(1, "Įrašyk pavadinimą.").max(160);
const km = z.number().finite().min(0).max(1_000_000_000);
const instant = z.string().datetime({ offset: true });
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T12:00:00Z`);
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === v;
}, "Netinkama data.");
const timeZone = z.string().max(100).refine(v=>{try{new Intl.DateTimeFormat("en",{timeZone:v});return true;}catch{return false;}},"Netinkama laiko juosta.");

export const wheelSchema = z.object({
  id, name, baselineKm: km, baselineDate: day,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/), notes: text,
}).strict();
export const readingSchema = z.object({
  id, wheelId: id, at: instant, odometerKm: km, notes: text,
  sourceOrder: z.number().int().nonnegative().optional(),
}).strict();
export const tripSchema = z.object({
  id, name, startDate: day, endDate: day, notes: text,
}).strict().refine(t => t.endDate >= t.startDate, "Kelionės pabaiga negali būti ankstesnė už pradžią.");
export const rideSchema = z.object({
  id, name, wheelId: id, tripId: id.nullable(), at: instant,
  distanceKm: km.nullable(), notes: text, localDate: day.optional(), timeZone: timeZone.optional(),
}).strict();
export const GEAR_CATEGORIES = ["helmet", "footwear", "protection", "gloves", "clothing", "camera", "intercom", "bag", "charging", "other"] as const;
export const GEAR_STATUSES = ["active", "spare", "retired"] as const;
export const gearCategoryLabels: Record<typeof GEAR_CATEGORIES[number], string> = {
  helmet: "Šalmai", footwear: "Avalynė", protection: "Apsaugos", gloves: "Pirštinės", clothing: "Apranga",
  camera: "Veiksmo kameros", intercom: "Ryšio įranga / Cardo", bag: "Kuprinės ir krepšiai", charging: "Įkrovikliai ir laidai", other: "Kiti priedai",
};
export const gearStatusLabels: Record<typeof GEAR_STATUSES[number], string> = { active: "Naudojama", spare: "Atsarginė", retired: "Nebenaudojama" };
export const gearSchema = z.object({
  id, name, category: z.enum(GEAR_CATEGORIES), status: z.enum(GEAR_STATUSES),
  brand: z.string().trim().max(160), model: z.string().trim().max(160), size: z.string().trim().max(60),
  purchasedOn: day.nullable(), notes: text,
}).strict();
export const attachmentSchema = z.object({
  id, ownerKind: z.enum(["ride", "trip"]), ownerId: id,
  name, mimeType: z.string().max(160), size: z.number().int().nonnegative().max(512 * 1024 * 1024),
  addedAt: instant, driveId: z.string().regex(/^[a-zA-Z0-9_-]{8,200}$/).optional(),
}).strict();
export type Wheel = z.infer<typeof wheelSchema>;
export type Reading = z.infer<typeof readingSchema>;
export type Trip = z.infer<typeof tripSchema>;
export type Ride = z.infer<typeof rideSchema>;
export type Gear = z.infer<typeof gearSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type Entity = Wheel | Reading | Trip | Ride | Gear | Attachment;
export type Entities = { wheel: Wheel; reading: Reading; trip: Trip; ride: Ride; gear: Gear; attachment: Attachment };
export const schemas = { wheel: wheelSchema, reading: readingSchema, trip: tripSchema, ride: rideSchema, gear: gearSchema, attachment: attachmentSchema };

export type Mutation = { kind: Kind; entityId: string; parents: string[]; value: Entity | null };
export type Operation = { version: 1; id: string; deviceId: string; createdAt: string; changes: Mutation[] };
export type Revision = { operationId: string; createdAt: string; deviceId: string; value: Entity | null };
export type Conflict = { kind: Kind; entityId: string; revisions: Revision[] };
export type State = {
  wheel: Wheel[]; reading: Reading[]; ride: Ride[]; trip: Trip[]; gear: Gear[]; attachment: Attachment[];
  heads: Map<string, Revision[]>; conflicts: Conflict[]; integrity: string[];
};
const operationSchema = z.object({
  version: z.literal(1), id, deviceId: id, createdAt: instant,
  changes: z.array(z.object({
    kind: z.enum(KINDS), entityId: id, parents: z.array(id).max(100), value: z.unknown(),
  }).strict()).min(1).max(20_000),
}).strict();

export function parseOperation(input: unknown): Operation {
  const op = operationSchema.parse(input);
  if (new TextEncoder().encode(JSON.stringify(op)).length > 8 * 1024 * 1024) throw new Error("Vienas pakeitimų paketas negali viršyti 8 MB. Importuok mažesnę kopiją.");
  const keys = new Set<string>();
  const changes = op.changes.map(c => {
    const key = entityKey(c.kind, c.entityId);
    if (keys.has(key) || c.parents.includes(op.id)) throw new Error("Netinkama pakeitimų istorija.");
    keys.add(key);
    const value = c.value === null ? null : schemas[c.kind].parse(c.value);
    if (value && value.id !== c.entityId) throw new Error("Nesutampa įrašo identifikatoriai.");
    return { ...c, parents: [...new Set(c.parents)], value };
  });
  return { ...op, changes };
}

export const entityKey = (kind: Kind, entityId: string) => `${kind}:${entityId}`;
export const uuid = () => crypto.randomUUID();
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b, "en")).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}

/** A causal register per entity. Concurrent revisions remain visible until explicitly resolved. */
export function project(operations: Operation[]): State {
  const groups = new Map<string, { kind: Kind; entityId: string; revisions: Map<string, Revision>; parents: Set<string>; edges: Map<string,string[]> }>();
  const seen = new Map<string, string>();
  for (const op of operations) {
    const encoded = canonical(op);
    if (seen.has(op.id)) {
      if (seen.get(op.id) !== encoded) throw new Error("Du skirtingi pakeitimai turi tą patį ID. Sinchronizavimas sustabdytas.");
      continue;
    }
    seen.set(op.id, encoded);
    for (const change of op.changes) {
      const key = entityKey(change.kind, change.entityId);
      let group = groups.get(key);
      if (!group) {
        group = { kind: change.kind, entityId: change.entityId, revisions: new Map(), parents: new Set(), edges: new Map() };
        groups.set(key, group);
      }
      group.revisions.set(op.id, { operationId: op.id, createdAt: op.createdAt, deviceId: op.deviceId, value: change.value });
      group.edges.set(op.id,change.parents);
      for (const parent of change.parents) group.parents.add(parent);
    }
  }
  const state: State = { wheel: [], reading: [], ride: [], trip: [], gear: [], attachment: [], heads: new Map(), conflicts: [], integrity: [] };
  for (const [key, group] of groups) {
    for (const parent of group.parents) if (!group.revisions.has(parent)) state.integrity.push(`Trūksta įrašo istorijos: ${key}.`);
    // Iterative DAG validation also catches a disconnected cycle beside a valid head.
    const degree=new Map<string,number>(),children=new Map<string,string[]>();
    for(const [id,parents] of group.edges){degree.set(id,parents.filter(p=>group.revisions.has(p)).length);for(const p of parents){if(!group.revisions.has(p))continue;const list=children.get(p)??[];list.push(id);children.set(p,list);}}
    const queue=[...degree].filter(([,n])=>n===0).map(([id])=>id);let visited=0;
    while(visited<queue.length){const id=queue[visited++];for(const child of children.get(id)??[]){const count=degree.get(child)!-1;degree.set(child,count);if(count===0)queue.push(child);}}
    if(visited!==group.revisions.size)throw new Error("Pakeitimų istorijoje yra ciklas.");
    const heads = [...group.revisions.values()].filter(r => !group.parents.has(r.operationId)).sort((a,b) => a.operationId.localeCompare(b.operationId, "en"));
    if (!heads.length) throw new Error("Pakeitimų istorijoje yra ciklas.");
    state.heads.set(key, heads);
    if (new Set(heads.map(r=>canonical(r.value))).size > 1) state.conflicts.push({ kind: group.kind, entityId: group.entityId, revisions: heads });
    // The deterministic provisional view never discards any competing revision.
    const value = heads[heads.length - 1].value;
    if (value) (state[group.kind] as Entity[]).push(value);
  }
  state.wheel.sort((a,b) => a.name.localeCompare(b.name, "lt"));
  state.reading.sort(compareReadings);
  state.ride.sort((a,b) => Date.parse(b.at)-Date.parse(a.at)||a.id.localeCompare(b.id,"en"));
  state.trip.sort((a,b) => b.startDate.localeCompare(a.startDate));
  state.gear.sort((a,b) => a.name.localeCompare(b.name, "lt") || a.id.localeCompare(b.id, "en"));
  const wheels = new Set(state.wheel.map(w => w.id));
  const trips = new Set(state.trip.map(t => t.id));
  const rides = new Set(state.ride.map(r => r.id));
  for (const r of [...state.reading, ...state.ride]) if (!wheels.has(r.wheelId)) state.integrity.push("Įrašas susietas su pašalintu arba dar neatsiųstu vienaračiu.");
  for (const r of state.ride) if (r.tripId && !trips.has(r.tripId)) state.integrity.push("Pasivažinėjimo kelionė pašalinta arba dar neatsiųsta.");
  for (const a of state.attachment) if (!(a.ownerKind === "trip" ? trips : rides).has(a.ownerId)) state.integrity.push("Priedo kelionė ar pasivažinėjimas pašalintas arba dar neatsiųstas.");
  state.integrity = [...new Set(state.integrity)];
  return state;
}

export function compareReadings(a: Reading, b: Reading) {
  return Date.parse(a.at) - Date.parse(b.at) || (a.sourceOrder ?? 0) - (b.sourceOrder ?? 0) || a.id.localeCompare(b.id, "en");
}
export const roundKm = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
export type ReadingInterval = { reading: Reading; from: number; distance: number | null; warning: string | null };
export function wheelStats(wheel: Wheel, readings: Reading[]) {
  const ordered = readings.filter(r => r.wheelId === wheel.id).sort(compareReadings);
  const times = new Map<string, number>();
  ordered.forEach(r => {const key=String(Date.parse(r.at));times.set(key, (times.get(key) ?? 0) + 1);});
  let previous = wheel.baselineKm;
  const intervals: ReadingInterval[] = ordered.map(reading => {
    const from = previous;
    const diff = roundKm(reading.odometerKm - from);
    previous = reading.odometerKm;
    const warning = diff < 0 ? "Odometras sumažėjo. Patikrink rodmenį arba jo datą." : (times.get(String(Date.parse(reading.at))) ?? 0) > 1 ? "Tuo pačiu laiku yra keli rodmenys. Patikslink laiką." : null;
    return { reading, from, distance: diff < 0 ? null : diff, warning };
  });
  const invalid = intervals.some(i => i.distance === null);
  return {
    odometerKm: ordered.at(-1)?.odometerKm ?? wheel.baselineKm,
    trackedKm: invalid ? null : roundKm((ordered.at(-1)?.odometerKm ?? wheel.baselineKm) - wheel.baselineKm),
    lastAt: ordered.at(-1)?.at, intervals,
    warnings: intervals.filter(i => i.warning).length,
  };
}

export function makeOperation(state: State, deviceId: string, changes: {kind: Kind; value: Entity | null; entityId: string}[]): Operation {
  return parseOperation({ version: SCHEMA_VERSION, id: uuid(), deviceId, createdAt: new Date().toISOString(), changes: changes.map(c => ({...c, parents: (state.heads.get(entityKey(c.kind, c.entityId)) ?? []).map(r => r.operationId) })) });
}

export function validateEdit(state: State, kind: Kind, entity: Entity): void {
  schemas[kind].parse(entity);
  if (kind === "reading" || kind === "ride") {
    const record = entity as Reading | Ride;
    if (!state.wheel.some(w => w.id === record.wheelId)) throw new Error("Pirmiausia pridėk vienaratį.");
  }
  if (kind === "ride") {
    const r = entity as Ride;
    if (r.tripId && !state.trip.some(t => t.id === r.tripId)) throw new Error("Pasirink esamą kelionę.");
  }
  if (kind === "attachment") {
    const a = entity as Attachment;
    if (!state[a.ownerKind].some(e => e.id === a.ownerId)) throw new Error("Pirmiausia išsaugok kelionę ar pasivažinėjimą.");
  }
  if (kind === "reading" || kind === "wheel") {
    const wheel = kind === "wheel" ? entity as Wheel : state.wheel.find(w => w.id === (entity as Reading).wheelId)!;
    const readings = kind === "reading" ? [...state.reading.filter(r => r.id !== entity.id), entity as Reading] : state.reading;
    const result = wheelStats(wheel, readings);
    if (result.trackedKm === null) throw new Error("Rodmuo neatitinka odometro sekos. Patikrink datą, vienaratį ir gretimus rodmenis.");
    // baselineDate is calendar-only. Comparing it with a UTC day would reject valid
    // local-midnight readings. The numeric odometer sequence is the invariant.
  }
}

export function validateDelete(state: State, kind: Kind, entityId: string) {
  if (kind === "wheel" && [...state.reading, ...state.ride].some(r => r.wheelId === entityId)) throw new Error("Vienaratis turi susietų įrašų. Jų neištrinsime automatiškai.");
  if (kind === "trip" && state.ride.some(r => r.tripId === entityId)) throw new Error("Pirmiausia atskirk kelionės pasivažinėjimus arba priskirk juos kitai kelionei.");
  if ((kind === "ride" || kind === "trip") && state.attachment.some(a => a.ownerKind === kind && a.ownerId === entityId)) throw new Error("Pirmiausia pašalink šio įrašo priedų nuorodas. Originalai liks Drive.");
}

export function tripStats(trip: Trip, rides: Ride[], attachments: Attachment[]) {
  const linked = rides.filter(r => r.tripId === trip.id);
  const days = Math.round((Date.parse(`${trip.endDate}T12:00:00Z`) - Date.parse(`${trip.startDate}T12:00:00Z`)) / 86400000) + 1;
  const known = linked.filter(r => r.distanceKm !== null);
  const ids = new Set(linked.map(r => r.id));
  return { rides: linked, days, distanceKm: roundKm(known.reduce((n,r) => n + r.distanceKm!, 0)), unknownDistances: linked.length - known.length,
    attachments: attachments.filter(a => a.ownerKind === "trip" ? a.ownerId === trip.id : ids.has(a.ownerId)) };
}

export function backup(operations: Operation[]) {
  return { format: "kairo-ride", schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), operations };
}
export function parseBackup(value: unknown): Operation[] {
  const data = z.object({format: z.literal("kairo-ride"), schemaVersion: z.literal(1), exportedAt: instant.optional(), operations: z.array(z.unknown()).max(100_000)}).passthrough().parse(value);
  const ops = data.operations.map(parseOperation);
  project(ops); // Reject colliding IDs and invalid graphs before writing anything.
  return ops;
}
export function localDateTime(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
export const today = () => localDateTime().slice(0,10);
export const formatKm = (n: number | null) => n === null ? "—" : new Intl.NumberFormat("lt-LT", {maximumFractionDigits: 1}).format(n);
export const formatDate = (s: string, time = false, timeZone?: string) => new Intl.DateTimeFormat("lt-LT", {year:"numeric",month:"2-digit",day:"2-digit", ...(time ? {hour:"2-digit",minute:"2-digit"} as const : {}),...(timeZone&&s.length!==10?{timeZone}:{})}).format(new Date(s.length === 10 ? `${s}T12:00:00` : s));
