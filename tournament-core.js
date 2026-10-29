/* =============================================================================
   TOURNAMENT CORE — End of Season Tournament
   -----------------------------------------------------------------------------
   Seeding, the match graph, and result resolution, shared by tournament.html
   (via app.js) and the admin panel (via admin.js). No DOM work and no Supabase
   client of its own: callers pass theirs to loadTournamentResults().

   Seeding reads the frozen Oct 12 standings snapshot in tournament-data.js,
   never live standings — the live ladder keeps accruing points through Nov 1
   and no longer moves this draw. Results come from the tournament_results
   table (entered in the admin panel), falling back to tournament-data.js.
   Nothing in here touches the rating model or the ladder matches table.
   ========================================================================== */

// Quarters of a 16-draw, in bracket render order: R16 slots 1&2 feed QF1,
// 3&4 feed QF2, and so on; QF1/QF2 feed SF1, QF3/QF4 feed SF2. Either list
// produces the same four quarterfinal groups (1,8,9,16 / 4,5,12,13 /
// 3,6,11,14 / 2,7,10,15) — they differ only in who meets whom in the R16.
const TOURNAMENT_R16_PAIRS = {
  // Standard seed protection: inside each quarter the top seed meets the
  // weakest and the quarter's #2 meets its #3.
  standard: [[1, 16], [8, 9], [5, 12], [4, 13], [3, 14], [6, 11], [7, 10], [2, 15]],
  // Group-order variant: the group's 1st seed meets its 2nd, 3rd meets its 4th.
  ordered: [[1, 8], [9, 16], [4, 5], [12, 13], [3, 6], [11, 14], [2, 7], [10, 15]]
};

// Seeds 1v4 and 2v3 in the semifinals of a four-player draw (Men's Club).
const TOURNAMENT_FOUR_PAIRS = [[1, 4], [2, 3]];

// Every match is one set (6 games, tiebreak at 6-6), finals included. Rounds
// of a 16-draw, outermost first, each with the config.deadlines key that
// governs it. A four-player draw uses just the last two.
const TOURNAMENT_ROUNDS = [
  { key: "r16", label: "Round of 16", abbrev: "R16", count: 8, deadlineKey: "groupPlay" },
  { key: "qf", label: "Quarterfinals", abbrev: "QF", count: 4, deadlineKey: "groupPlay" },
  { key: "sf", label: "Semifinals", abbrev: "SF", count: 2, deadlineKey: "semifinals" },
  { key: "f", label: "Final", abbrev: "F", count: 1, deadlineKey: null }
];

const TOURNAMENT_DEFAULT_RULES = {
  r16Pairing: "standard",
  clubPlayersInOpenDraw: false,
  menBackfillMode: "reseed",
  autoAdvanceAfterDeadline: false,
  minLadderPoints: 1,
  minMatchesPlayed: 0
};

/* ── Data-file accessors ─────────────────────────────────────────────────── */

function tournamentData() {
  return window.TOURNAMENT_DATA || {};
}

function tournamentConfig() {
  return tournamentData().config || {};
}

function tournamentRules() {
  return Object.assign({}, TOURNAMENT_DEFAULT_RULES, tournamentConfig().rules || {});
}

function tournamentDeadlines() {
  return tournamentConfig().deadlines || {};
}

function tournamentFinalsNight() {
  return tournamentConfig().finalsNight || {};
}

// A result saved from the admin panel wins over any entry for the same match
// id in tournament-data.js.
function tournamentMatchEntry(matchId) {
  return tournamentResultRows[matchId] || (tournamentData().matches || {})[matchId] || null;
}

/* ── Results: the tournament_results table ───────────────────────────────── */

// One row per match id, same fields as a tournament-data.js `matches` entry:
// winner (player name), score (winner-first), date, walkover, note.
const TOURNAMENT_RESULTS_TABLE = "tournament_results";

let tournamentResultRows = {};

async function loadTournamentResults(client) {
  const { data, error } = await client
    .from(TOURNAMENT_RESULTS_TABLE)
    .select("match_id, winner, score, date, walkover, note");
  tournamentResultRows = {};
  if (error) {
    console.warn("Tournament: couldn't read tournament_results; using tournament-data.js only.", error);
    return tournamentResultRows;
  }
  (data || []).forEach((row) => {
    tournamentResultRows[row.match_id] = {
      winner: row.winner || null,
      score: row.score || null,
      date: row.date || null,
      walkover: !!row.walkover,
      note: row.note || null
    };
  });
  return tournamentResultRows;
}

/* ── Small shared helpers ────────────────────────────────────────────────── */

function normalizeTournamentName(name) {
  return String(name || "").trim().toLowerCase();
}

