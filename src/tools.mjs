// The Peptlas MCP tools: plain functions over /data/atlas.json, so the Pages Function, the
// tests and the build-time smoke check (scripts/check-mcp.mjs) all run the same code.
// Every answer carries its page, its date and the credit line, and none gives advice.

/** A question the tools can't answer as asked. The server returns it as a tool error that says what would work. */
export class ToolInputError extends Error {}

export const DISCLAIMER = 'Regulatory status from primary sources, not legal or medical advice.';

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

const EU_MEMBERS = [
  'austria', 'belgium', 'bulgaria', 'croatia', 'cyprus', 'czechia', 'czechrepublic', 'denmark', 'estonia',
  'finland', 'france', 'germany', 'deutschland', 'greece', 'hungary', 'ireland', 'italy', 'latvia', 'lithuania',
  'luxembourg', 'malta', 'netherlands', 'holland', 'poland', 'portugal', 'romania', 'slovakia', 'slovenia',
  'spain', 'sweden',
];

/** Every place Peptlas tracks, with the words people use for it. */
export const PLACES = [
  { id: 'us', place: 'United States', regulator: 'FDA', authority: 'United States (FDA)', keys: ['us', 'usa', 'unitedstates', 'unitedstatesofamerica', 'america', 'fda'] },
  { id: 'au', place: 'Australia', regulator: 'TGA', authority: 'Australia (TGA)', keys: ['au', 'aus', 'australia', 'tga'] },
  { id: 'uk', place: 'United Kingdom', regulator: 'MHRA', authority: 'United Kingdom (MHRA)', keys: ['uk', 'gb', 'unitedkingdom', 'britain', 'greatbritain', 'england', 'scotland', 'wales', 'northernireland', 'mhra'] },
  { id: 'eu', place: 'European Union', regulator: 'EMA', authority: 'European Union (EMA)', keys: ['eu', 'europe', 'europeanunion', 'ema', ...EU_MEMBERS] },
  { id: 'ca', place: 'Canada', regulator: 'Health Canada', authority: 'Canada (Health Canada)', keys: ['ca', 'can', 'canada', 'healthcanada'] },
  { id: 'sport', place: 'Sport (anti-doping)', regulator: 'WADA', authority: 'Sport / anti-doping (WADA)', keys: ['sport', 'sports', 'wada', 'antidoping', 'doping', 'athlete', 'athletes', 'olympics', 'usada', 'competition', 'competitive'] },
  { id: 'br', place: 'Brazil', regulator: 'ANVISA', authority: 'Brazil (ANVISA)', keys: ['br', 'bra', 'brazil', 'brasil', 'anvisa'] },
];

const PLACE_LIST = 'the United States, Australia, the United Kingdom, the European Union (any member state), Canada, Brazil, and sport (WADA)';

export function resolvePlace(input) {
  const raw = norm(input);
  const key = raw.startsWith('the') && raw.length > 4 ? raw.slice(3) : raw; // "the UK", "the Netherlands"
  const hit = PLACES.find((p) => p.keys.includes(key) || p.keys.includes(raw));
  if (hit) {
    const named = String(input).trim().replace(/^the\s+/i, '');
    return { ...hit, member_state: hit.id === 'eu' && EU_MEMBERS.includes(key) ? named[0].toUpperCase() + named.slice(1) : null };
  }
  throw new ToolInputError(`Peptlas doesn't track "${String(input).trim()}" yet. It tracks ${PLACE_LIST}.`);
}

/** Lookup keys for a compound: slug, name (also without "(compounded)"), aliases and street names. */
function keysOf(c) {
  const base = c.name.replace(/\s*\([^)]*\)\s*$/, '');
  return [c.slug, c.name, base, ...c.aliases, ...c.nicknames].map(norm).filter(Boolean);
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** How far a lookup key is from what was typed: a prefix beats a substring beats a typo. */
function distance(key, k) {
  if (k.startsWith(key) && key.length >= 4) return 0.5;
  if ((k.includes(key) && key.length >= 4) || (key.includes(k) && k.length >= 4)) return 1;
  return editDistance(key, k);
}

export function resolveCompound(atlas, input) {
  const key = norm(input);
  if (!key) throw new ToolInputError('Name a compound, for example "BPC-157", "Ozempic" or "reta".');
  const exact = atlas.compounds.find((c) => keysOf(c).includes(key));
  if (exact) return exact;
  // Close spellings and partial names become an answer when one compound is clearly closest
  // ("semaglutid"), and suggestions when several are ("thymosin" is two compounds).
  const near = atlas.compounds
    .map((c) => ({ c, d: Math.min(...keysOf(c).map((k) => distance(key, k))) }))
    .filter((x) => x.d <= Math.max(1, Math.floor(key.length / 4)))
    .sort((a, b) => a.d - b.d);
  if (near.length && near[0].d <= 1 && key.length >= 4 && (near.length === 1 || near[1].d > near[0].d)) return near[0].c;
  const names = near.slice(0, 4).map((x) => x.c.name);
  throw new ToolInputError(
    names.length
      ? `"${String(input).trim()}" matches more than one compound or none exactly. Did you mean: ${names.join(', ')}?`
      : `Peptlas doesn't track "${String(input).trim()}" yet. It tracks ${atlas.compounds.length} compounds; list_compounds names them all.`,
  );
}

