/* ============================================================
   Restoration Tennis Ladder — Admin Dashboard
   Self-contained: does NOT depend on app.js
   ============================================================ */

'use strict';

const SUPABASE_URL     = 'https://jntspohwzkugcuisoofm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CgGyn2sReCxWz6Li9QnWnw_kC-8CgVO';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_PASSWORD   = 'RestoAdmin';
const ADMIN_SESSION    = 'rtl_admin_access';

// ─── Tiny helpers ────────────────────────────────────────────────────────────

function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function roundToTwo(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}


function fmt(n) {
  const x = Number(n ?? 0);
  return (x >= 0 ? '+' : '') + x.toFixed(2);
}

function setStatus(elId, msg, type = '') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.className = 'adm-status-text' + (type ? ` ${type}` : '');
}

// ─── Mobile hamburger (mirrors app.js) ───────────────────────────────────────

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

// ─── Password gate ────────────────────────────────────────────────────────────

function setupAdminLogin() {
  const form    = document.getElementById('admin-login-form');
  const input   = document.getElementById('admin-password');
  const msgEl   = document.getElementById('admin-login-message');
  const overlay = document.getElementById('admin-login-overlay');
  const page    = document.getElementById('admin-page');

  function grantAccess() {
    sessionStorage.setItem(ADMIN_SESSION, 'granted');
    overlay.classList.add('hidden');
    page.classList.remove('hidden');
    loadAll();
  }

  if (sessionStorage.getItem(ADMIN_SESSION) === 'granted') {
    grantAccess();
    return;
  }

  input?.focus();

  form?.addEventListener('submit', e => {
    e.preventDefault();
    if (input.value.trim() !== ADMIN_PASSWORD) {
      msgEl.textContent = 'Incorrect password.';
      input.value = '';
      input.focus();
      return;
    }
    msgEl.textContent = '';
    grantAccess();
  });
}

// ─── Scoring engine (mirrors app.js calculateMatchScoring exactly) ────────────

function isMixedGender(team1, team2) {
  const all = [...team1, ...team2].filter(Boolean);
  return all.some(p => p.sex === 'Man') && all.some(p => p.sex === 'Woman');
}

function avgAdjRating(players, adj) {
  const v = players.filter(Boolean);
  if (!v.length) return 0;
  return v.reduce((s, p) => {
    const base = Number(p.dynamic_rating ?? p.display_rating ?? 0);
    return s + (adj && p.sex === 'Man' ? base + 0.5 : base);
  }, 0) / v.length;
}

// K three-tier: matches 1-3 = 0.15, matches 4-8 = 0.10, matches 9+ = 0.06
function playerK(player) {
  const mp = player?.matches_played ?? 0;
  if (mp < 3) return 0.15;
  if (mp < 8) return 0.10;
  return 0.06;
}

function scoreMatch({ winnerTeam, team1Players, team2Players,
  team1StandardGames, team2StandardGames, has3Set = false }) {

  const mixed = isMixedGender(team1Players, team2Players);
  const t1avg = avgAdjRating(team1Players, mixed);
  const t2avg = avgAdjRating(team2Players, mixed);

  const wAvg = winnerTeam === 1 ? t1avg : t2avg;
  const lAvg = winnerTeam === 1 ? t2avg : t1avg;
  const wStd = winnerTeam === 1 ? team1StandardGames : team2StandardGames;
  const lStd = winnerTeam === 1 ? team2StandardGames : team1StandardGames;

  // Expected spread = gapMagnitude × 16, signed (+ if winner favourite, − if underdog)
  const gap = Math.min(Math.abs(wAvg - lAvg), 0.5);
  const expSpread = wAvg >= lAvg ? gap * 16 : -(gap * 16);
  const delta = (wStd - lStd) - expSpread;

  // Rating change: RC = (delta / 24) × K × 0.85, signed per winner/loser
  function rc(player, isWinner) {
    const raw = roundToTwo((delta / 24) * playerK(player) * 0.85);
    const val = Number.isFinite(raw) ? raw : 0;
    return isWinner ? val : -val;
  }

  const rc1 = rc(team1Players[0], winnerTeam === 1);
  const rc2 = rc(team1Players[1], winnerTeam === 1);
  const rc3 = rc(team2Players[0], winnerTeam === 2);
  const rc4 = rc(team2Players[1], winnerTeam === 2);

  // Winner points: 11-base, delta × 0.29, clamped [8, 18]
  let wPts = Math.max(8, Math.min(18, Math.round(11 + delta * 0.29)));

  // Loser points — expectation-adjusted formula
  const loserWasFav = lAvg > wAvg;
  const loserWasUnd = lAvg < wAvg;
  let lPts;
  if (lStd === 0) {
    lPts = Math.max(5, Math.round(4 + gap * 4));
  } else {
    const gamesComp  = lStd * 0.6;
    const expectComp = loserWasFav ? -(gap * 6)
                     : loserWasUnd ? +(gap * 4)
                     : 0;
    lPts = Math.max(5, Math.round(4 + gamesComp + expectComp));
  }

  // Enforce minimum 2-point gap between winner and loser
  lPts = Math.min(lPts, wPts - 2);
  lPts = Math.max(5, lPts);
  if (wPts - lPts < 2) wPts = lPts + 2;

  // 3-set bonus: winner +2; loser +1 or +2 based on rating relationship
  if (has3Set) {
    wPts += 2;
    if (gap < 0.1)        lPts += 2;  // even match
    else if (lAvg > wAvg) lPts += 1;  // loser was favourite
    else                  lPts += 2;  // loser was underdog
    if (wPts - lPts < 2) wPts = lPts + 2;
  }

  const lp = winnerTeam === 1
    ? [wPts, wPts, lPts, lPts]
    : [lPts, lPts, wPts, wPts];

  return {
    team1AvgRating: roundToTwo(t1avg),
    team2AvgRating: roundToTwo(t2avg),
    ratingChanges: [rc1, rc2, rc3, rc4],
    ladderPoints: lp,
  };
}

// ─── Full retroactive recalculation ──────────────────────────────────────────

