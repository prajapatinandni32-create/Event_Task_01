'use strict';
/* ===== Helpers ===== */
const EK = 'campuspulse.events.v1', SK = 'campuspulse.saved.v1', ME = 'demo-student';
const CATS = ['Technology', 'Cultural', 'Sports', 'Workshops', 'Other'];
const CAT_ICON = { Technology: 'cpu', Cultural: 'music', Sports: 'trophy', Workshops: 'wrench', Other: 'sparkles' };
const $ = s => document.querySelector(s);
// h(): safe element builder. Text always goes through text nodes, never innerHTML.
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  kids.flat().forEach(c => c != null && el.append(c instanceof Node ? c : document.createTextNode(c)));
  return el;
};
const ic = n => h('i', { 'data-lucide': n, 'aria-hidden': 'true' });
const icons = () => window.lucide && lucide.createIcons();
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const off = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const st = e => new Date(`${e.date}T${e.startTime}`), en = e => new Date(`${e.date}T${e.endTime}`);
const isPast = e => en(e) < new Date();
const tm = d => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const fmt = e => `${st(e).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}, ${tm(st(e))} – ${tm(en(e))}`;
function toast(m) { const t = h('div', { class: 'toast' }, m); $('#toasts').append(t); setTimeout(() => t.remove(), 3200); }

/* ===== Storage layer (safe against missing / corrupt data) ===== */
const Store = {
  read(k) { try { const v = JSON.parse(localStorage.getItem(k)); return Array.isArray(v) ? v : null; } catch { return null; } },
  write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { toast('Could not save: browser storage is full or blocked.'); return false; } }
};
const valid = e => e && typeof e.id === 'string' && typeof e.title === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
  /^\d\d:\d\d$/.test(e.startTime) && /^\d\d:\d\d$/.test(e.endTime) && CATS.includes(e.category) &&
  Number.isInteger(e.capacity) && e.capacity > 0 && Array.isArray(e.rsvps) && Array.isArray(e.waitlist);

function seed() {
  const mk = (
  i, title, category, o, s, e,
  venue, org, cap, n, description, poster
) => ({
    id: 'seed' + i, title, description, category, date: off(o), startTime: s, endTime: e, venue, organizerName: org,
    poster: poster || '', capacity: cap, rsvps: Array.from({ length: n }, (_, j) => `seed-${i}-${j}`), waitlist: [],
    createdAt: Date.now() - i * 1e6, updatedAt: Date.now()
  });
  return [
    mk(
  1, 'Hack the Campus 24h', 'Technology',
  6, '10:00', '18:00',
  'Innovation Lab, Block C', 'Coding Club',
  120, 84,
  'A day-long hackathon for teams of up to four. Build something useful for campus life and demo it to a panel of faculty and alumni.',
  'https://i.pinimg.com/736x/fd/cb/45/fdcb457de2e4bf2bc6867060639f7ada.jpg'
),
    mk(2, 'Intro to Machine Learning Workshop', 'Workshops', 2, '14:00', '16:30', 'Seminar Hall 2', 'AI Society', 40, 38, 'Hands-on session covering regression, classification and evaluation in Python. Bring a laptop.'),
    mk(3, 'Spring Cultural Night', 'Cultural', 9, '18:00', '21:30', 'Open Air Theatre', 'Cultural Committee', 400, 212, 'Dance, music and drama performances by student groups from every department.'),
    mk(4, 'Inter-Department Football Cup', 'Sports', 4, '16:00', '18:00', 'Main Sports Ground', 'Sports Council', 60, 22, 'Knockout tournament. Teams register at the sports office; spectators welcome.'),
    mk(5, 'Resume & LinkedIn Clinic', 'Workshops', 1, '11:00', '12:30', 'Placement Cell, Room 5', 'Career Services', 5, 5, 'Small-group reviews with recruiters. Seats are limited, so join the waitlist if full.'),
    mk(6, 'Open Mic Evening', 'Cultural', 13, '17:30', '19:30', 'Student Cafe', 'Literary Society', 80, 17, 'Poetry, stand-up, acoustic sets. Sign up on the day or just come to listen.'),
    mk(7, 'Cybersecurity Capture the Flag', 'Technology', 20, '09:30', '15:30', 'Computer Centre', 'InfoSec Group', 50, 9, 'Beginner-friendly CTF with web, crypto and forensics challenges.'),
    mk(8, 'Alumni Career Panel', 'Other', 3, '15:00', '16:30', 'Auditorium', 'Alumni Cell', 200, 61, 'Four alumni from product, research and startups share how they got started.'),
    mk(9, 'Photography Walk (Past)', 'Other', -3, '07:00', '09:00', 'Lake Garden', 'Photo Club', 30, 26, 'Sunrise photo walk around the lake. Photos will be exhibited next month.'),
    mk(10, 'Winter Chess Open (Past)', 'Sports', -12, '10:00', '17:00', 'Library Hall', 'Chess Club', 48, 40, 'Seven-round Swiss tournament, open to all students.')
  ];
}
let events, saved;
function init() {
  const stored = Store.read(EK);
  events = (stored || seed()).filter(valid);       // seed only when nothing valid was stored
  if (!stored) persist();
  saved = (Store.read(SK) || []).filter(id => typeof id === 'string');
}
const persist = () => Store.write(EK, events);
const persistSaved = () => Store.write(SK, saved);
const get = id => events.find(e => e.id === id);