function normalizeTournamentSex(sex) {
  const s = String(sex || "").trim().toLowerCase();
  if (s === "m" || s === "man" || s === "male") return "M";
  if (s === "f" || s === "w" || s === "woman" || s === "female") return "F";
  return null;
}

function tournamentPlayerRating(player) {
  const value = Number(player?.display_rating ?? player?.dynamic_rating);
  return Number.isFinite(value) ? value : 0;
}

// Scores in tournament-data.js are hand-typed and always WINNER-FIRST, so a
// loose "number-dash-number" scan is more forgiving than splitting on commas.
function tournamentScoreSets(score) {
  const sets = String(score || "").match(/\d+\s*-\s*\d+/g);
  if (!sets) return [];
  return sets.map((set) => set.split("-").map((n) => Number(n.trim())));
}

// One side's games per set, for the right-hand slot of a bracket card.
function tournamentSetGames(score, isWinner) {
  return tournamentScoreSets(score).map(([a, b]) => (isWinner ? a : b)).join(" ");
}

function tournamentDeadlinePassed(dateStr) {
  if (!dateStr) return false;
  const end = new Date(`${dateStr}T23:59:59`);
  return !Number.isNaN(end.getTime()) && Date.now() > end.getTime();
}

function formatTournamentDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTournamentDateLong(dateStr) {
  if (!dateStr) return "the snapshot date";
  const date = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(dateStr);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/* ── Seeding (frozen snapshot only) ──────────────────────────────────────── */

// Ladder points desc, SOS desc — the same tiebreak the main rankings use.
// Name asc is only a final stable fallback so the draw never reshuffles.
function sortByPointsThenSOSDesc(players) {
  return players.slice().sort((a, b) => {
    const points = (Number(b.ladder_points) || 0) - (Number(a.ladder_points) || 0);
    if (points !== 0) return points;
    const sos = (Number(b.sos) || 0) - (Number(a.sos) || 0);
    if (sos !== 0) return sos;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

// display_rating desc — orders the fixed Club roster into Club seeds 1-4.
// Points then SOS break a rating tie.
function sortByRatingDesc(players) {
  return players.slice().sort((a, b) => {
    const rating = tournamentPlayerRating(b) - tournamentPlayerRating(a);
    if (rating !== 0) return rating;
    const points = (Number(b.ladder_points) || 0) - (Number(a.ladder_points) || 0);
    if (points !== 0) return points;
    const sos = (Number(b.sos) || 0) - (Number(a.sos) || 0);
    if (sos !== 0) return sos;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

// Snapshot rows for one ladder, filtered to tournament participants. On the
// ladder, points are what "participating" means — they include drop-in game
// points, so someone can be on 0 recorded matches and still be in the season.
function tournamentPool(players, sexCode) {
  const rules = tournamentRules();
  const minPoints = Number(rules.minLadderPoints) || 0;
  const minPlayed = Number(rules.minMatchesPlayed) || 0;
  return players.filter((player) => {
    if (normalizeTournamentSex(player.sex) !== sexCode) return false;
    if ((Number(player.ladder_points) || 0) < minPoints) return false;
    if (player.matches_played == null) return true;
    return (Number(player.matches_played) || 0) >= minPlayed;
  });
}

// Seeds 1..size for one draw. `mode` decides how a withdrawal is absorbed:
//   "keep"    — the withdrawal holds her seed slot and her opponent takes a
//               walkover (the women's draw: 16 participants, no alternates)
//   "reseed"  — drop withdrawals and re-seed from the snapshot order, so the
//               next players in line (17, 18, …) join at the bottom
//   "slot-in" — keep every seed number and drop the next unused player
//               straight into the vacated slot
function buildTournamentSeeds(pool, size, options) {
  const opts = options || {};
  const withdrawn = new Set((opts.withdrawals || []).map(normalizeTournamentName));
  const isOut = (player) => !!player && withdrawn.has(normalizeTournamentName(player.name));
  const ordered = opts.order === "rating" ? sortByRatingDesc(pool) : sortByPointsThenSOSDesc(pool);

  if (Array.isArray(opts.override) && opts.override.length) {
    const byName = new Map(pool.map((player) => [normalizeTournamentName(player.name), player]));
    const picked = opts.override
      .slice(0, size)
      .map((name) => byName.get(normalizeTournamentName(name)) || { name });
    return tournamentSeedSlots(picked, size, isOut);
  }

  if (opts.mode === "reseed") {
    return tournamentSeedSlots(ordered.filter((player) => !isOut(player)), size, () => false);
  }

  if (opts.mode === "slot-in") {
    const bench = ordered.slice(size).filter((player) => !isOut(player));
    const filled = ordered.slice(0, size).map((player) => (isOut(player) ? bench.shift() || null : player));
    return tournamentSeedSlots(filled, size, () => false);
  }

  return tournamentSeedSlots(ordered, size, isOut);
}

function tournamentSeedSlots(players, size, isOut) {
  const slots = [];
  for (let i = 0; i < size; i++) {
    const player = players[i] || null;
    slots.push({ seed: i + 1, player, withdrawn: !!(player && isOut(player)) });
  }
  return slots;
}

/* ── Match graph: sides, results, propagation ────────────────────────────── */

// A "side" of a match: a seeded player once known, otherwise a placeholder
// pointing at whatever still has to decide it.
function tournamentSideFromSeed(slot) {
  if (!slot) return { known: false, label: "TBD" };
  return {
    known: !!slot.player,
    seed: slot.seed,
    player: slot.player || null,
    withdrawn: !!slot.withdrawn,
    label: slot.player ? slot.player.name : "TBD"
  };
}

function tournamentSideFromMatch(previous) {
  if (!previous) return { known: false, label: "TBD" };
  if (previous.result) {
    const winner = previous[previous.result.winnerSide];
    if (winner && winner.known) {
      return {
        known: true,
        seed: winner.seed,
        player: winner.player,
        withdrawn: false,
        label: winner.label
      };
    }
  }
  return { known: false, label: `Winner of ${previous.label}` };
}

function tournamentRoundDeadline(round) {
  if (round.key === "f") return tournamentFinalsNight().date || null;
  return round.deadlineKey ? tournamentDeadlines()[round.deadlineKey] || null : null;
}

// Maps a `winner` value from the data file onto a side. Accepts the player's
// name, their seed number, or "a"/"b" as a last resort.
function tournamentWinnerSide(key, match) {
  if (key == null) return null;

  if (typeof key === "number") {
    if (match.a.seed === key) return "a";
    if (match.b.seed === key) return "b";
    return null;
  }

  const want = normalizeTournamentName(key);
  if (want === "a" || want === "top") return "a";
  if (want === "b" || want === "bottom") return "b";
  if (match.a.player && normalizeTournamentName(match.a.player.name) === want) return "a";
  if (match.b.player && normalizeTournamentName(match.b.player.name) === want) return "b";

  const asSeed = Number(want);
  if (Number.isFinite(asSeed)) {
    if (match.a.seed === asSeed) return "a";
    if (match.b.seed === asSeed) return "b";
  }
  return null;
}

// Decides a match from the data file first, then from the published default
// rules: a withdrawal hands the opponent a walkover, and an unplayed match
// past its deadline goes to the higher seed.
function resolveTournamentMatch(match) {
  const entry = tournamentMatchEntry(match.id) || {};
  match.date = entry.date || null;
  match.note = entry.note || null;
  match.result = null;
  match.defaultPending = false;

  if (entry.winner != null) {
    const side = tournamentWinnerSide(entry.winner, match);
    if (side) {
      match.result = {
        winnerSide: side,
        score: entry.walkover ? null : entry.score || null,
        walkover: !!entry.walkover,
        reason: entry.walkover ? "walkover" : "played"
      };
      return match;
    }
    console.warn(`Tournament: "${entry.winner}" in match ${match.id} doesn't match either side (${match.a.label} / ${match.b.label}).`);
  }

  // Nothing below can fire until we know who is actually in the match.
  if (!match.a.known || !match.b.known) return match;

  if (match.a.withdrawn !== match.b.withdrawn) {
    match.result = {
      winnerSide: match.a.withdrawn ? "b" : "a",
      score: null,
      walkover: true,
      reason: "withdrawal"
    };
    return match;
  }

  if (tournamentDeadlinePassed(match.deadline)) {
    if (tournamentRules().autoAdvanceAfterDeadline) {
      match.result = {
        winnerSide: tournamentHigherSeedSide(match),
        score: null,
        walkover: true,
        reason: "default"
      };
      return match;
    }
    match.defaultPending = true;
  }

  return match;
}

// Higher seed = lower seed number. If the seeds themselves tie — a snapshot
// tie that seeding couldn't separate — SOS desc decides, the same rule the
// ladder uses.
function tournamentHigherSeedSide(match) {
  const aSeed = Number(match.a.seed) || Infinity;
  const bSeed = Number(match.b.seed) || Infinity;
  if (aSeed !== bSeed) return aSeed < bSeed ? "a" : "b";
  const aSOS = Number(match.a.player?.sos) || 0;
  const bSOS = Number(match.b.player?.sos) || 0;
  return bSOS > aSOS ? "b" : "a";
}

// Every match of a 16-draw (the Opens) or a 4-draw (the Club, semifinals
// and final) with both sides resolved as far as the recorded results allow.
// Returns an array of rounds, outermost first.
function buildTournamentDraw(drawKey, seeds) {
  const seedMap = new Map(seeds.map((slot) => [slot.seed, slot]));
  const pairs = seeds.length === 4
    ? TOURNAMENT_FOUR_PAIRS
    : TOURNAMENT_R16_PAIRS[tournamentRules().r16Pairing] || TOURNAMENT_R16_PAIRS.standard;
  const rounds = [];
  let previous = null;

  TOURNAMENT_ROUNDS.filter((round) => round.count * 2 <= seeds.length).forEach((round, roundIdx) => {
    const matches = [];
    for (let i = 0; i < round.count; i++) {
      const match = {
        id: round.count === 1 ? `${drawKey}-${round.key}` : `${drawKey}-${round.key}-${i + 1}`,
        drawKey,
        round: round.key,
        roundLabel: round.label,
        num: i + 1,
        label: round.count === 1 ? round.label : `${round.abbrev} ${i + 1}`,
        deadline: tournamentRoundDeadline(round),
        finalsSlot: round.key === "f" ? tournamentFinalsNight().time || null : null,
        a: roundIdx === 0 ? tournamentSideFromSeed(seedMap.get(pairs[i][0])) : tournamentSideFromMatch(previous[i * 2]),
        b: roundIdx === 0 ? tournamentSideFromSeed(seedMap.get(pairs[i][1])) : tournamentSideFromMatch(previous[i * 2 + 1])
      };
      matches.push(resolveTournamentMatch(match));
    }
    rounds.push(matches);
    previous = matches;
  });

  return rounds;
}

// Each quarter of the draw is a self-scheduling group of four: two R16
// matches plus the QF between their winners, producing one semifinalist.
function buildTournamentGroups(rounds) {
  const [r16, qf] = rounds;
  return qf.map((qfMatch, idx) => {
    const first = r16[idx * 2];
    const second = r16[idx * 2 + 1];
    const slots = [first.a, first.b, second.a, second.b]
      .slice()
      .sort((a, b) => (Number(a.seed) || 99) - (Number(b.seed) || 99));
    return {
      num: idx + 1,
      semifinal: Math.floor(idx / 2) + 1,
      slots,
      matches: [first, second, qfMatch]
    };
  });
}

/* ── Labels and field ────────────────────────────────────────────────────── */

function tournamentSideText(side) {
  if (!side) return "TBD";
  if (!side.known) return side.label;
  const name = side.withdrawn ? `${side.label} (withdrew)` : side.label;
  return side.seed ? `#${side.seed} ${name}` : name;
}

// The three seeded fields. Seeds come from the frozen snapshot whenever it
// exists; `provisional` says there is no snapshot yet. Before the snapshot,
// `fetchLiveStandings` (the public page passes one) supplies live standings;
// without it the field is empty.
async function loadTournamentField(fetchLiveStandings) {
  const data = tournamentData();
  const snapshot = data.snapshot || {};
  const rules = tournamentRules();
  const withdrawals = data.withdrawals || [];
  const overrides = data.seedOverrides || {};

  let players = Array.isArray(snapshot.players) ? snapshot.players : [];
  let provisional = false;
  if (!players.length) {
    players = fetchLiveStandings ? await fetchLiveStandings() : [];
    provisional = true;
  }

  const men = tournamentPool(players, "M");
  const women = tournamentPool(players, "F");

  // Club 4 = the fixed roster in tournament-data.js, looked up among all men
  // so ladder points play no part. Seeds 1-4 within the Club go by rating
  // unless seedOverrides.club fixes them.
  const menByName = new Map(
    players
      .filter((player) => normalizeTournamentSex(player.sex) === "M")
      .map((player) => [normalizeTournamentName(player.name), player])
  );
  const clubFour = sortByRatingDesc(
    (data.clubRoster || []).slice(0, 4).map((name) => menByName.get(normalizeTournamentName(name)) || { name })
  );
  const clubNames = new Set(clubFour.map((player) => normalizeTournamentName(player.name)));
  const menOpenPool = rules.clubPlayersInOpenDraw
    ? men
    : men.filter((player) => !clubNames.has(normalizeTournamentName(player.name)));

  return {
    provisional,
    asOf: snapshot.asOf || tournamentConfig().snapshotDate || null,
    capturedAt: snapshot.capturedAt || null,
    players,
    // Women: 16 participants, no alternates — a dropout keeps her slot.
    women: buildTournamentSeeds(women, 16, { withdrawals, mode: "keep", override: overrides.women }),
    // Men: dropouts are backfilled from the next seeds (17, 18, …).
    men: buildTournamentSeeds(menOpenPool, 16, { withdrawals, mode: rules.menBackfillMode, override: overrides.men }),
    club: buildTournamentSeeds(clubFour, 4, { withdrawals, mode: "keep", override: overrides.club, order: "rating" })
  };
}