async function runRecalculation(log) {
  log('header', '=== Starting Full Recalculation ===');

  // ─── Load players ────────────────────────────────────────────────────────────
  const { data: players, error: pErr } = await db
    .from('players')
    .select('id, name, sex, initial_rating, display_rating, dynamic_rating, ladder_points, wins, losses, games_won, games_lost, matches_played, rating');
  if (pErr) return { success: false, error: pErr.message };

  const oldStats = {};
  const state = {};

  for (const p of players) {
    oldStats[p.id] = {
      ladder_points: Number(p.ladder_points ?? 0),
      dynamic_rating: Number(p.dynamic_rating ?? p.initial_rating ?? 0),
      wins: Number(p.wins ?? 0),
      losses: Number(p.losses ?? 0),
    };
    const ir = Number(p.initial_rating ?? p.display_rating ?? 0);
    state[p.id] = {
      id: p.id, name: p.name, sex: p.sex,
      dynamic_rating: ir, display_rating: ir, rating: Math.round(ir * 100),
      ladder_points: 0, wins: 0, losses: 0,
      games_won: 0, games_lost: 0, matches_played: 0,
    };
  }

  log('ok', `Loaded ${players.length} players — stats reset to initial rating.`);

  // STEP 1 (cont.) — Derive mini and retired stats fresh from match records
  const [miniMatchRes, retiredMatchRes] = await Promise.all([
    db.from('matches')
      .select('team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, mini_games_won_p1, mini_games_won_p3, ladder_points_p1, ladder_points_p3')
      .eq('match_type', 'mini'),
    db.from('matches')
      .select('team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id')
      .eq('match_type', 'retired'),
  ]);

  if (miniMatchRes.error) return { success: false, error: `Mini match fetch: ${miniMatchRes.error.message}` };
  if (retiredMatchRes.error) return { success: false, error: `Retired match fetch: ${retiredMatchRes.error.message}` };

  // Per-player mini stats derived entirely from match records (never from player table snapshot)
  const miniStats = {};
  for (const m of miniMatchRes.data || []) {
    const gWon1 = Number(m.mini_games_won_p1 ?? 0); // team1 games won
    const gWon3 = Number(m.mini_games_won_p3 ?? 0); // team2 games won
    const pts1  = Number(m.ladder_points_p1  ?? 0);
    const pts3  = Number(m.ladder_points_p3  ?? 0);
    const team1 = [m.team1_player1_id, m.team1_player2_id].filter(Boolean);
    const team2 = [m.team2_player1_id, m.team2_player2_id].filter(Boolean);
    for (const pid of team1) {
      if (!miniStats[pid]) miniStats[pid] = { won: 0, lost: 0, points: 0 };
      miniStats[pid].won    += gWon1;
      miniStats[pid].lost   += gWon3;
      miniStats[pid].points += pts1;
    }
    for (const pid of team2) {
      if (!miniStats[pid]) miniStats[pid] = { won: 0, lost: 0, points: 0 };
      miniStats[pid].won    += gWon3;
      miniStats[pid].lost   += gWon1;
      miniStats[pid].points += pts3;
    }
  }

  const retiredPts   = {};
  const retiredCount = {};
  for (const m of retiredMatchRes.data || []) {
    for (const pid of [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id].filter(Boolean)) {
      retiredPts[pid]   = (retiredPts[pid]   || 0) + 5;
      retiredCount[pid] = (retiredCount[pid] || 0) + 1;
    }
  }

  log('ok', `Derived mini stats for ${Object.keys(miniStats).length} player(s), retired pts for ${Object.keys(retiredPts).length} player(s).`);

  // Load matches
  const { data: matches, error: mErr } = await db
    .from('matches')
    .select(`id, match_type, winner_team, date_played, created_at,
      team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id,
      set1_team1_games, set1_team2_games, set2_team1_games, set2_team2_games,
      set3_team1_games, set3_team2_games`)
    .order('date_played', { ascending: true })
    .order('created_at', { ascending: true });
  if (mErr) return { success: false, error: mErr.message };

  log('ok', `Loaded ${matches.length} matches to replay.`);

  // Replay each match — skip mini-games and retired matches (they don't affect ratings)
  for (const m of matches) {
    if (m.match_type === 'mini' || m.match_type === 'retired') continue;

    const gP = id => id ? state[id] ?? null : null;
    const t1 = [gP(m.team1_player1_id), gP(m.team1_player2_id)];
    const t2 = [gP(m.team2_player1_id), gP(m.team2_player2_id)];

    const t1Std  = Number(m.set1_team1_games ?? 0) + Number(m.set2_team1_games ?? 0);
    const t2Std  = Number(m.set1_team2_games ?? 0) + Number(m.set2_team2_games ?? 0);
    const has3Set = m.set3_team1_games != null && m.set3_team2_games != null;

    const s = scoreMatch({
      winnerTeam: m.winner_team,
      team1Players: t1, team2Players: t2,
      team1StandardGames: t1Std, team2StandardGames: t2Std,
      has3Set,
    });

    const payload = {
      team1_avg_rating: s.team1AvgRating,
      team2_avg_rating: s.team2AvgRating,
      rating_change_p1: s.ratingChanges[0],
      rating_change_p2: m.team1_player2_id ? s.ratingChanges[1] : null,
      rating_change_p3: s.ratingChanges[2],
      rating_change_p4: m.team2_player2_id ? s.ratingChanges[3] : null,
      ladder_points_p1: s.ladderPoints[0],
      ladder_points_p2: m.team1_player2_id ? s.ladderPoints[1] : null,
      ladder_points_p3: s.ladderPoints[2],
      ladder_points_p4: m.team2_player2_id ? s.ladderPoints[3] : null,
    };

    const { error: wErr } = await db.from('matches').update(payload).eq('id', m.id);
    if (wErr) return { success: false, error: `Match ${m.id}: ${wErr.message}` };

    // Verify write
    const { data: v } = await db.from('matches')
      .select('ladder_points_p1').eq('id', m.id).single();
    if (v?.ladder_points_p1 !== payload.ladder_points_p1) {
      return { success: false, error: `Verify failed for match ${m.id} — RLS may be blocking writes.` };
    }

    const n1 = state[m.team1_player1_id]?.name ?? '?';
    const n3 = state[m.team2_player1_id]?.name ?? '?';
    log('match', `  [${m.date_played}] ${n1} vs ${n3} ✓`);

    // Update in-memory state (matches_played read BEFORE increment for K-factor)
    const t1Won = m.winner_team === 1, t2Won = m.winner_team === 2;
    function applyUpd(player, rc, lp, won, ownStd, oppStd) {
      if (!player) return;
      const next = roundToTwo(player.dynamic_rating + rc);
      player.dynamic_rating = next;
      player.display_rating = next;
      player.rating = Math.round(next * 100);
      player.ladder_points += lp;
      player.wins  += won ? 1 : 0;
      player.losses += won ? 0 : 1;
      player.games_won  += ownStd;
      player.games_lost += oppStd;
      player.matches_played += 1;
    }
    applyUpd(t1[0], s.ratingChanges[0], s.ladderPoints[0], t1Won, t1Std, t2Std);
    applyUpd(t1[1], s.ratingChanges[1], s.ladderPoints[1], t1Won, t1Std, t2Std);
    applyUpd(t2[0], s.ratingChanges[2], s.ladderPoints[2], t2Won, t2Std, t1Std);
    applyUpd(t2[1], s.ratingChanges[3], s.ladderPoints[3], t2Won, t2Std, t1Std);
  }

  log('ok', 'All matches replayed and verified. Writing player stats...');

  // Write player stats
  for (const p of players) {
    const s = state[p.id];
    const { error } = await db.from('players').update({
      display_rating: s.display_rating,
      dynamic_rating: s.dynamic_rating,
      rating: s.rating,
      ladder_points: s.ladder_points,
      wins: s.wins,
      losses: s.losses,
      games_won: s.games_won,
      games_lost: s.games_lost,
      matches_played: s.matches_played,
    }).eq('id', p.id);
    if (error) log('error', `  ERROR player ${s.name}: ${error.message}`);
  }

  // STEP 3 — Write recalculated mini-game and retired stats back to each player
  log('header', '=== Writing Mini-Game and Retired Points ===');

  for (const p of players) {
    const mini       = miniStats[p.id] || { won: 0, lost: 0, points: 0 };
    const addRetired = retiredPts[p.id] || 0;
    const incomplete = retiredCount[p.id] || 0;

    if (mini.points === 0 && addRetired === 0 && mini.won === 0 && incomplete === 0) continue;

    const officialPts = state[p.id].ladder_points;
    const finalPts    = officialPts + mini.points + addRetired;

    const { error: rErr } = await db.from('players').update({
      ladder_points:      finalPts,
      mini_games_won:     mini.won,
      mini_games_lost:    mini.lost,
      mini_points:        mini.points,
      incomplete_matches: incomplete,
    }).eq('id', p.id);

    if (rErr) {
      log('error', `  ERROR writing mini/retired for ${p.name}: ${rErr.message}`);
      continue;
    }

    // Verified read
    const { data: verify } = await db.from('players').select('ladder_points').eq('id', p.id).single();
    if (verify?.ladder_points !== finalPts) {
      log('error', `  VERIFY FAILED for ${p.name} — expected ${finalPts}, got ${verify?.ladder_points}`);
    } else {
      const parts = [];
      if (officialPts) parts.push(`${officialPts} official`);
      if (mini.points) parts.push(`${mini.points} mini (${mini.won}W/${mini.lost}L)`);
      if (addRetired)  parts.push(`${addRetired} retired`);
      log('ok', `  ${p.name}: ${parts.join(' + ')} = ${finalPts} pts total (${incomplete} incomplete match${incomplete === 1 ? '' : 'es'})`);
    }

    // Keep in-memory state in sync for the summary below
    state[p.id].ladder_points = finalPts;
  }

  log('header', '=== Recalculation complete ===');

  // STEP 4 — Build change summary (includes mini/retired in final totals)
  const changes = players
    .filter(p => state[p.id].matches_played > 0 || (miniStats[p.id]?.points || 0) > 0 || (retiredPts[p.id] || 0) > 0)
    .sort((a, b) => state[b.id].ladder_points - state[a.id].ladder_points)
    .map(p => ({
      name:      state[p.id].name,
      newPts:    state[p.id].ladder_points,
      oldPts:    oldStats[p.id].ladder_points,
      newRating: state[p.id].dynamic_rating,
      oldRating: oldStats[p.id].dynamic_rating,
    }));

  return { success: true, changes };
}