/* ===== Dialog ===== */
const ask = (msg, ok = 'Confirm') => new Promise(res => {
  const d = $('#dlg'); d.returnValue = '';
  d.replaceChildren(h('form', { method: 'dialog' }, h('p', {}, msg), h('div', { class: 'row' },
    h('button', { class: 'btn ghost', value: 'no' }, 'Cancel'), h('button', { class: 'btn', value: 'yes', autofocus: 'true' }, ok))));
  d.onclose = () => res(d.returnValue === 'yes'); d.showModal();
});

/* ===== Domain logic: bookmarks, RSVP, waitlist ===== */
function toggleSave(id) {
  const i = saved.indexOf(id); i < 0 ? saved.push(id) : saved.splice(i, 1);
  persistSaved(); toast(i < 0 ? 'Event saved' : 'Removed from saved'); route();
}
function promote(e) { while (e.waitlist.length && e.rsvps.length < e.capacity) e.rsvps.push(e.waitlist.shift()); } // FIFO
function clashFor(e) {
  return events.find(o => o.id !== e.id && o.rsvps.includes(ME) && !isPast(o) && st(e) < en(o) && st(o) < en(e));
}
async function toggleRsvp(id) {
  const e = get(id); if (!e || isPast(e)) return;
  if (e.rsvps.includes(ME)) {
    e.rsvps = e.rsvps.filter(u => u !== ME); promote(e); toast('RSVP cancelled');
  } else if (e.waitlist.includes(ME)) {
    e.waitlist = e.waitlist.filter(u => u !== ME); toast('Left the waitlist');
  } else {
    const c = clashFor(e);
    if (c && !await ask(`This overlaps with "${c.title}" (${fmt(c)}). Continue anyway?`, 'Continue')) return;
    if (e.rsvps.length < e.capacity) { e.rsvps.push(ME); toast('Seat reserved'); }
    else { e.waitlist.push(ME); toast(`Added to the waitlist (position ${e.waitlist.length})`); }
  }
  persist(); route();
}
async function removeEvent(id) {
  const e = get(id);
  if (!await ask(`Delete "${e.title}"? Its RSVPs will be lost.`, 'Delete')) return;
  events = events.filter(x => x.id !== id); saved = saved.filter(s => s !== id);
  persist(); persistSaved(); toast('Event deleted'); route();
}

/* ===== UI pieces ===== */
function poster(e) {
  const p = h('div', { class: 'poster c-' + e.category }, ic(CAT_ICON[e.category]));
  if (/^https?:\/\//i.test(e.poster || '')) {
    const img = h('img', { src: e.poster, alt: `Poster for ${e.title}`, loading: 'lazy' });
    img.onerror = () => img.remove(); p.append(img);     // fallback = gradient poster
  }
  return p;
}
const bmBtn = e => h('button', { class: 'icon-btn bm', 'aria-pressed': String(saved.includes(e.id)),
  'aria-label': (saved.includes(e.id) ? 'Unsave ' : 'Save ') + e.title, onclick: () => toggleSave(e.id) }, ic('bookmark'));