// The site's status meanings are written for the U.S. (FDA lists and committees). Elsewhere
// the same labels mean something plainer, and Brazil is stated in ANVISA's own terms.
const MEANING_ELSEWHERE = {
  restricted: 'Prescription-only, banned or controlled by this authority (in sport: prohibited).',
  unscheduled: 'Not specifically scheduled, named or banned by this authority.',
  under_review: 'Formally before this authority for a decision; nothing has changed yet.',
};
const MEANING_BRAZIL = {
  restricted: "Restricted by ANVISA; the Portuguese status and note say exactly how.",
  registered_medicine: 'A medicine registered with ANVISA; the Portuguese status says on what terms.',
};

function meaningOf(atlas, placeId, status) {
  if (placeId === 'us') return atlas.statuses[status]?.meaning ?? null;
  if (placeId === 'br') return MEANING_BRAZIL[status] ?? null;
  return MEANING_ELSEWHERE[status] ?? atlas.statuses[status]?.meaning ?? null;
}

/** One row per tracked place for a compound, Brazil included where Peptlas has ANVISA data. */
function rowsFor(atlas, c) {
  const rows = PLACES.filter((p) => p.id !== 'br').flatMap((p) => {
    const j = c.jurisdictions.find((x) => x.authority === p.authority);
    if (!j) return [];
    return [{ place: p.place, regulator: p.regulator, status: j.status, status_label: j.label, meaning: meaningOf(atlas, p.id, j.status), note: j.note }];
  });
  if (c.brazil) {
    rows.push({
      place: 'Brazil',
      regulator: 'ANVISA',
      status: c.brazil.status_class,
      status_label: c.brazil.status_pt,
      meaning: meaningOf(atlas, 'br', c.brazil.status_class),
      note: c.brazil.summary_pt,
      language: 'pt-BR',
      page: c.brazil.url,
    });
  }
  return rows;
}

function credit(atlas, page) {
  return `Source: Peptlas (${page ?? atlas.url}), ${atlas.license.name}. ${DISCLAIMER}`;
}

export function checkLegalStatus(atlas, { compound, place }) {
  const c = resolveCompound(atlas, compound);
  const p = place ? resolvePlace(place) : null;
  const all = rowsFor(atlas, c);
  const rows = p ? all.filter((r) => r.place === p.place) : all;
  if (p && rows.length === 0) {
    throw new ToolInputError(
      `Peptlas has no ${p.place} data for ${c.name} yet. It covers ${all.map((r) => r.place).join(', ')} for this compound.`,
    );
  }
  const usInScope = !p || p.id === 'us';
  const v = c.advisory_vote;
  return {
    compound: c.name,
    page: c.url,
    ...(p?.member_state ? { note_on_place: `${p.member_state} is covered by the EU-level status; enforcement is national.` } : {}),
    statuses: rows,
    ...(usInScope
      ? {
          us_answer: c.answer,
          us_status_since: c.us.since,
          next_event: c.next_event,
          advisory_vote: v
            ? { date: v.date, body: v.body, outcome: v.outcome, yes: v.yes ?? null, no: v.no ?? null, abstain: v.abstain ?? null, binding: false }
            : null,
        }
      : {}),
    primary_sources: c.sources.filter((s) => s.primary).slice(0, 6).map(({ label, url }) => ({ label, url })),
    all_sources: c.url,
    last_verified: c.last_verified,
    credit: credit(atlas, c.url),
  };
}

export function statusInPlace(atlas, { place, status }) {
  const p = resolvePlace(place);
  const rows = atlas.compounds
    .map((c) => {
      const r = rowsFor(atlas, c).find((x) => x.place === p.place);
      return r ? { compound: c.name, status: r.status, status_label: r.status_label, note: r.note, page: r.page ?? c.url } : null;
    })
    .filter(Boolean)
    .filter((r) => !status || r.status === status);
  const counts = {};
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const statusKey = Object.fromEntries(Object.keys(counts).map((s) => [s, meaningOf(atlas, p.id, s)]));
  return {
    place: p.place,
    regulator: p.regulator,
    ...(p.member_state ? { note_on_place: `${p.member_state} is covered by the EU-level status; enforcement is national.` } : {}),
    ...(p.id === 'br' ? { language: 'pt-BR', note_on_data: `Brazil covers ${rows.length} of ${atlas.compounds.length} compounds, stated in ANVISA's terms.` } : {}),
    compounds: rows,
    counts,
    status_key: statusKey,
    last_checked: atlas.last_checked,
    credit: credit(atlas),
  };
}

export function listCompounds(atlas, { us_status } = {}) {
  const list = atlas.compounds
    .filter((c) => !us_status || c.us.status === us_status)
    .map((c) => ({
      compound: c.name,
      slug: c.slug,
      also_known_as: [...c.aliases, ...c.nicknames],
      us_status: c.us.status,
      us_status_label: c.us.label,
      in_brazil_data: Boolean(c.brazil),
      page: c.url,
    }));
  return { count: list.length, compounds: list, places_tracked: PLACES.map((p) => p.place), last_checked: atlas.last_checked, credit: credit(atlas) };
}

export function recentChanges(atlas, { compound, since, limit = 10 } = {}) {
  const c = compound ? resolveCompound(atlas, compound) : null;
  if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new ToolInputError('since must be a date like 2026-07-01.');
  const changes = atlas.changes
    .filter((x) => (!c || x.slug === c.slug) && (!since || x.date >= since))
    .slice(0, Math.min(Math.max(1, limit), 50))
    .map((x) => ({
      date: x.date,
      compound: x.compound,
      type: x.tag,
      summary: x.summary,
      source: x.source_url,
      page: atlas.compounds.find((k) => k.slug === x.slug)?.url ?? atlas.url,
    }));
  return { count: changes.length, changes, changelog: `${atlas.url}changelog/`, last_checked: atlas.last_checked, credit: credit(atlas) };
}