// ─── Confirm modal (Promise-based) ────────────────────────────────────────────

function showConfirm(title, message) {
  return new Promise(resolve => {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-status').textContent = '';
    document.getElementById('confirm-modal').classList.remove('hidden');

    const yes = document.getElementById('confirm-yes');
    const no  = document.getElementById('confirm-no');

    function cleanup() {
      document.getElementById('confirm-modal').classList.add('hidden');
      yes.removeEventListener('click', onYes);
      no.removeEventListener('click', onNo);
    }
    function onYes() { cleanup(); resolve(true); }
    function onNo()  { cleanup(); resolve(false); }

    yes.addEventListener('click', onYes);
    no.addEventListener('click', onNo);
  });
}

// ─── Section 1: Match Management ─────────────────────────────────────────────

let allMatches = [];
let playerNameMap = {};

async function loadMatches() {
  setStatus('match-mgmt-status', 'Loading matches…');
  const tbody = document.getElementById('admin-match-body');

  const [matchRes, playerRes] = await Promise.all([
    db.from('matches')
      .select(`id, date_played, match_type, winner_team, score_text,
        team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id,
        ladder_points_p1, ladder_points_p2, ladder_points_p3, ladder_points_p4,
        set1_team1_games, set1_team2_games, set2_team1_games, set2_team2_games,
        set3_team1_games, set3_team2_games, photo_url`)
      .order('date_played', { ascending: false })
      .order('created_at', { ascending: false }),
    db.from('players').select('id, name'),
  ]);

  if (matchRes.error) { setStatus('match-mgmt-status', matchRes.error.message, 'error'); return; }

  allMatches = matchRes.data || [];
  playerNameMap = Object.fromEntries((playerRes.data || []).map(p => [p.id, p.name]));

  const pName = id => playerNameMap[id] || '?';

  tbody.innerHTML = allMatches.map(m => {
    const t1 = m.team1_player2_id
      ? `${pName(m.team1_player1_id)} &amp; ${pName(m.team1_player2_id)}`
      : esc(pName(m.team1_player1_id));
    const t2 = m.team2_player2_id
      ? `${pName(m.team2_player1_id)} &amp; ${pName(m.team2_player2_id)}`
      : esc(pName(m.team2_player1_id));

    const isRetired = m.match_type === 'retired';
    const winnerText = isRetired ? '—' : (m.winner_team === 1 ? t1 : t2);
    const wPts = isRetired ? `+5 each` : (m.winner_team === 1 ? (m.ladder_points_p1 ?? '—') : (m.ladder_points_p3 ?? '—'));
    const lPts = isRetired ? '' : (m.winner_team === 1 ? (m.ladder_points_p3 ?? '—') : (m.ladder_points_p1 ?? '—'));
    const typeBadge = isRetired
      ? `<span style="background:#f1f5f9;color:#475569;padding:2px 7px;border-radius:999px;font-size:11px;font-weight:600">🏳️ Incomplete</span>`
      : esc(m.match_type);

    return `<tr data-id="${m.id}">
      <td style="white-space:nowrap">${esc(m.date_played)}</td>
      <td>${t1} <span style="color:var(--muted)">vs</span> ${t2}</td>
      <td style="white-space:nowrap">${esc(m.score_text || '—')}</td>
      <td>${typeBadge}</td>
      <td>${winnerText}</td>
      <td style="white-space:nowrap"><strong>${wPts}</strong>${lPts ? ` / ${lPts}` : ''}</td>
      <td>
        <div class="adm-action-group">
          ${m.photo_url ? `<img src="${esc(m.photo_url)}" alt="Photo" style="width:40px;height:40px;object-fit:cover;border-radius:4px;vertical-align:middle;border:1px solid #dde6e0;">` : ''}
          ${!isRetired ? `<button class="adm-btn adm-btn-sm adm-btn-warning edit-score-btn" data-id="${m.id}">Edit Score</button>` : ''}
          ${isRetired ? `<button class="adm-btn adm-btn-sm adm-btn-primary complete-retired-btn" data-id="${m.id}">✅ Complete</button>` : ''}
          <button class="adm-btn adm-btn-sm adm-btn-danger void-btn" data-id="${m.id}">Void</button>
          ${m.photo_url ? `<button class="adm-btn adm-btn-sm adm-btn-secondary remove-photo-btn" data-id="${m.id}">🗑️ Photo</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="7">No matches found.</td></tr>';

  setStatus('match-mgmt-status', `${allMatches.length} matches loaded.`);

  // Delegate click events
  tbody.querySelectorAll('.void-btn').forEach(btn => {
    btn.addEventListener('click', () => voidMatch(Number(btn.dataset.id)));
  });
  tbody.querySelectorAll('.edit-score-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditScore(Number(btn.dataset.id)));
  });
  tbody.querySelectorAll('.remove-photo-btn').forEach(btn => {
    btn.addEventListener('click', () => removeMatchPhoto(Number(btn.dataset.id)));
  });
  tbody.querySelectorAll('.complete-retired-btn').forEach(btn => {
    btn.addEventListener('click', () => adminCompleteRetiredMatch(Number(btn.dataset.id)));
  });
}

async function removeMatchPhoto(matchId) {
  const match = allMatches.find(m => m.id === matchId);
  if (!match || !match.photo_url) return;

  const confirmed = await showConfirm(
    'Remove Photo',
    'Remove this photo? The match result will remain.'
  );
  if (!confirmed) return;

  setStatus('match-mgmt-status', 'Removing photo…');
  try {
    // Extract path within the bucket from the public URL
    const url  = new URL(match.photo_url);
    const pfx  = '/storage/v1/object/public/match-photos/';
    const path = url.pathname.startsWith(pfx) ? url.pathname.slice(pfx.length) : null;
    if (path) {
      const { error: stErr } = await db.storage.from('match-photos').remove([path]);
      if (stErr) console.warn('Storage remove error:', stErr.message);
    }
    const { error: dbErr } = await db.from('matches').update({ photo_url: null }).eq('id', matchId);
    if (dbErr) throw dbErr;
    setStatus('match-mgmt-status', 'Photo removed.');
    await loadMatches();
  } catch (err) {
    setStatus('match-mgmt-status', `Error: ${err.message}`, 'error');
  }
}

async function voidMatch(matchId) {
  const match = allMatches.find(m => m.id === matchId);
  if (!match) return;

  const n1 = playerNameMap[match.team1_player1_id] || '?';
  const n3 = playerNameMap[match.team2_player1_id] || '?';

  // Retired matches: void without recalculation — just reverse participation points
  if (match.match_type === 'retired') {
    const confirmed = await showConfirm(
      'Void Incomplete Match',
      `Void the incomplete match: ${n1} vs ${n3} (${match.date_played})?\n\nThis removes the 5 participation points from each player and deletes the record. No recalculation needed.`
    );
    if (!confirmed) return;
    setStatus('match-mgmt-status', 'Voiding incomplete match…');

    const playerIds = [match.team1_player1_id, match.team1_player2_id, match.team2_player1_id, match.team2_player2_id].filter(Boolean);
    const { data: players } = await db.from('players').select('id, ladder_points, incomplete_matches').in('id', playerIds);

    const { error: delErr } = await db.from('matches').delete().eq('id', matchId);
    if (delErr) { setStatus('match-mgmt-status', `Delete failed: ${delErr.message}`, 'error'); return; }

    for (const p of (players || [])) {
      await db.from('players').update({
        ladder_points:      Math.max(0, (p.ladder_points || 0) - 5),
        incomplete_matches: Math.max(0, (p.incomplete_matches || 0) - 1),
      }).eq('id', p.id);
    }

    setStatus('match-mgmt-status', 'Incomplete match voided and participation points removed.');
    await loadMatches();
    await loadPlayers();
    return;
  }

  const confirmed = await showConfirm(
    'Void Match',
    `Void the match: ${n1} vs ${n3} (${match.date_played}, ${match.score_text})?\n\nThis will delete it permanently and trigger a full recalculation.`
  );
  if (!confirmed) return;

  setStatus('match-mgmt-status', 'Deleting match…');

  const { error } = await db.from('matches').delete().eq('id', matchId);
  if (error) {
    setStatus('match-mgmt-status', `Delete failed: ${error.message}`, 'error');
    return;
  }

  setStatus('match-mgmt-status', 'Match deleted. Running recalculation…');
  await runAndShowRecalc('match-mgmt-status');
  await loadMatches();
  await loadPlayers();
}

async function adminCompleteRetiredMatch(matchId) {
  const match = allMatches.find(m => m.id === matchId);
  if (!match || match.match_type !== 'retired') return;

  const retiredData = {
    id: match.id,
    team1_player1_id: match.team1_player1_id,
    team1_player2_id: match.team1_player2_id,
    team2_player1_id: match.team2_player1_id,
    team2_player2_id: match.team2_player2_id,
    submitted_by_name: match.submitted_by_name,
    match_notes: match.match_notes,
  };

  // Inject the app.js modal if we're on the same page context
  if (typeof openCompleteMatchModal === 'function') {
    openCompleteMatchModal(matchId, retiredData);
  } else {
    alert('Please use the Match History page to complete this match.');
  }
}

// ─── Edit Score Modal ─────────────────────────────────────────────────────────

let editingMatchId = null;

function openEditScore(matchId) {
  const m = allMatches.find(x => x.id === matchId);
  if (!m) return;
  editingMatchId = matchId;

  const n1 = playerNameMap[m.team1_player1_id] || '?';
  const n3 = playerNameMap[m.team2_player1_id] || '?';
  document.getElementById('edit-score-meta').textContent =
    `${m.date_played} — ${n1} vs ${n3} (${m.match_type})`;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val !== null && val !== undefined ? val : '';
  };

  set('es-s1t1', m.set1_team1_games);
  set('es-s1t2', m.set1_team2_games);
  set('es-s2t1', m.set2_team1_games);
  set('es-s2t2', m.set2_team2_games);
  set('es-s3t1', m.set3_team1_games);
  set('es-s3t2', m.set3_team2_games);

  document.getElementById('edit-score-status').textContent = '';
  document.getElementById('edit-score-modal').classList.remove('hidden');
}