function rsvpBtn(e, small) {
  if (isPast(e)) return null;
  const mine = e.rsvps.includes(ME), wait = e.waitlist.includes(ME), full = e.rsvps.length >= e.capacity;
  const label = mine ? 'Cancel RSVP' : wait ? 'Leave waitlist' : full ? 'Join waitlist' : 'RSVP';
  return h('button', { class: 'btn ' + (mine || wait ? 'ghost ' : '') + (small ? 'sm' : ''), onclick: () => toggleRsvp(e.id) }, label);
}
function status(e) {
  if (isPast(e)) return 'Ended';
  const left = e.capacity - e.rsvps.length;
  return left <= 0 ? `Full · ${e.waitlist.length} waiting` : `${left} seat${left > 1 ? 's' : ''} left`;
}
function card(e) {
  return h('article', { class: 'card' },
    h('div', { class: 'pw' }, poster(e), h('span', { class: 'badge' }, e.category), bmBtn(e)),
    h('div', { class: 'cb' },
      h('h3', {}, h('a', { href: '#/event/' + e.id }, e.title)),
      h('p', { class: 'm' }, ic('calendar'), fmt(e)), h('p', { class: 'm' }, ic('map-pin'), e.venue),
      h('p', { class: 'm' }, ic('user'), e.organizerName),
      h('div', { class: 'cf' }, h('span', { class: 'st' + (e.rsvps.length >= e.capacity && !isPast(e) ? ' full' : '') }, status(e)),
        h('a', { class: 'btn ghost sm', href: '#/event/' + e.id }, 'View details'), rsvpBtn(e, true))));
}
const empty = (icon, title, text, ...actions) => h('div', { class: 'empty' }, ic(icon), h('h2', {}, title), h('p', {}, text), h('div', { class: 'row', style: 'justify-content:center' }, actions));
const resetBtn = () => h('button', { class: 'btn ghost', onclick: resetDemo }, 'Reset demo data');
async function resetDemo() {
  if (!await ask('Replace all events, RSVPs and bookmarks with the demo data?', 'Reset')) return;
  events = seed(); saved = []; persist(); persistSaved(); toast('Demo data restored'); route();
}

/* ===== Discover (search + filters + sort) ===== */
const f = { q: '', cat: 'All', when: 'upcoming', date: '', sort: 'date' };
const sorters = { date: (a, b) => st(a) - st(b), popular: (a, b) => b.rsvps.length - a.rsvps.length, newest: (a, b) => b.createdAt - a.createdAt };
const filtered = () => {
  const q = f.q.trim().toLowerCase();
  return events.filter(e => (f.cat === 'All' || e.category === f.cat) && (!q || `${e.title} ${e.venue}`.toLowerCase().includes(q)) &&
    (!f.date || e.date === f.date) && (f.when === 'all' || (f.when === 'past') === isPast(e))).sort(sorters[f.sort]);
};
function discover() {
  const list = h('div', { class: 'grid', 'aria-live': 'polite' });
  const renderList = () => {
    const r = filtered();
    list.replaceChildren(...(r.length ? r.map(card) : [events.length
      ? empty('search-x', 'No events match', 'Try a different search, category or date.', h('button', { class: 'btn', onclick: () => { Object.assign(f, { q: '', cat: 'All', when: 'upcoming', date: '' }); route(); } }, 'Clear filters'))
      : empty('calendar-x', 'No events yet', 'Create the first event or restore the demo events.', h('a', { class: 'btn', href: '#/form' }, 'Create event'), resetBtn())]));
    icons();
  };
  const cats = h('div', { class: 'cats', role: 'group', 'aria-label': 'Filter by category' }, ['All', ...CATS].map(c =>
    h('button', { class: 'chip', 'aria-pressed': String(f.cat === c), onclick: () => { f.cat = c; cats.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b.textContent === c))); renderList(); } }, c === 'All' ? 'All Events' : c)));
  const search = h('input', { id: 'search', type: 'search', placeholder: 'Search by title or venue', 'aria-label': 'Search events', value: f.q });
  const clear = h('button', { class: 'icon-btn', 'aria-label': 'Clear search', hidden: !f.q, onclick: () => { search.value = f.q = ''; clear.hidden = true; renderList(); search.focus(); } }, ic('x'));
  search.oninput = () => { f.q = search.value; clear.hidden = !f.q; renderList(); };
  const sel = (key, label, opts) => { const s = h('select', { 'aria-label': label }, opts.map(([v, t]) => h('option', { value: v }, t))); s.value = f[key]; s.onchange = () => { f[key] = s.value; renderList(); }; return s; };
  const date = h('input', { type: 'date', 'aria-label': 'Filter by date', value: f.date }); date.onchange = () => { f.date = date.value; renderList(); };
  renderList();
  return h('section', { class: 'wrap', id: 'discover' }, h('h2', {}, 'Discover events'), cats,
    h('div', { class: 'tools' }, h('div', { class: 'sbox' }, search, clear),
      sel('when', 'Show', [['upcoming', 'Upcoming'], ['past', 'Past events'], ['all', 'All dates']]), date,
      sel('sort', 'Sort by', [['date', 'Earliest first'], ['popular', 'Most popular'], ['newest', 'Newest added']])), list);
}
function recs() {
  const favs = new Set(saved.map(id => get(id)?.category).filter(Boolean));
  const up = events.filter(e => !isPast(e) && !saved.includes(e.id) && !e.rsvps.includes(ME));
  const pick = favs.size ? up.filter(e => favs.has(e.category)) : [];
  const list = (pick.length ? pick : [...up].sort(sorters.popular)).slice(0, 3);
  if (!list.length) return null;
  return h('section', { class: 'wrap' }, h('h2', {}, pick.length ? 'Based on the categories you saved' : 'Popular right now'),
    h('p', { class: 'lead', style: 'margin:0 0 16px' }, pick.length ? 'Preference-based suggestions from your bookmarks.' : 'Save a few events and suggestions will match your interests.'),
    h('div', { class: 'grid' }, list.map(card)));
}

