'use strict';

const SUPABASE_URL      = 'https://jntspohwzkugcuisoofm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CgGyn2sReCxWz6Li9QnWnw_kC-8CgVO';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ordinalSuffix(n) {
  const v = n % 100;
  const s = ['th', 'st', 'nd', 'rd'];
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatEventDate(dateStr) {
  // "2026-05-08" → "Friday, May 8th, 2026"
  const d = new Date(dateStr + 'T12:00:00'); // noon to avoid timezone edge cases
  const dayName  = d.toLocaleDateString('en-US', { weekday: 'long' });
  const month    = d.toLocaleDateString('en-US', { month: 'long' });
  const year     = d.getFullYear();
  return `${dayName}, ${month} ${ordinalSuffix(d.getDate())}, ${year}`;
}

function parseTime12h(timeStr) {
  // "7:30 PM" → { h: 19, m: 30 }
  const m = String(timeStr || '').match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return { h, m: min };
}

// Returns the nth occurrence of dayOfWeek (0=Sun) in a given year/month (UTC).
function nthWeekdayUTC(year, month, dow, n) {
  const d = new Date(Date.UTC(year, month, 1));
  let count = 0;
  while (d.getUTCMonth() === month) {
    if (d.getUTCDay() === dow) { if (++count === n) return new Date(d); }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return null;
}

// Returns true if the given date (YYYY-MM-DD) falls in US Eastern Daylight Time.
function isEDT(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const yr = d.getUTCFullYear();
  const dstStart = nthWeekdayUTC(yr, 2, 0, 2);  // 2nd Sunday in March
  const dstEnd   = nthWeekdayUTC(yr, 10, 0, 1); // 1st Sunday in November
  return d >= dstStart && d < dstEnd;
}

// Converts event date + Eastern time string → UTC Date object.
function toUTC(dateStr, timeStr) {
  const t = parseTime12h(timeStr);
  if (!t) return null;
  const offset = isEDT(dateStr) ? 4 : 5; // hours east → hours to add for UTC
  const [yr, mo, dy] = dateStr.split('-').map(Number);
  const utcH = t.h + offset;
  return new Date(Date.UTC(yr, mo - 1, dy + (utcH >= 24 ? 1 : 0), utcH % 24, t.m, 0));
}

function fmtUTCForCal(date) {
  // YYYYMMDDTHHMMSSZ
  return date.getUTCFullYear().toString()
    + String(date.getUTCMonth() + 1).padStart(2, '0')
    + String(date.getUTCDate()).padStart(2, '0') + 'T'
    + String(date.getUTCHours()).padStart(2, '0')
    + String(date.getUTCMinutes()).padStart(2, '0') + '00Z';
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function googleCalendarURL(event) {
  const start = toUTC(event.event_date, event.start_time);
  const end   = toUTC(event.event_date, event.end_time);
  if (!start || !end) return '#';
  const desc = event.description || `Join us for ${event.title} at ${event.location_name}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${fmtUTCForCal(start)}/${fmtUTCForCal(end)}`,
    details: desc,
    location: event.location_address,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function downloadICS(event) {
  const start = toUTC(event.event_date, event.start_time);
  const end   = toUTC(event.event_date, event.end_time);
  if (!start || !end) return;
  const desc = (event.description || '').replace(/\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Restoration Tennis Ladder//EN',
    'BEGIN:VEVENT',
    `DTSTART:${fmtUTCForCal(start)}`,
    `DTEND:${fmtUTCForCal(end)}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${desc}`,
    `LOCATION:${event.location_address}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `resto-tennis-${slugify(event.title)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Event type config ────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  'Drop-In Night': { color: '#1F4D3A', cls: 'type-drop-in'    },
  "Men's Night":   { color: '#1F3558', cls: 'type-mens'        },
  "Women's Night": { color: '#6B3D9E', cls: 'type-womens'      },
  'Tournament':    { color: '#D97706', cls: 'type-tournament'   },
  'Other':         { color: '#6B7280', cls: 'type-other'        },
};

function typeConfig(eventType) {
  return TYPE_CONFIG[eventType] || TYPE_CONFIG['Other'];
}

// ─── Card renderer ────────────────────────────────────────────────────────────

function renderEventCard(event, isPast) {
  const cfg       = typeConfig(event.event_type);
  const mapsURL   = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location_address)}`;
  const gcalURL   = googleCalendarURL(event);
  const dateLabel = formatEventDate(event.event_date);

  const pastBadge = isPast ? `<span class="event-badge event-badge-past">Past Event</span>` : '';
  const courts    = event.courts ? `<div class="event-courts">🎾 ${event.courts} court${event.courts !== 1 ? 's' : ''} reserved</div>` : '';
  const desc      = event.description
    ? `<div class="event-description">${esc(event.description)}</div>`
    : '';

  return `
    <div class="event-card ${cfg.cls}${isPast ? ' past-event' : ''}">
      <div class="event-card-top">
        <span class="event-type-badge" style="background:${cfg.color};">${esc(event.event_type)}</span>
        ${pastBadge}
      </div>
      <div class="event-title">${esc(event.title)}</div>
      <div class="event-datetime">📅 ${esc(dateLabel)} &nbsp;·&nbsp; ${esc(event.start_time)} – ${esc(event.end_time)}</div>
      ${courts}
      <div class="event-location">
        <strong>${esc(event.location_name)}</strong><br>
        <a href="${esc(mapsURL)}" target="_blank" rel="noopener" class="event-map-link">
          📍 ${esc(event.location_address)}
        </a>
      </div>
      ${desc}
      ${!isPast ? `
      <div class="event-actions">
        <a href="${esc(gcalURL)}" target="_blank" rel="noopener" class="btn-calendar">📅 Add to Google Calendar</a>
        <button class="btn-calendar" data-event-id="${esc(String(event.id))}">🍎 Add to Apple Calendar</button>
      </div>` : ''}
    </div>
  `;
}

// ─── Page init ────────────────────────────────────────────────────────────────

async function loadEvents() {
  const today = new Date().toISOString().split('T')[0];

  const [upcomingRes, pastRes] = await Promise.all([
    db.from('events').select('*').gte('event_date', today).order('event_date', { ascending: true }),
    db.from('events').select('*').lt('event_date', today).order('event_date', { ascending: false }),
  ]);

  // Upcoming
  const upcomingList = document.getElementById('upcoming-events-list');
  const upcoming = upcomingRes.data || [];
  if (upcoming.length === 0) {
    upcomingList.innerHTML = `
      <div class="events-empty-state">
        <p>No upcoming events scheduled. Check back soon!</p>
      </div>`;
  } else {
    upcomingList.innerHTML = upcoming.map(e => renderEventCard(e, false)).join('');
    // Wire Apple Calendar buttons
    upcomingList.querySelectorAll('[data-event-id]').forEach(btn => {
      const eventId = btn.dataset.eventId;
      const ev = upcoming.find(e => String(e.id) === eventId);
      if (ev) btn.addEventListener('click', () => downloadICS(ev));
    });
  }

  // Past
  const past = pastRes.data || [];
  const pastSection = document.getElementById('past-events-section');
  const pastList    = document.getElementById('past-events-list');
  if (past.length > 0) {
    pastSection.style.display = '';
    pastList.innerHTML = past.map(e => renderEventCard(e, true)).join('');
  }
}

function setupMobileMenu() {
  const header = document.querySelector('.site-header');
  const btn    = document.querySelector('.hamburger-btn');
  if (!header || !btn) return;
  btn.addEventListener('click', () => {
    const open = header.classList.toggle('menu-open');
    btn.textContent = open ? '✕' : '☰';
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    header.querySelector('.mobile-nav-menu')?.setAttribute('aria-hidden', open ? 'false' : 'true');
  });
  header.querySelectorAll('.mobile-nav-menu a').forEach(a => {
    a.addEventListener('click', () => {
      header.classList.remove('menu-open');
      btn.textContent = '☰';
      btn.setAttribute('aria-expanded', 'false');
      header.querySelector('.mobile-nav-menu')?.setAttribute('aria-hidden', 'true');
    });
  });
}

function setupPastToggle() {
  const btn  = document.getElementById('past-events-toggle');
  const list = document.getElementById('past-events-list');
  if (!btn || !list) return;
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    btn.textContent = expanded ? 'Show past events ▾' : 'Hide past events ▴';
    list.classList.toggle('past-events-collapsed', expanded);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupMobileMenu();
  setupPastToggle();
  loadEvents().catch(err => {
    console.error('Events load error:', err);
    document.getElementById('upcoming-events-list').innerHTML =
      '<p class="small-text">Unable to load events right now. Please try again later.</p>';
  });
});