function closeEditScore() {
  document.getElementById('edit-score-modal').classList.add('hidden');
  editingMatchId = null;
}

async function saveEditScore() {
  if (!editingMatchId) return;

  const g = id => {
    const v = document.getElementById(id)?.value.trim();
    return v === '' || v === undefined ? null : Number(v);
  };

  const s1t1 = g('es-s1t1'), s1t2 = g('es-s1t2');
  const s2t1 = g('es-s2t1'), s2t2 = g('es-s2t2');
  const s3t1 = g('es-s3t1'), s3t2 = g('es-s3t2');

  if (s1t1 === null || s1t2 === null || s2t1 === null || s2t2 === null) {
    document.getElementById('edit-score-status').textContent = 'Sets 1 and 2 are required.';
    return;
  }

  const parts = [`${s1t1}-${s1t2}`, `${s2t1}-${s2t2}`];
  if (s3t1 !== null && s3t2 !== null) parts.push(`${s3t1}-${s3t2}`);
  const scoreText = parts.join(', ');

  const statusEl = document.getElementById('edit-score-status');
  statusEl.textContent = 'Saving score…';

  const payload = {
    score_text: scoreText,
    set1_team1_games: s1t1, set1_team2_games: s1t2,
    set2_team1_games: s2t1, set2_team2_games: s2t2,
    set3_team1_games: s3t1, set3_team2_games: s3t2,
    team1_total_games: s1t1 + s2t1,
    team2_total_games: s1t2 + s2t2,
  };

  const { error } = await db.from('matches').update(payload).eq('id', editingMatchId);
  if (error) {
    statusEl.textContent = `Save failed: ${error.message}`;
    return;
  }

  statusEl.textContent = 'Score saved. Running recalculation…';
  closeEditScore();
  setStatus('match-mgmt-status', 'Score updated. Recalculating…');
  await runAndShowRecalc('match-mgmt-status');
  await loadMatches();
  await loadPlayers();
}