/* ===== Views ===== */
function home() {
  const up = events.filter(e => !isPast(e)).sort(sorters.date);
  const seats = up.reduce((s, e) => s + Math.max(0, e.capacity - e.rsvps.length), 0);
  const stat = (n, l) => h('div', {}, h('b', {}, n), h('span', {}, l));
  $('#app').append(h('section', { class: 'wrap hero' },
    h('div', {}, h('h1', {}, 'Your campus. Your community. Your next big thing.'),
      h('p', { class: 'lead' }, 'Every talk, tournament and open mic in one place. Find it, save it, reserve your seat.'),
      h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/explore' }, 'Explore Events'), h('a', { class: 'btn ghost', href: '#/form' }, 'Create an Event')),
      h('div', { class: 'stats' }, stat(up.length, 'upcoming events'), stat(seats, 'open seats'), stat(events.reduce((s, e) => s + e.rsvps.length, 0), 'RSVPs so far'))),
    h('div', { class: 'next' }, h('h2', {}, 'Happening next'),
      ...(up.length ? up.slice(0, 3).map(e => h('a', { href: '#/event/' + e.id }, h('b', {}, e.title), h('small', {}, `${fmt(e)} · ${e.venue}`))) : [h('p', { class: 'lead' }, 'No upcoming events yet.')]))));
  const r = recs(); r && $('#app').append(r);
  $('#app').append(discover());
}
function savedView() {
  const mine = saved.map(get).filter(Boolean).sort(sorters.date);
  $('#app').append(h('section', { class: 'wrap' }, h('h1', { style: 'font-size:2rem;margin-bottom:16px' }, 'Saved events'),
    mine.length ? h('div', { class: 'grid' }, mine.map(card)) : empty('bookmark', 'Nothing saved yet', 'Tap the bookmark on any event to keep it here.', h('a', { class: 'btn', href: '#/explore' }, 'Explore events'))));
  const r = recs(); r && $('#app').append(r);
}
function detail(id) {
  const e = get(id);
  if (!e) return $('#app').append(h('div', { class: 'wrap' }, empty('circle-alert', 'Event not found', 'It may have been deleted.', h('a', { class: 'btn', href: '#/explore' }, 'Back to events'))));
  const left = Math.max(0, e.capacity - e.rsvps.length), pct = Math.round(e.rsvps.length / e.capacity * 100);
  const mine = e.rsvps.includes(ME), wait = e.waitlist.indexOf(ME);
  $('#app').append(h('div', { class: 'wrap' }, h('a', { class: 'back', href: '#/explore' }, ic('arrow-left'), 'All events'),
    h('div', { class: 'detail' },
      h('div', { class: 'pw' }, poster(e), h('span', { class: 'badge' }, e.category)),
      h('div', {}, h('h1', { style: 'font-size:clamp(1.8rem,4vw,2.6rem)' }, e.title), h('p', { class: 'lead', style: 'white-space:pre-line' }, e.description)),
      h('aside', { class: 'panel' },
        h('p', { class: 'm' }, ic('calendar'), fmt(e)), h('p', { class: 'm' }, ic('map-pin'), e.venue), h('p', { class: 'm' }, ic('user'), 'Organized by ' + e.organizerName),
        h('div', { class: 'bar2', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Seats filled' }, h('i', { style: `width:${pct}%` })),
        h('p', {}, `${e.rsvps.length} confirmed of ${e.capacity} seats · ${left} remaining` + (e.waitlist.length ? ` · ${e.waitlist.length} on waitlist` : '')),
        mine ? h('p', { class: 'st' }, 'You have a seat.') : wait >= 0 ? h('p', { class: 'st' }, `You are #${wait + 1} on the waitlist.`) : null,
        isPast(e) ? h('p', { class: 'st full' }, 'This event has ended.') : rsvpBtn(e),
        h('button', { class: 'btn ghost', 'aria-pressed': String(saved.includes(e.id)), onclick: () => toggleSave(e.id) }, ic('bookmark'), saved.includes(e.id) ? 'Saved' : 'Save event')))));
}

/* ===== Create / edit form ===== */
function form(id) {
  const ex = id && get(id);
  if (id && !ex) return detail(id);
  const v = ex || { title: '', description: '', category: 'Technology', date: '', startTime: '', endTime: '', venue: '', organizerName: '', poster: '', capacity: 50 };
  const spec = [['title', 'Event title', 'text', 1], ['description', 'Description', 'textarea', 1], ['category', 'Category', 'select'], ['date', 'Date', 'date'], ['startTime', 'Start time', 'time'], ['endTime', 'End time', 'time'],
    ['venue', 'Venue', 'text'], ['organizerName', 'Organizer name', 'text'], ['poster', 'Poster image URL (optional)', 'url', 1], ['capacity', 'Maximum seats', 'number']];
  const inputs = {}, errs = {};
  const fields = spec.map(([n, l, t, wide]) => {
    const inp = t === 'textarea' ? h('textarea', { rows: 4 }) : t === 'select' ? h('select', {}, CATS.map(c => h('option', {}, c))) : h('input', { type: t, min: t === 'number' ? 1 : null, step: t === 'number' ? 1 : null });
    inp.id = 'f-' + n; inp.value = v[n]; inputs[n] = inp;
    errs[n] = h('div', { class: 'err', id: 'e-' + n });
    return h('div', { class: wide ? 'wide' : '' }, h('label', { for: inp.id }, l), inp, errs[n]);
  });
  let busy = false;
  const submit = h('button', { class: 'btn', type: 'submit' }, ex ? 'Save changes' : 'Create event');
  const f2 = h('form', { class: 'f', novalidate: 'true', onsubmit: ev => {
    ev.preventDefault(); if (busy) return;
    const d = Object.fromEntries(spec.map(([n]) => [n, inputs[n].value.trim()])), er = {};
    ['title', 'description', 'date', 'startTime', 'endTime', 'venue', 'organizerName'].forEach(k => { if (!d[k]) er[k] = 'This field is required.'; });
    if (d.date && (isNaN(new Date(d.date + 'T00:00')) || (!ex && d.date < ymd(new Date())))) er.date = 'Choose a valid date, today or later.';
    if (d.startTime && d.endTime && d.endTime <= d.startTime) er.endTime = 'End time must be after the start time.';
    const cap = Number(d.capacity);
    if (!Number.isInteger(cap) || cap < 1) er.capacity = 'Enter a whole number of at least 1.';
    else if (ex && cap < ex.rsvps.length) er.capacity = `${ex.rsvps.length} seats are already confirmed.`;
    if (d.poster && !/^https?:\/\/\S+$/i.test(d.poster)) er.poster = 'Use a link starting with http:// or https://';
    spec.forEach(([n]) => { errs[n].textContent = er[n] || ''; inputs[n].setAttribute('aria-invalid', String(!!er[n])); inputs[n].setAttribute('aria-describedby', 'e-' + n); });
    const bad = Object.keys(er)[0]; if (bad) return inputs[bad].focus();
    busy = true; submit.disabled = true;
    const data = { title: d.title, description: d.description, category: d.category, date: d.date, startTime: d.startTime, endTime: d.endTime, venue: d.venue, organizerName: d.organizerName, poster: d.poster, capacity: cap, updatedAt: Date.now() };
    let target;
    if (ex) { Object.assign(ex, data); promote(ex); target = ex; }   // RSVPs, waitlist, id preserved
    else { target = { id: 'ev' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...data, rsvps: [], waitlist: [], createdAt: Date.now() }; events.push(target); }
    if (!persist()) { busy = false; submit.disabled = false; return; }
    toast(ex ? 'Event updated' : 'Event created'); location.hash = '#/event/' + target.id;
  } }, fields, h('div', { class: 'wide row' }, submit, h('a', { class: 'btn ghost', href: ex ? '#/dashboard' : '#/explore' }, 'Cancel')));
  $('#app').append(h('div', { class: 'wrap' }, h('h1', { style: 'font-size:2rem;margin-bottom:16px' }, ex ? 'Edit event' : 'Create an event'), f2));
}

/* ===== Organizer dashboard ===== */
function dash() {
  const up = events.filter(e => !isPast(e)), kpi = (n, l) => h('div', { class: 'kpi' }, h('b', {}, n), h('span', {}, l));
  const rows = [...events].sort(sorters.date).map(e => h('tr', {},
    h('td', {}, h('a', { href: '#/event/' + e.id }, e.title)), h('td', {}, fmt(e)),
    h('td', {}, `${e.rsvps.length} / ${e.capacity}`, h('div', { class: 'bar2' }, h('i', { style: `width:${Math.round(e.rsvps.length / e.capacity * 100)}%` }))),
    h('td', {}, Math.max(0, e.capacity - e.rsvps.length)), h('td', {}, e.waitlist.length),
    h('td', {}, h('div', { class: 'row' }, h('a', { class: 'btn ghost sm', href: '#/form/' + e.id, 'aria-label': 'Edit ' + e.title }, 'Edit'), h('button', { class: 'btn danger sm', 'aria-label': 'Delete ' + e.title, onclick: () => removeEvent(e.id) }, 'Delete')))));
  $('#app').append(h('div', { class: 'wrap' }, h('h1', { style: 'font-size:2rem;margin-bottom:16px' }, 'Organizer dashboard'),
    h('div', { class: 'kpis' }, kpi(events.length, 'Total events'), kpi(up.length, 'Upcoming'), kpi(events.reduce((s, e) => s + e.rsvps.length, 0), 'Confirmed RSVPs'),
      kpi(events.reduce((s, e) => s + e.waitlist.length, 0), 'On waitlists'), kpi(saved.length, 'Bookmarks (this browser)')),
    events.length ? h('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, ['Event', 'When', 'RSVPs', 'Seats left', 'Waitlist', 'Actions'].map(t => h('th', { scope: 'col' }, t)))), h('tbody', {}, rows)))
      : empty('layout-dashboard', 'No events to manage', 'Create an event to see RSVP numbers here.', h('a', { class: 'btn', href: '#/form' }, 'Create event')),
    h('p', { style: 'margin-top:20px' }, resetBtn())));
}

/* ===== Router ===== */
function route(fresh) {
  const [, p = '', arg] = location.hash.slice(1).split('/');
  const app = $('#app'); app.replaceChildren();
  ({ '': home, explore: () => app.append(discover()), saved: savedView, event: () => detail(arg), form: () => form(arg), dashboard: dash }[p] || home)();
  document.querySelectorAll('nav a:not(.btn)').forEach(a => a.getAttribute('href') === '#/' + p || (p === '' && a.getAttribute('href') === '#/') ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  $('#nav').classList.remove('open'); $('#menu').setAttribute('aria-expanded', 'false');
  icons(); if (fresh === true) { window.scrollTo(0, 0); }
}
window.addEventListener('DOMContentLoaded', () => {
  init();
  $('#menu').onclick = () => { const o = $('#nav').classList.toggle('open'); $('#menu').setAttribute('aria-expanded', String(o)); };
  $('#search-open').onclick = () => { location.hash = '#/explore'; setTimeout(() => $('#search')?.focus(), 50); };
  window.addEventListener('hashchange', () => route(true));
  route(true);
});
window.addEventListener('load', icons);
