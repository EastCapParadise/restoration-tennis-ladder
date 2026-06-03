/* ============================================================
   Restoration Tennis Ladder — Match Photos Page
   Self-contained: includes its own Supabase client and lightbox.
   ============================================================ */

const SUPABASE_URL     = 'https://jntspohwzkugcuisoofm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CgGyn2sReCxWz6Li9QnWnw_kC-8CgVO';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function firstName(name) {
  return (name || '').trim().split(' ')[0] || name || '';
}

function safeDateText(d) {
  if (!d) return '';
  try {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (_) { return d; }
}

// ── Lightbox ─────────────────────────────────────────────────────────────────

function openLightbox(url) {
  const old = document.getElementById('photos-lightbox');
  if (old) old.remove();

  const box = document.createElement('div');
  box.id = 'photos-lightbox';
  box.className = 'photo-lightbox';
  box.innerHTML = `
    <button class="photo-lightbox-close" aria-label="Close">✕</button>
    <img class="photo-lightbox-img" src="${esc(url)}" alt="Match photo">
  `;
  document.body.appendChild(box);
  requestAnimationFrame(() => box.classList.add('visible'));

  const close = () => { box.classList.remove('visible'); setTimeout(() => box.remove(), 200); };
  box.querySelector('.photo-lightbox-close').addEventListener('click', (e) => { e.stopPropagation(); close(); });
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function renderSkeleton() {
  const items = Array.from({ length: 6 }, () => `
    <div class="skeleton-photo">
      <div class="skeleton-photo-img"></div>
      <div class="skeleton-photo-cap">
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
      </div>
    </div>
  `).join('');
  return `<div class="photos-skeleton">${items}</div>`;
}

// ── Main load ─────────────────────────────────────────────────────────────────

async function loadPhotos() {
  const container = document.getElementById('photos-container');
  const meta      = document.getElementById('photos-meta');
  if (!container) return;

  container.innerHTML = renderSkeleton();

  try {
    // Fetch match photos and standalone library photos in parallel
    const [matchRes, libRes] = await Promise.all([
      sb.from('matches')
        .select(`id, date_played, match_type, winner_team, score_text,
          team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id,
          photo_url`)
        .not('photo_url', 'is', null)
        .order('date_played', { ascending: false })
        .order('created_at', { ascending: false }),
      sb.from('photos')
        .select('id, photo_url, caption, event_type, taken_at')
        .order('taken_at', { ascending: false, nullsFirst: false })
        .order('uploaded_at', { ascending: false }),
    ]);

    if (matchRes.error) throw matchRes.error;

    const photosMatches = (matchRes.data || []).filter(m => m.photo_url);
    const libPhotos     = libRes.error ? [] : (libRes.data || []);

    if (!photosMatches.length && !libPhotos.length) {
      if (meta) meta.textContent = '';
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:#66736c;">
          <div style="font-size:48px;margin-bottom:16px;">📷</div>
          <p style="font-size:16px;font-weight:600;margin-bottom:8px;">No match photos yet</p>
          <p style="font-size:14px;">Be the first to add one after your next match!</p>
        </div>
      `;
      return;
    }

    // Resolve player names for match photos
    const playerIds = new Set();
    photosMatches.forEach(m => {
      [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id]
        .filter(Boolean).forEach(id => playerIds.add(id));
    });

    const playerMap = {};
    if (playerIds.size > 0) {
      const { data: players } = await sb
        .from('players')
        .select('id, name')
        .in('id', [...playerIds]);
      (players || []).forEach(p => { playerMap[p.id] = p.name; });
    }

    const pName = id => playerMap[id] || '';
    const teamLabel = (ids) => ids.filter(Boolean).map(id => firstName(pName(id))).filter(Boolean).join(' & ');

    const totalCount = photosMatches.length + libPhotos.length;
    if (meta) {
      meta.textContent = `${totalCount} photo${totalCount === 1 ? '' : 's'}`;
    }

    // Build match photo cards
    const matchCards = photosMatches.map(m => {
      const wIds = (m.winner_team === 1
        ? [m.team1_player1_id, m.team1_player2_id]
        : [m.team2_player1_id, m.team2_player2_id]).filter(Boolean);
      const lIds = (m.winner_team === 1
        ? [m.team2_player1_id, m.team2_player2_id]
        : [m.team1_player1_id, m.team1_player2_id]).filter(Boolean);

      const winnerLabel = teamLabel(wIds);
      const loserLabel  = teamLabel(lIds);
      const playersLine = [winnerLabel, loserLabel].filter(Boolean).join(' def. ');

      let scoreText = '';
      if (m.score_text) {
        const sets = m.score_text.split(/,?\s+/);
        if (m.winner_team === 2) {
          scoreText = sets.map(s => { const [a, b] = s.split('-'); return `${b}-${a}`; }).join(', ');
        } else {
          scoreText = sets.join(', ');
        }
      }

      return `
        <div class="photo-grid-card" data-photo-url="${esc(m.photo_url)}">
          <img class="photo-grid-img" src="${esc(m.photo_url)}" alt="Match photo" loading="lazy">
          <div class="photo-grid-caption">
            ${playersLine ? `<div class="photo-grid-players">${esc(playersLine)}</div>` : ''}
            ${scoreText  ? `<div class="photo-grid-score">${esc(scoreText)}</div>` : ''}
            <div class="photo-grid-date">${esc(safeDateText(m.date_played))}</div>
          </div>
        </div>
      `;
    });

    // Build standalone library photo cards
    const libCards = libPhotos.map(p => {
      const eventLabel = p.event_type
        ? p.event_type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : null;
      return `
        <div class="photo-grid-card" data-photo-url="${esc(p.photo_url)}">
          <img class="photo-grid-img" src="${esc(p.photo_url)}" alt="${esc(p.caption || 'Photo')}" loading="lazy">
          <div class="photo-grid-caption">
            ${p.caption ? `<div class="photo-grid-players">${esc(p.caption)}</div>` : ''}
            ${eventLabel ? `<div class="photo-grid-score photo-event-badge">${esc(eventLabel)}</div>` : ''}
            ${p.taken_at ? `<div class="photo-grid-date">${esc(safeDateText(p.taken_at))}</div>` : ''}
          </div>
        </div>
      `;
    });

    container.innerHTML = `<div class="photos-grid">${[...matchCards, ...libCards].join('')}</div>`;

    // Lightbox delegation
    container.addEventListener('click', (e) => {
      const card = e.target.closest('.photo-grid-card');
      if (card && card.dataset.photoUrl) openLightbox(card.dataset.photoUrl);
    });

  } catch (err) {
    console.error('Photos page error:', err);
    container.innerHTML = '<p style="color:#dc2626">Error loading photos. Please try again.</p>';
  }
}

document.addEventListener('DOMContentLoaded', loadPhotos);