// ─── Section 2: Player Management ────────────────────────────────────────────

let allPlayers = [];

async function loadPlayers() {
  setStatus('player-mgmt-status', 'Loading players…');
  const tbody = document.getElementById('admin-player-body');

  const { data, error } = await db
    .from('players')
    .select('id, name, dynamic_rating, initial_rating, wins, losses, ladder_points, matches_played, sex, area')
    .order('ladder_points', { ascending: false });

  if (error) { setStatus('player-mgmt-status', error.message, 'error'); return; }

  allPlayers = data || [];

  tbody.innerHTML = allPlayers.map(p => `
    <tr data-id="${p.id}">
      <td>${esc(p.name)}</td>
      <td class="num">${Number(p.dynamic_rating ?? 0).toFixed(2)}</td>
      <td class="num">${Number(p.initial_rating ?? 0).toFixed(2)}</td>
      <td class="num">${p.wins ?? 0}</td>
      <td class="num">${p.losses ?? 0}</td>
      <td class="num">${p.ladder_points ?? 0}</td>
      <td class="num">${p.matches_played ?? 0}</td>
      <td>
        <div class="adm-action-group">
          <button class="adm-btn adm-btn-sm adm-btn-primary adj-rating-btn" data-id="${p.id}">Adjust Rating</button>
          <button class="adm-btn adm-btn-sm adm-btn-danger remove-player-btn" data-id="${p.id}">Remove</button>
        </div>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="8">No players found.</td></tr>';

  setStatus('player-mgmt-status', `${allPlayers.length} players loaded.`);

  tbody.querySelectorAll('.adj-rating-btn').forEach(btn => {
    btn.addEventListener('click', () => openAdjustRating(Number(btn.dataset.id)));
  });
  tbody.querySelectorAll('.remove-player-btn').forEach(btn => {
    btn.addEventListener('click', () => removePlayer(Number(btn.dataset.id)));
  });
}

// ── Adjust Rating Modal ────────────────────────────────────────────────────────

let adjustingPlayerId = null;

function openAdjustRating(playerId) {
  const p = allPlayers.find(x => x.id === playerId);
  if (!p) return;
  adjustingPlayerId = playerId;

  document.getElementById('adjust-rating-name').textContent = `Player: ${p.name}`;
  document.getElementById('ar-current-display').textContent =
    Number(p.dynamic_rating ?? 0).toFixed(2);
  document.getElementById('ar-rating').value = Number(p.dynamic_rating ?? 0).toFixed(2);
  document.getElementById('ar-note').value = '';
  document.getElementById('adjust-rating-status').textContent = '';
  document.getElementById('adjust-rating-modal').classList.remove('hidden');
}

function closeAdjustRating() {
  document.getElementById('adjust-rating-modal').classList.add('hidden');
  adjustingPlayerId = null;
}

async function saveRatingAdjustment() {
  if (!adjustingPlayerId) return;

  const newRating = Number(document.getElementById('ar-rating').value);
  if (!Number.isFinite(newRating) || newRating < 2.0 || newRating > 5.5) {
    document.getElementById('adjust-rating-status').textContent =
      'Enter a valid rating between 2.0 and 5.5.';
    return;
  }

  const statusEl = document.getElementById('adjust-rating-status');
  statusEl.textContent = 'Saving…';

  const rounded = Math.round(newRating * 100) / 100;

  const { error } = await db.from('players').update({
    dynamic_rating: rounded,
    display_rating: rounded,
    rating: Math.round(rounded * 100),
  }).eq('id', adjustingPlayerId);

  if (error) {
    statusEl.textContent = `Failed: ${error.message}`;
    return;
  }

  closeAdjustRating();
  setStatus('player-mgmt-status', 'Rating updated successfully.', 'success');
  await loadPlayers();
}

// ── Remove Player ──────────────────────────────────────────────────────────────

async function removePlayer(playerId) {
  const p = allPlayers.find(x => x.id === playerId);
  if (!p) return;

  if ((p.matches_played ?? 0) > 0) {
    await showConfirm(
      'Cannot Remove Player',
      `${p.name} has ${p.matches_played} match(es) recorded. Remove their matches first before deleting the player.`
    );
    return;
  }

  const confirmed = await showConfirm(
    'Remove Player',
    `Permanently remove ${p.name} from the ladder? This cannot be undone.`
  );
  if (!confirmed) return;

  const { error } = await db.from('players').delete().eq('id', playerId);
  if (error) {
    setStatus('player-mgmt-status', `Delete failed: ${error.message}`, 'error');
    return;
  }

  setStatus('player-mgmt-status', `${p.name} removed.`, 'success');
  await loadPlayers();
}

// ─── Section 3: Event Management ─────────────────────────────────────────────

// Convert "19:30" (from <input type="time">) → "7:30 PM"
function formatTimeTo12h(val) {
  const [h, m] = val.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

async function loadAdminEvents() {
  const tbody = document.getElementById('admin-events-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';

  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await db
    .from('events')
    .select('id, title, event_type, event_date, start_time, end_time, location_name, courts')
    .gte('event_date', today)
    .order('event_date', { ascending: true });

  if (error) { tbody.innerHTML = `<tr><td colspan="6">Error: ${esc(error.message)}</td></tr>`; return; }
  if (!data?.length) { tbody.innerHTML = '<tr><td colspan="6">No upcoming events.</td></tr>'; return; }

  tbody.innerHTML = data.map(ev => {
    const d = new Date(ev.event_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `<tr>
      <td>${esc(d)}</td>
      <td>${esc(ev.title)}</td>
      <td>${esc(ev.event_type)}</td>
      <td>${esc(ev.location_name)}</td>
      <td class="num">${ev.courts ?? '—'}</td>
      <td><button class="adm-btn adm-btn-sm adm-btn-danger" data-delete-event="${esc(ev.id)}">Delete</button></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-delete-event]').forEach(btn => {
    btn.addEventListener('click', () => deleteEvent(btn.dataset.deleteEvent));
  });
}

async function submitAddEvent(e) {
  e.preventDefault();
  const statusEl = document.getElementById('add-event-status');
  setStatus('add-event-status', 'Saving…');

  const title    = document.getElementById('ev-title').value.trim();
  const type     = document.getElementById('ev-type').value;
  const date     = document.getElementById('ev-date').value;
  const start    = document.getElementById('ev-start').value;
  const end      = document.getElementById('ev-end').value;
  const locName  = document.getElementById('ev-location-name').value.trim();
  const locAddr  = document.getElementById('ev-location-address').value.trim();
  const courts   = document.getElementById('ev-courts').value;
  const desc     = document.getElementById('ev-description').value.trim();

  if (!title || !type || !date || !start || !end || !locName || !locAddr) {
    setStatus('add-event-status', 'Please fill in all required fields.', 'error'); return;
  }

  const payload = {
    title,
    event_type:       type,
    event_date:       date,
    start_time:       formatTimeTo12h(start),
    end_time:         formatTimeTo12h(end),
    location_name:    locName,
    location_address: locAddr,
    courts:           courts ? parseInt(courts, 10) : null,
    description:      desc || null,
  };

  const { error } = await db.from('events').insert([payload]);
  if (error) { setStatus('add-event-status', `Failed: ${error.message}`, 'error'); return; }

  setStatus('add-event-status', 'Event added! It will appear on the Events page immediately.', 'success');
  document.getElementById('add-event-form').reset();
  await loadAdminEvents();
}

async function deleteEvent(id) {
  const confirmed = await showConfirm('Delete Event', 'Delete this event? This cannot be undone.');
  if (!confirmed) return;

  const { error } = await db.from('events').delete().eq('id', id);
  if (error) { setStatus('add-event-status', `Delete failed: ${error.message}`, 'error'); return; }

  setStatus('add-event-status', 'Event deleted.', 'success');
  await loadAdminEvents();
}

// ─── Section 4: Recent Signups ────────────────────────────────────────────────

async function loadRecentSignups() {
  const container = document.getElementById('recent-signups-content');

  const { data, error } = await db
    .from('players')
    .select('id, name, dynamic_rating, area, sex, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    // Fallback: order by id if created_at not available
    const { data: d2 } = await db
      .from('players')
      .select('id, name, dynamic_rating, area, sex')
      .order('id', { ascending: false })
      .limit(10);

    if (!d2?.length) { container.textContent = 'No players found.'; return; }

    container.innerHTML = `<div class="adm-signups-grid">${
      d2.map(p => `
        <div class="adm-signup-card">
          <div class="adm-signup-name">${esc(p.name)}</div>
          <div class="adm-signup-meta">${esc(p.sex)} · ${Number(p.dynamic_rating ?? 0).toFixed(2)} · ${esc(p.area || '—')}</div>
        </div>`).join('')
    }</div>`;
    return;
  }

  if (!data?.length) { container.textContent = 'No players found.'; return; }

  container.innerHTML = `<div class="adm-signups-grid">${
    data.map(p => {
      const joined = p.created_at
        ? new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—';
      return `
        <div class="adm-signup-card">
          <div class="adm-signup-name">${esc(p.name)}</div>
          <div class="adm-signup-meta">
            ${esc(p.sex)} · ${Number(p.dynamic_rating ?? 0).toFixed(2)} · ${esc(p.area || '—')}<br>
            Joined ${joined}
          </div>
        </div>`;
    }).join('')
  }</div>`;
}

// ─── Section 4: Season Tools ──────────────────────────────────────────────────

async function runAndShowRecalc(statusElId) {
  const logEl   = document.getElementById('recalc-log');
  const progress = document.getElementById('recalc-progress');
  const summary  = document.getElementById('recalc-summary');

  if (logEl)  { logEl.innerHTML = ''; }
  if (progress) { progress.classList.remove('hidden'); }
  if (summary)  { summary.classList.add('hidden'); }

  function log(type, msg) {
    if (!logEl) return;
    const div = document.createElement('div');
    div.className = type === 'header' ? 'log-header'
      : type === 'match' ? 'log-match'
      : type === 'error' ? 'log-error'
      : 'log-ok';
    div.textContent = msg;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
    if (statusElId) setStatus(statusElId, msg.replace(/=+/g, '').trim());
  }

  const result = await runRecalculation(log);

  if (!result.success) {
    log('error', `ERROR: ${result.error}`);
    if (statusElId) setStatus(statusElId, `Recalculation failed: ${result.error}`, 'error');
    return;
  }

  if (statusElId) setStatus(statusElId, 'Recalculation complete.', 'success');

  if (summary && result.changes?.length) {
    const rows = result.changes.map(c => {
      const pdiff = c.newPts - c.oldPts;
      const rdiff = roundToTwo(c.newRating - c.oldRating);
      const pCls  = pdiff > 0 ? 'adm-delta-up' : pdiff < 0 ? 'adm-delta-down' : 'adm-delta-same';
      const rCls  = rdiff > 0 ? 'adm-delta-up' : rdiff < 0 ? 'adm-delta-down' : 'adm-delta-same';
      return `<tr>
        <td>${esc(c.name)}</td>
        <td class="num">${c.oldPts} → <strong>${c.newPts}</strong></td>
        <td class="num ${pCls}">${pdiff >= 0 ? '+' : ''}${pdiff}</td>
        <td class="num">${c.oldRating.toFixed(2)} → <strong>${c.newRating.toFixed(2)}</strong></td>
        <td class="num ${rCls}">${rdiff >= 0 ? '+' : ''}${rdiff.toFixed(2)}</td>
      </tr>`;
    }).join('');

    summary.innerHTML = `
      <h3 style="margin:16px 0 8px;color:var(--green)">Recalculation Summary</h3>
      <div class="table-wrap">
        <table class="adm-summary-table">
          <thead><tr>
            <th>Player</th><th class="num">Points</th><th class="num">Δ Pts</th>
            <th class="num">Rating</th><th class="num">Δ Rating</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    summary.classList.remove('hidden');
  }
}

// ─── Photo Library ───────────────────────────────────────────────────────────

async function loadPhotoLibrary() {
  const grid = document.getElementById('admin-photo-grid');
  if (!grid) return;
  grid.innerHTML = '<p class="small-text">Loading…</p>';

  const { data: photos, error } = await db
    .from('photos')
    .select('id, photo_url, caption, event_type, taken_at')
    .order('uploaded_at', { ascending: false });

  if (error) { grid.innerHTML = `<p style="color:#dc2626">Error: ${esc(error.message)}</p>`; return; }
  if (!photos || !photos.length) { grid.innerHTML = '<p class="small-text">No library photos yet.</p>'; return; }

  grid.innerHTML = photos.map(p => `
    <div class="adm-photo-item" data-photo-id="${esc(String(p.id))}">
      <img src="${esc(p.photo_url)}" alt="${esc(p.caption || 'Photo')}" loading="lazy">
      ${p.caption ? `<div class="adm-photo-item-caption">${esc(p.caption)}</div>` : ''}
      <div class="adm-photo-item-meta">${esc(p.event_type || '')}${p.taken_at ? ' · ' + esc(p.taken_at) : ''}</div>
      <button class="adm-photo-item-delete" title="Delete photo" data-photo-id="${esc(String(p.id))}" data-photo-url="${esc(p.photo_url)}">✕</button>
    </div>
  `).join('');

  grid.addEventListener('click', async (e) => {
    const btn = e.target.closest('.adm-photo-item-delete');
    if (!btn) return;
    if (!confirm('Delete this photo permanently?')) return;
    await deleteLibraryPhoto(btn.dataset.photoId, btn.dataset.photoUrl);
  }, { once: true });
}

async function uploadLibraryPhoto() {
  const fileInput  = document.getElementById('lib-photo-file');
  const typeSelect = document.getElementById('lib-photo-type');
  const dateInput  = document.getElementById('lib-photo-date');
  const captionEl  = document.getElementById('lib-photo-caption');
  const status     = document.getElementById('lib-photo-status');
  const btn        = document.getElementById('lib-photo-upload-btn');

  const file = fileInput?.files?.[0];
  if (!file) { setStatus('lib-photo-status', 'Please choose a file.', 'error'); return; }
  if (file.size > 8 * 1024 * 1024) { setStatus('lib-photo-status', 'Photo must be under 8MB.', 'error'); return; }

  btn.disabled = true;
  setStatus('lib-photo-status', 'Uploading…');

  try {
    const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `standalone/${Date.now()}.${ext}`;
    const { error: upErr } = await db.storage
      .from('match-photos')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;

    const { data: urlData } = db.storage.from('match-photos').getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    const { error: dbErr } = await db.from('photos').insert({
      photo_url:  publicUrl,
      caption:    captionEl?.value.trim() || null,
      event_type: typeSelect?.value || 'other',
      taken_at:   dateInput?.value || null,
    });
    if (dbErr) throw dbErr;

    setStatus('lib-photo-status', 'Photo uploaded!', 'success');
    fileInput.value = '';
    if (captionEl) captionEl.value = '';
    await loadPhotoLibrary();
  } catch (err) {
    setStatus('lib-photo-status', `Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function deleteLibraryPhoto(photoId, photoUrl) {
  try {
    const urlObj = new URL(photoUrl);
    const pathMatch = urlObj.pathname.match(/\/object\/public\/match-photos\/(.*)/);
    if (pathMatch) {
      await db.storage.from('match-photos').remove([decodeURIComponent(pathMatch[1])]);
    }
    const { error } = await db.from('photos').delete().eq('id', photoId);
    if (error) throw error;
    await loadPhotoLibrary();
  } catch (err) {
    alert(`Failed to delete: ${err.message}`);
  }
}

// ─── Wire up all events ───────────────────────────────────────────────────────

// ─── Section 3b: Drop-In Game Log ────────────────────────────────────────────

async function loadDropInLog() {
  const tbody = document.getElementById('admin-dropin-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7">Loading…</td></tr>';

  const { data: matches, error: mErr } = await db
    .from('matches')
    .select(`id, date_played, team1_player1_id, team1_player2_id,
             team2_player1_id, team2_player2_id,
             mini_games_won_p1, mini_games_won_p3,
             ladder_points_p1, ladder_points_p2, ladder_points_p3, ladder_points_p4`)
    .eq('match_type', 'mini')
    .order('date_played', { ascending: false })
    .order('created_at',  { ascending: false });

  if (mErr) {
    tbody.innerHTML = `<tr><td colspan="7">Error: ${esc(mErr.message)}</td></tr>`;
    return;
  }
  if (!matches?.length) {
    tbody.innerHTML = '<tr><td colspan="7">No drop-in games recorded yet.</td></tr>';
    return;
  }

  // Fetch player names
  const ids = new Set();
  for (const m of matches)
    [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id]
      .forEach(id => { if (id) ids.add(id); });
  const { data: pData } = await db.from('players').select('id, name').in('id', [...ids]);
  const nameOf = {};
  (pData || []).forEach(p => { nameOf[p.id] = p.name; });

  const fn   = id => id ? (nameOf[id] || '?').split(' ')[0] : null;
  const tStr = (a, b) => [fn(a), fn(b)].filter(Boolean).join(' / ');
  const fmtD = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Duplicate detection: same date + any overlapping player ID
  const dupSet = new Set();
  for (let i = 0; i < matches.length; i++) {
    for (let j = i + 1; j < matches.length; j++) {
      const a = matches[i], b = matches[j];
      if (a.date_played !== b.date_played) continue;
      const aIds = [a.team1_player1_id, a.team1_player2_id, a.team2_player1_id, a.team2_player2_id].filter(Boolean);
      const bIds = new Set([b.team1_player1_id, b.team1_player2_id, b.team2_player1_id, b.team2_player2_id].filter(Boolean));
      if (aIds.some(id => bIds.has(id))) { dupSet.add(a.id); dupSet.add(b.id); }
    }
  }

  tbody.innerHTML = matches.map(m => {
    const sideA   = tStr(m.team1_player1_id, m.team1_player2_id);
    const sideB   = tStr(m.team2_player1_id, m.team2_player2_id);
    const score   = `${m.mini_games_won_p1 ?? 0}-${m.mini_games_won_p3 ?? 0}`;
    const ptsA    = m.ladder_points_p1 ?? 0;
    const ptsB    = m.ladder_points_p3 ?? 0;
    const ptsAStr = m.team1_player2_id ? `${ptsA} each` : String(ptsA);
    const ptsBStr = m.team2_player2_id ? `${ptsB} each` : String(ptsB);
    const isDup   = dupSet.has(m.id);
    const rowAttr = isDup ? ' style="background:#fffbeb;"' : '';
    const dupNote = isDup
      ? `<br><small style="color:#b45309;font-size:11px;">⚠️ Possible duplicate — same player on same date</small>`
      : '';
    return `<tr${rowAttr}>
      <td>${esc(fmtD(m.date_played))}</td>
      <td>${esc(sideA)}</td>
      <td>${esc(sideB)}</td>
      <td class="num">${esc(score)}</td>
      <td class="num">${esc(ptsAStr)}</td>
      <td class="num">${esc(ptsBStr)}</td>
      <td><button class="adm-btn adm-btn-sm adm-btn-danger dropin-del-btn" data-id="${m.id}">🗑️ Delete</button>${dupNote}</td>
    </tr>`;
  }).join('');

  // Wire delete buttons with the loaded matches array in closure
  tbody.querySelectorAll('.dropin-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteDropIn(btn.dataset.id, matches));
  });
}

async function deleteDropIn(matchId, matches) {
  const m = matches.find(x => String(x.id) === String(matchId));
  if (!m) return;

  const ok = await showConfirm('Delete Drop-In Result', 'Delete this drop-in result? Points will be recalculated.');
  if (!ok) return;

  const { error: dErr } = await db.from('matches').delete().eq('id', matchId);
  if (dErr) { setStatus('dropin-log-status', `Delete failed: ${dErr.message}`, 'error'); return; }

  // Subtract points from each involved player
  const slots = [
    { id: m.team1_player1_id, gw: m.mini_games_won_p1 ?? 0, gl: m.mini_games_won_p3 ?? 0, pts: m.ladder_points_p1 ?? 0 },
    { id: m.team1_player2_id, gw: m.mini_games_won_p1 ?? 0, gl: m.mini_games_won_p3 ?? 0, pts: m.ladder_points_p2 ?? m.ladder_points_p1 ?? 0 },
    { id: m.team2_player1_id, gw: m.mini_games_won_p3 ?? 0, gl: m.mini_games_won_p1 ?? 0, pts: m.ladder_points_p3 ?? 0 },
    { id: m.team2_player2_id, gw: m.mini_games_won_p3 ?? 0, gl: m.mini_games_won_p1 ?? 0, pts: m.ladder_points_p4 ?? m.ladder_points_p3 ?? 0 },
  ].filter(s => s.id);

  for (const s of slots) {
    const { data: p } = await db.from('players')
      .select('ladder_points, mini_games_won, mini_games_lost, mini_points')
      .eq('id', s.id).single();
    if (!p) continue;
    await db.from('players').update({
      ladder_points:   Math.max(0, (p.ladder_points   ?? 0) - s.pts),
      mini_games_won:  Math.max(0, (p.mini_games_won  ?? 0) - s.gw),
      mini_games_lost: Math.max(0, (p.mini_games_lost ?? 0) - s.gl),
      mini_points:     Math.max(0, (p.mini_points     ?? 0) - s.pts),
    }).eq('id', s.id);
  }

  setStatus('dropin-log-status', 'Drop-in result deleted and points adjusted.', 'success');
  await loadDropInLog();
}

function wireEvents() {
  // Match management
  document.getElementById('refresh-matches-btn')?.addEventListener('click', loadMatches);

  document.getElementById('edit-score-close')?.addEventListener('click', closeEditScore);
  document.getElementById('edit-score-cancel')?.addEventListener('click', closeEditScore);
  document.getElementById('edit-score-save')?.addEventListener('click', saveEditScore);

  // Player management
  document.getElementById('refresh-players-btn')?.addEventListener('click', loadPlayers);

  document.getElementById('adjust-rating-close')?.addEventListener('click', closeAdjustRating);
  document.getElementById('adjust-rating-cancel')?.addEventListener('click', closeAdjustRating);
  document.getElementById('adjust-rating-save')?.addEventListener('click', saveRatingAdjustment);

  // Close modals on overlay click
  document.getElementById('edit-score-modal')?.addEventListener('click', e => {
    if (e.target.id === 'edit-score-modal') closeEditScore();
  });
  document.getElementById('adjust-rating-modal')?.addEventListener('click', e => {
    if (e.target.id === 'adjust-rating-modal') closeAdjustRating();
  });

  // Drop-in log
  document.getElementById('refresh-dropin-btn')?.addEventListener('click', loadDropInLog);

  // Event management
  document.getElementById('add-event-form')?.addEventListener('submit', submitAddEvent);

  // Photo library
  document.getElementById('lib-photo-upload-btn')?.addEventListener('click', uploadLibraryPhoto);
  document.getElementById('refresh-photos-btn')?.addEventListener('click', loadPhotoLibrary);

  // Season tools
  document.getElementById('force-recalc-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('force-recalc-btn');
    btn.disabled = true;
    btn.textContent = 'Recalculating…';
    await runAndShowRecalc(null);
    await loadMatches();
    await loadPlayers();
    btn.disabled = false;
    btn.textContent = '⟳ Force Full Recalculation';
  });
}

// ─── Load everything ──────────────────────────────────────────────────────────

async function loadAll() {
  await Promise.all([loadMatches(), loadPlayers(), loadRecentSignups(), loadAdminEvents(), loadPhotoLibrary(), loadDropInLog()]);
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  setupMobileMenu();
  wireEvents();
  setupAdminLogin();
});
