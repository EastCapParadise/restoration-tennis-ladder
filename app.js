const SUPABASE_URL = "https://jntspohwzkugcuisoofm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CgGyn2sReCxWz6Li9QnWnw_kC-8CgVO";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  ladder: {
    filterSex: "All",
    search: "",
    sortBy: "ladder_points",
    sortDir: "desc",
    showMoreStats: false
  },
  history: {
    filterType: "All"
  },
  realtime: {
    playersChannel: null,
    matchesChannel: null
  }
};

function setupMobileMenu() {
  const header = document.querySelector(".site-header");
  const btn = document.querySelector(".hamburger-btn");
  if (!header || !btn) return;

  btn.addEventListener("click", () => {
    const isOpen = header.classList.toggle("menu-open");
    btn.textContent = isOpen ? "✕" : "☰";
    btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    header.querySelector(".mobile-nav-menu")?.setAttribute("aria-hidden", isOpen ? "false" : "true");
  });

  // Close menu when any mobile nav link is tapped
  header.querySelectorAll(".mobile-nav-menu a").forEach((link) => {
    link.addEventListener("click", () => {
      header.classList.remove("menu-open");
      btn.textContent = "☰";
      btn.setAttribute("aria-expanded", "false");
      header.querySelector(".mobile-nav-menu")?.setAttribute("aria-hidden", "true");
    });
  });
}

function setupNavMore() {
  const navMore = document.querySelector(".nav-more");
  const btn = navMore?.querySelector(".nav-more-btn");
  if (!navMore || !btn) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = navMore.classList.toggle("open");
    btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  document.addEventListener("click", () => {
    if (navMore.classList.contains("open")) {
      navMore.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
  });

  navMore.querySelector(".nav-more-dropdown")?.addEventListener("click", (e) => {
    e.stopPropagation();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  setupMobileMenu();
  setupNavMore();
  try {
    if (document.getElementById("join-form")) handleJoinForm();
    if (document.getElementById("report-form")) await setupReportForm();
    if (document.getElementById("phone")) setupPhoneFormatting();
    if (document.getElementById("scoring-rules-box")) renderScoringRulesBox();

    if (getLadderBodyEl()) {
      setupLadderSearch();
      setupLadderFilterButtons();
      setupLadderSorting();
      setupShowMoreStats();
      await loadLadder();
    }

    if (document.getElementById("home-stats")) await loadHomeStats();
    if (document.getElementById("activity-feed")) await loadActivityFeed();

    if (document.getElementById("match-of-week")) await loadMatchOfWeek();
    if (document.getElementById("history-list")) {
      setupHistoryFilterButtons();
      await loadMatchHistory();
    }

    if (document.getElementById("directory-body")) {
      setupDirectoryPage();
    }

    if (document.getElementById("player-profile")) {
      await loadPlayerProfile();
    }
    if (document.getElementById("player-h2h-section")) await loadPlayerH2H();

    if (document.getElementById("player-match-history")) {
      await loadPlayerMatchHistory();
    }

    setupRealtimeSubscriptions();
  } catch (error) {
    console.error("Bootstrap failed:", error);
  }
});

/* =========================
   SHARED HELPERS
========================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function roundToTwo(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatDisplayRating(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return roundToTwo(Number(value)).toFixed(2);
}

function formatSignedNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const num = Number(value);
  return num > 0 ? `+${num}` : `${num}`;
}

function formatLadderPoints(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${value} pts`;
}

function calculateWinPercentage(wins, losses) {
  const w = Number(wins || 0);
  const l = Number(losses || 0);
  const total = w + l;
  if (!total) return "0%";
  return `${Math.round((w / total) * 100)}%`;
}

function setTableMessage(tbody, message, colspan = 1) {
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="${colspan}">${escapeHtml(message)}</td></tr>`;
}

function setActiveFilterButton(groupSelector, activeFilter) {
  const group = document.querySelector(groupSelector);
  if (!group) return;

  const buttons = group.querySelectorAll(".filter-btn, .filter-chip");
  buttons.forEach((button) => {
    const isActive = (button.dataset.filter || "") === activeFilter;
    button.classList.toggle("active", isActive);
  });
}

function getPlayerIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function safeDateText(dateText) {
  return dateText || "Unknown";
}

function sortByDateDesc(a, b) {
  const aDate = new Date(a?.date_played || a?.created_at || 0).getTime();
  const bDate = new Date(b?.date_played || b?.created_at || 0).getTime();
  return bDate - aDate;
}

function relativeTime(dateStr) {
  if (!dateStr) return "";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

function abbreviateName(fullName) {
  if (!fullName) return "Unknown";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function sortPlayersForStandings(players) {
  return [...players].sort((a, b) => {
    const byPoints = compareValues(a.ladder_points ?? 0, b.ladder_points ?? 0, "desc");
    if (byPoints !== 0) return byPoints;

    const byDynamicRating = compareValues(a.dynamic_rating ?? 0, b.dynamic_rating ?? 0, "desc");
    if (byDynamicRating !== 0) return byDynamicRating;

    const byWins = compareValues(a.wins ?? 0, b.wins ?? 0, "desc");
    if (byWins !== 0) return byWins;

    return compareValues(a.name || "", b.name || "", "asc");
  });
}

/* =========================
   JOIN FORM
========================= */

function setupPhoneFormatting() {
  const phoneInput = document.getElementById("phone");
  if (!phoneInput) return;

  phoneInput.addEventListener("input", () => {
    const digits = phoneInput.value.replace(/\D/g, "").slice(0, 10);
    let formatted = digits;

    if (digits.length >= 4 && digits.length <= 6) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    } else if (digits.length >= 7) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    phoneInput.value = formatted;
  });
}

function handleJoinForm() {
  const form = document.getElementById("join-form");
  const message = document.getElementById("join-message");
  if (!form || !message) return;

  function showError(text) {
    message.innerHTML = `<p class="form-error">${text}</p>`;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.innerHTML = '<p class="small-text">Submitting…</p>';

    try {
      const name = document.getElementById("name")?.value.trim() || "";
      const email = document.getElementById("email")?.value.trim().toLowerCase() || "";
      const phone = document.getElementById("phone")?.value.trim() || "";
      const area = document.getElementById("area")?.value.trim() || "";
      const rating = document.getElementById("rating")?.value.trim() || "";
      const sex = document.getElementById("sex")?.value.trim() || "";

      if (!name || !name.includes(" ")) {
        showError("Please enter both first and last name.");
        return;
      }

      const phonePattern = /^\d{3}-\d{3}-\d{4}$/;
      if (!phonePattern.test(phone)) {
        showError("Please enter phone number as XXX-XXX-XXXX.");
        return;
      }

      const numericRating = parseFloat(rating);
      if (!Number.isFinite(numericRating)) {
        showError("Please choose a valid self-rating.");
        return;
      }

      if (!sex) {
        showError("Please choose a ladder.");
        return;
      }

      const { data: existingPlayer, error: checkError } = await supabaseClient
        .from("players")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingPlayer) {
        showError("That email is already registered.");
        return;
      }

      const insertPayload = {
        name,
        email,
        phone,
        area,
        sex,
        display_rating: numericRating,
        dynamic_rating: numericRating,
        rating: Math.round(numericRating * 100),
        ladder_points: 0,
        wins: 0,
        losses: 0,
        games_won: 0,
        games_lost: 0,
        matches_played: 0
      };

      const { error: insertError } = await supabaseClient
        .from("players")
        .insert([insertPayload]);

      if (insertError) throw insertError;

      form.style.display = "none";
      message.innerHTML = `
        <div class="form-confirmation">
          <div class="confirmation-icon">✓</div>
          <h3>You’re in!</h3>
          <p>Welcome to the Restoration Tennis Ladder. You’ll appear in the rankings once the season begins on April 17th.</p>
          <div class="confirmation-links">
            <a href="index.html" class="button">Back to Home</a>
            <a href="ladder.html" class="button-secondary">View Rankings</a>
          </div>
        </div>
      `;

      if (getLadderBodyEl()) await loadLadder();
      if (document.getElementById("report-form")) await populatePlayerDropdowns();
    } catch (error) {
      console.error("Join form error:", error);
      showError("Something went wrong — please try again or text Michael at 832-833-1990.");
    }
  });
}

/* =========================
   LADDER PAGE
========================= */

function getLadderBodyEl() {
  return document.getElementById("ladder-body") || document.getElementById("rankings-body");
}

function getLadderColspan() {
  return state.ladder.showMoreStats ? 12 : 7;
}

function getLadderSearchEl() {
  return document.getElementById("ladder-search");
}

function setupLadderFilterButtons() {
  const buttons = document.querySelectorAll(".ladder-filters .filter-btn");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      state.ladder.filterSex = button.dataset.filter || "All";
      loadLadder();
    });
  });
}

function setupLadderSearch() {
  const searchInput = getLadderSearchEl();
  if (!searchInput) return;

  searchInput.addEventListener("input", (event) => {
    state.ladder.search = event.target.value || "";
    loadLadder();
  });
}

function setupLadderSorting() {
  const headers = document.querySelectorAll(".ladder-table [data-sort]");
  headers.forEach((header) => {
    header.style.cursor = "pointer";

    header.addEventListener("click", () => {
      const sortBy = header.dataset.sort;
      if (!sortBy) return;

      if (state.ladder.sortBy === sortBy) {
        state.ladder.sortDir = state.ladder.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.ladder.sortBy = sortBy;
        state.ladder.sortDir =
          ["name", "sex", "area", "status"].includes(sortBy) ? "asc" : "desc";
      }
      state.ladder.userHasSorted = true;
      updateSortIndicators();
      loadLadder();
    });
  });

  updateSortIndicators();
}

function updateSortIndicators() {
  const headers = document.querySelectorAll(".ladder-table [data-sort]");
  headers.forEach((header) => {
    const sortBy = header.dataset.sort;
    const label = header.dataset.label || header.textContent.replace(/[↑↓]/g, "").trim();

    if (state.ladder.sortBy === sortBy) {
      header.textContent = `${label} ${state.ladder.sortDir === "asc" ? "↑" : "↓"}`;
    } else {
      header.textContent = label;
    }
  });
}

async function fetchPlayers() {
  const { data, error } = await supabaseClient
    .from("players")
    .select(`
      id,
      name,
      sex,
      area,
      phone,
      display_rating,
      dynamic_rating,
      rating,
      ladder_points,
      wins,
      losses,
      games_won,
      games_lost,
      matches_played
    `);

  if (error) throw error;
  return data || [];
}

async function fetchRecentMatchesForStatus() {
  const { data, error } = await supabaseClient
    .from("matches")
    .select(`
      id,
      date_played,
      created_at,
      winner_team,
      team1_player1_id,
      team1_player2_id,
      team2_player1_id,
      team2_player2_id
    `)
    .order("date_played", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Status match fetch error:", error);
    return [];
  }

  return data || [];
}

function getPlayerStatus(playerId, matches) {
  const pid = Number(playerId);

  const playerMatches = matches
    .filter((match) =>
      [
        match.team1_player1_id,
        match.team1_player2_id,
        match.team2_player1_id,
        match.team2_player2_id
      ].includes(pid)
    )
    .sort(sortByDateDesc);

  if (!playerMatches.length) return "New";

  const lastTwo = playerMatches.slice(0, 2).map((match) => {
    const onTeam1 = [match.team1_player1_id, match.team1_player2_id].includes(pid);
    return (onTeam1 && match.winner_team === 1) || (!onTeam1 && match.winner_team === 2);
  });

  if (lastTwo.length === 2 && lastTwo.every(Boolean)) return "Hot";
  if (lastTwo.length === 2 && lastTwo.every((result) => !result)) return "Cooling";

  const lastMatchDate = new Date(playerMatches[0].date_played || playerMatches[0].created_at);
  const daysAgo = (Date.now() - lastMatchDate.getTime()) / (1000 * 60 * 60 * 24);

  return daysAgo <= 14 ? "Active" : "Idle";
}

function applyLadderFilters(players) {
  let filtered = [...players];

  if (state.ladder.filterSex === "Man" || state.ladder.filterSex === "Woman") {
    filtered = filtered.filter((player) => player.sex === state.ladder.filterSex);
  }

  const search = state.ladder.search.trim().toLowerCase();
  if (search) {
    filtered = filtered.filter((player) =>
      [
        player.name || "",
        player.area || "",
        player.sex || "",
        player.status || ""
      ].some((value) => String(value).toLowerCase().includes(search))
    );
  }

  return filtered;
}

function compareValues(a, b, dir = "asc") {
  const direction = dir === "asc" ? 1 : -1;

  if (a === null || a === undefined) return 1 * direction;
  if (b === null || b === undefined) return -1 * direction;

  if (typeof a === "string" || typeof b === "string") {
    return String(a).localeCompare(String(b)) * direction;
  }

  return (Number(a) - Number(b)) * direction;
}

function sortPlayers(players) {
  const { sortBy, sortDir } = state.ladder;

  return [...players].sort((a, b) => {
    const primary = compareValues(a[sortBy], b[sortBy], sortDir);
    if (primary !== 0) return primary;

    const secondary = compareValues(a.ladder_points ?? 0, b.ladder_points ?? 0, "desc");
    if (secondary !== 0) return secondary;

    const tertiary = compareValues(a.wins ?? 0, b.wins ?? 0, "desc");
    if (tertiary !== 0) return tertiary;

    return compareValues(a.name || "", b.name || "", "asc");
  });
}

function renderRankingsSummary(players, filteredPlayers, currentFilterLabel) {
  const summaryStrip = document.getElementById("rankings-summary-strip");
  if (!summaryStrip) return;

  const topRating = filteredPlayers.length
    ? formatDisplayRating(filteredPlayers[0].dynamic_rating)
    : "—";

  summaryStrip.innerHTML = `
    <div class="summary-pill">
      <strong>${players.length}</strong>
      <span>Total Players</span>
    </div>
    <div class="summary-pill">
      <strong>${filteredPlayers.length}</strong>
      <span>Visible</span>
    </div>
    <div class="summary-pill">
      <strong>${escapeHtml(currentFilterLabel)}</strong>
      <span>Current Filter</span>
    </div>
    <div class="summary-pill">
      <strong>${topRating}</strong>
      <span>Top Rating</span>
    </div>
  `;
}

function getRankBadge(index) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return index + 1;
}

function renderLadder(players) {
  const ladderBody = getLadderBodyEl();
  if (!ladderBody) return;

  if (!players.length) {
    setTableMessage(ladderBody, "No players found.", getLadderColspan());
    return;
  }

  ladderBody.innerHTML = players.map((player, index) => {
    const rank = index + 1;
    const badge = getRankBadge(index);

    let rowClass = "fade-in-row";
    if (rank === 1) rowClass += " rank-1";
    else if (rank === 2) rowClass += " rank-2";
    else if (rank === 3) rowClass += " rank-3";
    else if (rank <= 10) rowClass += " rank-top-10";

    return `
      <tr class="${rowClass}">
        <td>${badge}</td>
        <td><a class="player-link" href="player.html?id=${player.id}">${escapeHtml(player.name || "")}</a></td>
        <td>${escapeHtml(player.area || "")}</td>
        <td class="num">${player.ladder_points ?? 0}</td>
        <td class="num">${player.wins ?? 0}</td>
        <td class="num">${player.losses ?? 0}</td>
        <td class="num">${formatDisplayRating(player.dynamic_rating)}</td>
        <td>${escapeHtml(player.status || "—")}</td>
        <td class="num">${player.games_won ?? 0}</td>
        <td class="num">${player.games_lost ?? 0}</td>
        <td class="num">${player.matches_played ?? 0}</td>
        <td>
          ${player.sex?.toLowerCase().startsWith("m")
            ? '<span class="ladder-badge badge-men">M</span>'
            : '<span class="ladder-badge badge-women">W</span>'}
        </td>
      </tr>
    `;
  }).join("");
}

async function loadLadder() {
  const ladderBody = getLadderBodyEl();
  if (!ladderBody) return;

  setActiveFilterButton(".ladder-filters", state.ladder.filterSex);
  setTableMessage(ladderBody, "Loading rankings...", getLadderColspan());

  try {
    const [players, recentMatches] = await Promise.all([
      fetchPlayers(),
      fetchRecentMatchesForStatus()
    ]);

    const playersWithStatus = players.map((player) => ({
      ...player,
      status: getPlayerStatus(player.id, recentMatches)
    }));

    const filtered = applyLadderFilters(playersWithStatus);
    const officialStandings = sortPlayersForStandings(filtered);

    renderRankingsSummary(playersWithStatus, officialStandings, state.ladder.filterSex);
    renderLadder(officialStandings);
  } catch (error) {
    console.error("Load ladder error:", error);
    setTableMessage(ladderBody, "Error loading rankings.", getLadderColspan());
  }
}

function setupShowMoreStats() {
  const btn = document.getElementById("show-more-stats-btn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    state.ladder.showMoreStats = !state.ladder.showMoreStats;
    const table = document.querySelector(".ladder-table");
    if (table) table.classList.toggle("show-more-stats", state.ladder.showMoreStats);
    btn.textContent = state.ladder.showMoreStats ? "Show Less ▴" : "Show More Stats ▾";
  });
}

async function loadHomeStats() {
  const container = document.getElementById("home-stats");
  if (!container) return;

  // Days Left is pure math — always calculate regardless of Supabase
  const seasonEnd = new Date("2026-11-01");
  const today = new Date();
  const daysLeft = Math.max(0, Math.ceil((seasonEnd - today) / (1000 * 60 * 60 * 24)));

  let playerCount = 0;
  let matchCount = 0;

  try {
    const [playersResult, matchesResult] = await Promise.all([
      supabaseClient.from("players").select("id", { count: "exact", head: true }),
      supabaseClient.from("matches").select("id", { count: "exact", head: true })
    ]);
    playerCount = playersResult.count ?? 0;
    matchCount = matchesResult.count ?? 0;
  } catch (error) {
    console.error("Home stats error:", error);
  }

  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${playerCount}</div>
      <div class="stat-label">Players</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${matchCount}</div>
      <div class="stat-label">Matches Played</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${daysLeft}</div>
      <div class="stat-label">Days Left</div>
    </div>
  `;
}

/* =========================
   ACTIVITY FEED
========================= */

async function loadActivityFeed() {
  const container = document.getElementById("activity-feed");
  if (!container) return;

  try {
    const { data, error } = await supabaseClient
      .from("matches")
      .select(`
        id, match_type, winner_team, score_text, date_played, created_at,
        team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id
      `)
      .order("date_played", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) throw error;

    const matches = data || [];

    if (!matches.length) {
      container.innerHTML = `
        <h2>Recent Activity</h2>
        <p class="small-text">No matches reported yet — be the first!</p>
      `;
      return;
    }

    const playerMap = await fetchPlayerNamesForMatches(matches);

    const items = matches.map((match, i) => {
      const winnerIds = match.winner_team === 1
        ? [match.team1_player1_id, match.team1_player2_id]
        : [match.team2_player1_id, match.team2_player2_id];
      const loserIds = match.winner_team === 1
        ? [match.team2_player1_id, match.team2_player2_id]
        : [match.team1_player1_id, match.team1_player2_id];

      const winnerNames = winnerIds.filter(Boolean).map(id => abbreviateName(playerMap[id])).join(" & ");
      const loserNames  = loserIds.filter(Boolean).map(id => abbreviateName(playerMap[id])).join(" & ");
      const timeAgo = relativeTime(match.date_played || match.created_at);
      const score = match.score_text ? ` · ${escapeHtml(match.score_text)}` : "";
      const type  = match.match_type || "Match";

      return `<li class="activity-feed-item${i === 0 ? " activity-new" : ""}">
        <strong>${escapeHtml(winnerNames)}</strong> defeated <strong>${escapeHtml(loserNames)}</strong>${score} · ${escapeHtml(type)} · ${escapeHtml(timeAgo)}
      </li>`;
    });

    container.innerHTML = `
      <h2>Recent Activity</h2>
      <ul class="activity-feed-list">${items.join("")}</ul>
    `;
  } catch (error) {
    console.error("Activity feed error:", error);
  }
}

/* =========================
   MATCH OF THE WEEK
========================= */

async function loadMatchOfWeek() {
  const container = document.getElementById("match-of-week");
  if (!container) return;

  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const { data, error } = await supabaseClient
      .from("matches")
      .select(`
        id, match_type, winner_team, score_text, date_played, created_at,
        team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id,
        team1_avg_rating, team2_avg_rating, team1_total_games, team2_total_games
      `)
      .gte("date_played", cutoff);

    if (error) throw error;

    const matches = data || [];
    if (!matches.length) {
      container.style.display = "none";
      return;
    }

    let bestUpset = null;
    let bestUpsetDelta = 0;
    let mostGames = null;
    let mostGamesTotal = 0;

    for (const match of matches) {
      const t1 = Number(match.team1_avg_rating || 0);
      const t2 = Number(match.team2_avg_rating || 0);
      const delta = Math.abs(t1 - t2);
      const higherTeam = t1 >= t2 ? 1 : 2;
      const isUpset = higherTeam !== match.winner_team && delta > 0.05;
      if (isUpset && delta > bestUpsetDelta) { bestUpsetDelta = delta; bestUpset = match; }

      const totalGames = Number(match.team1_total_games || 0) + Number(match.team2_total_games || 0);
      if (totalGames > mostGamesTotal) { mostGamesTotal = totalGames; mostGames = match; }
    }

    const featured = bestUpset || mostGames;
    if (!featured) { container.style.display = "none"; return; }

    const isUpset = bestUpset !== null;
    const descriptor = isUpset ? "Biggest Upset" : "Marathon Match";
    const statText = isUpset
      ? `${bestUpsetDelta.toFixed(2)} rating pts difference`
      : `${mostGamesTotal} total games played`;

    const playerMap = await fetchPlayerNamesForMatches([featured]);
    const display = buildMatchDisplay(featured, playerMap);
    const winnerText = featured.winner_team === 1 ? display.team1Text : display.team2Text;
    const loserText  = featured.winner_team === 1 ? display.team2Text : display.team1Text;
    const dateStr = featured.date_played
      ? new Date(featured.date_played).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "";

    container.style.display = "";
    container.innerHTML = `
      <div class="motw-card">
        <div class="motw-header">
          <span class="motw-badge">⚡ Match of the Week</span>
          <span class="motw-descriptor">${escapeHtml(descriptor)}</span>
        </div>
        <div class="motw-result">
          <span class="motw-winner">${escapeHtml(winnerText)}</span>
          <span class="motw-defeated">defeated</span>
          <span class="motw-loser">${escapeHtml(loserText)}</span>
        </div>
        <div class="motw-details">
          <span>${escapeHtml(featured.score_text || "")}</span>
          <span>·</span>
          <span>${escapeHtml(featured.match_type || "")}</span>
          <span>·</span>
          <span>${escapeHtml(dateStr)}</span>
        </div>
        <div class="motw-stat">${escapeHtml(statText)}</div>
      </div>
    `;
  } catch (error) {
    console.error("Match of week error:", error);
    container.style.display = "none";
  }
}

/* =========================
   HEAD-TO-HEAD RECORDS
========================= */

async function loadPlayerH2H() {
  const container = document.getElementById("player-h2h-section");
  if (!container) return;

  const playerId = getPlayerIdFromUrl();
  if (!playerId) { container.style.display = "none"; return; }

  try {
    const matches = await fetchMatchesForPlayer(playerId);
    if (!matches.length) { container.style.display = "none"; return; }

    const pid = Number(playerId);
    const h2h = {};

    for (const match of matches) {
      const onTeam1 = [match.team1_player1_id, match.team1_player2_id].includes(pid);
      const won = onTeam1 ? match.winner_team === 1 : match.winner_team === 2;
      const opponentIds = onTeam1
        ? [match.team2_player1_id, match.team2_player2_id]
        : [match.team1_player1_id, match.team1_player2_id];

      for (const oppId of opponentIds.filter(Boolean)) {
        if (!h2h[oppId]) h2h[oppId] = { wins: 0, losses: 0 };
        won ? h2h[oppId].wins++ : h2h[oppId].losses++;
      }
    }

    const opponentIds = Object.keys(h2h).map(Number);
    if (!opponentIds.length) { container.style.display = "none"; return; }

    const { data: oppData } = await supabaseClient
      .from("players").select("id, name").in("id", opponentIds);

    const oppMap = {};
    (oppData || []).forEach(p => { oppMap[p.id] = p; });

    const sorted = opponentIds.sort((a, b) => {
      const ta = h2h[a].wins + h2h[a].losses;
      const tb = h2h[b].wins + h2h[b].losses;
      return tb - ta;
    });

    container.style.display = "";
    container.innerHTML = `
      <h2>Head-to-Head Records</h2>
      <div class="table-wrap">
        <table class="h2h-table">
          <thead>
            <tr>
              <th>Opponent</th>
              <th class="num">W</th>
              <th class="num">L</th>
              <th class="num">Win %</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(oppId => {
              const rec = h2h[oppId];
              const opp = oppMap[oppId];
              const total = rec.wins + rec.losses;
              const pct = total > 0 ? Math.round((rec.wins / total) * 100) : 0;
              const nameHtml = opp
                ? `<a href="player.html?id=${opp.id}" class="player-link">${escapeHtml(opp.name)}</a>`
                : "Unknown";
              return `<tr>
                <td>${nameHtml}</td>
                <td class="num">${rec.wins}</td>
                <td class="num">${rec.losses}</td>
                <td class="num">${pct}%</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    console.error("H2H load error:", error);
    container.style.display = "none";
  }
}

/* =========================
   REPORT MATCH PAGE
========================= */

async function setupReportForm() {
  const form = document.getElementById("report-form");
  const message = document.getElementById("report-message");
  if (!form || !message) return;

  const matchTypeSelect = document.getElementById("match-type");
  const team1Player2Wrap = document.getElementById("team1-player2-wrap");
  const team2Player2Wrap = document.getElementById("team2-player2-wrap");
  const team1Player2 = document.getElementById("team1-player2");
  const team2Player2 = document.getElementById("team2-player2");

  await populatePlayerDropdowns();

  // Pre-select opponent from URL param (linked from player profile)
  const opponentId = new URLSearchParams(window.location.search).get("opponentId");
  if (opponentId) {
    const team2P1 = document.getElementById("team2-player1");
    if (team2P1) team2P1.value = opponentId;
  }

  function toggleDoublesFields() {
    const isDoubles = matchTypeSelect?.value === "Doubles";
    if (team1Player2Wrap) team1Player2Wrap.style.display = isDoubles ? "block" : "none";
    if (team2Player2Wrap) team2Player2Wrap.style.display = isDoubles ? "block" : "none";
    if (team1Player2) team1Player2.required = isDoubles;
    if (team2Player2) team2Player2.required = isDoubles;

    if (!isDoubles) {
      if (team1Player2) team1Player2.value = "";
      if (team2Player2) team2Player2.value = "";
    }
  }

  matchTypeSelect?.addEventListener("change", toggleDoublesFields);
  toggleDoublesFields();

  // Dynamic side labels
  function getSelectedName(selectEl) {
    const opt = selectEl?.options[selectEl.selectedIndex];
    return opt?.dataset?.name || "";
  }

  function shortName(name) {
    return name ? name.split(" ")[0] : "";
  }

  function updateSideLabels() {
    const sideALabel = document.getElementById("side-a-label");
    const sideBLabel = document.getElementById("side-b-label");
    const winnerOpt1 = document.querySelector('#winner-team option[value="1"]');
    const winnerOpt2 = document.querySelector('#winner-team option[value="2"]');
    const isDoubles = matchTypeSelect?.value === "Doubles";

    const t1p1Name = getSelectedName(document.getElementById("team1-player1"));
    const t1p2Name = isDoubles ? getSelectedName(document.getElementById("team1-player2")) : "";
    const t2p1Name = getSelectedName(document.getElementById("team2-player1"));
    const t2p2Name = isDoubles ? getSelectedName(document.getElementById("team2-player2")) : "";

    const sideAText = t1p1Name ? (t1p2Name ? `${t1p1Name} & ${t1p2Name}` : t1p1Name) : "Side A";
    const sideBText = t2p1Name ? (t2p2Name ? `${t2p1Name} & ${t2p2Name}` : t2p1Name) : "Side B";

    // Compact first-name labels for score inputs
    const scoreAText = t1p1Name
      ? (t1p2Name ? `${shortName(t1p1Name)} & ${shortName(t1p2Name)}` : shortName(t1p1Name))
      : "Side A";
    const scoreBText = t2p1Name
      ? (t2p2Name ? `${shortName(t2p1Name)} & ${shortName(t2p2Name)}` : shortName(t2p1Name))
      : "Side B";

    if (sideALabel) sideALabel.textContent = sideAText;
    if (sideBLabel) sideBLabel.textContent = sideBText;
    if (winnerOpt1) winnerOpt1.textContent = sideAText;
    if (winnerOpt2) winnerOpt2.textContent = sideBText;
    document.querySelectorAll(".score-team1-label").forEach((el) => { el.textContent = scoreAText; });
    document.querySelectorAll(".score-team2-label").forEach((el) => { el.textContent = scoreBText; });
  }

  ["team1-player1", "team1-player2", "team2-player1", "team2-player2"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", updateSideLabels);
  });
  matchTypeSelect?.addEventListener("change", updateSideLabels);
  updateSideLabels();

  function showReportError(text) {
    message.innerHTML = `<p class="form-error">${text}</p>`;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.innerHTML = '<p class="small-text">Submitting match…</p>';

    try {
      const formData = readMatchForm();
      const validationError = await validateMatchForm(formData);

      if (validationError) {
        showReportError(validationError);
        return;
      }

      const playersById = await fetchSelectedPlayers(formData);
      const hydrated = hydrateMatchPlayers(formData, playersById);

      if (hydrated.error) {
        showReportError(hydrated.error);
        return;
      }

      const scoringContext = buildScoringContext(formData, hydrated);
      const scoringResult = calculateMatchScoring(scoringContext);
      const finalMatchPayload = buildMatchPayload({ formData, hydrated, scoringResult });

      const duplicate = await isDuplicateMatchSameDay(finalMatchPayload);
      if (duplicate) {
        showReportError("This match appears to already be recorded for that date.");
        return;
      }

      const { error: matchError } = await supabaseClient
        .from("matches")
        .insert([finalMatchPayload]);

      if (matchError) {
        showReportError(`Error saving match: ${matchError.message}`);
        return;
      }

      const updateError = await applyPlayerUpdates({
        team1Players: hydrated.team1Players,
        team2Players: hydrated.team2Players,
        winnerTeam: formData.winnerTeam,
        scoringResult,
        team1TotalGames: scoringContext.team1TotalGames,
        team2TotalGames: scoringContext.team2TotalGames
      });

      if (updateError) {
        showReportError(`Match saved but player updates failed: ${updateError.message || updateError}`);
        return;
      }

      form.style.display = "none";
      message.innerHTML = `
        <div class="form-confirmation">
          <div class="confirmation-icon">✓</div>
          <h3>Match Reported!</h3>
          <p>Results and ratings have been updated.</p>
          <div class="confirmation-links">
            <a href="history.html" class="button">View Match History</a>
            <a href="report.html" class="button-secondary">Report Another Match</a>
          </div>
        </div>
      `;

      if (getLadderBodyEl()) await loadLadder();
      if (document.getElementById("history-list")) await loadMatchHistory();
      if (document.getElementById("player-profile")) await loadPlayerProfile();
      if (document.getElementById("player-match-history")) await loadPlayerMatchHistory();
    } catch (error) {
      console.error("Unexpected submit error:", error);
      showReportError("Something went wrong — please try again or text Michael at 832-833-1990.");
    }
  });
}

async function populatePlayerDropdowns() {
  const selects = [
    document.getElementById("team1-player1"),
    document.getElementById("team1-player2"),
    document.getElementById("team2-player1"),
    document.getElementById("team2-player2")
  ].filter(Boolean);

  if (!selects.length) return;

  const { data, error } = await supabaseClient
    .from("players")
    .select("id, name, sex, display_rating")
    .order("name", { ascending: true });

  if (error) {
    console.error("Dropdown player load error:", error);
    return;
  }

  const players = data || [];

  selects.forEach((select) => {
    const currentValue = select.value;
    const firstOption = `<option value="">Select player</option>`;

    select.innerHTML = firstOption + players.map((player) => `
      <option value="${player.id}" data-name="${escapeHtml(player.name)}">
        ${escapeHtml(player.name)}${player.sex ? ` (${escapeHtml(player.sex)})` : ""}${player.display_rating != null ? ` — ${formatDisplayRating(player.display_rating)}` : ""}
      </option>
    `).join("");

    select.value = currentValue || "";
  });
}

function readMatchForm() {
  const matchType = document.getElementById("match-type")?.value || "";
  const team1Player1Id = document.getElementById("team1-player1")?.value || "";
  const team1Player2Id = document.getElementById("team1-player2")?.value || "";
  const team2Player1Id = document.getElementById("team2-player1")?.value || "";
  const team2Player2Id = document.getElementById("team2-player2")?.value || "";
  const winnerTeam = parseInt(document.getElementById("winner-team")?.value, 10);

  const set1Team1Games = toNumberOrNull(document.getElementById("set1-team1-games")?.value);
  const set1Team2Games = toNumberOrNull(document.getElementById("set1-team2-games")?.value);
  const set2Team1Games = toNumberOrNull(document.getElementById("set2-team1-games")?.value);
  const set2Team2Games = toNumberOrNull(document.getElementById("set2-team2-games")?.value);
  const set3Team1Games = toNumberOrNull(document.getElementById("set3-team1-games")?.value);
  const set3Team2Games = toNumberOrNull(document.getElementById("set3-team2-games")?.value);

  const datePlayed = document.getElementById("date-played")?.value || "";
  const submittedBy = document.getElementById("submitted-by")?.value.trim() || "";
  const matchNotes = document.getElementById("match-notes")?.value.trim() || null;

  return {
    matchType,
    team1Player1Id,
    team1Player2Id,
    team2Player1Id,
    team2Player2Id,
    winnerTeam,
    set1Team1Games,
    set1Team2Games,
    set2Team1Games,
    set2Team2Games,
    set3Team1Games,
    set3Team2Games,
    datePlayed,
    submittedBy,
    matchNotes
  };
}

async function fetchSelectedPlayers(formData) {
  const ids = [
    formData.team1Player1Id,
    formData.team1Player2Id,
    formData.team2Player1Id,
    formData.team2Player2Id
  ].filter(Boolean);

  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return {};

  const { data, error } = await supabaseClient
    .from("players")
    .select(`
      id,
      name,
      sex,
      display_rating,
      dynamic_rating,
      rating,
      ladder_points,
      wins,
      losses,
      games_won,
      games_lost,
      matches_played
    `)
    .in("id", uniqueIds);

  if (error) throw error;

  const playersById = {};
  (data || []).forEach((player) => {
    playersById[String(player.id)] = player;
  });

  return playersById;
}

function hydrateMatchPlayers(formData, playersById) {
  const team1Players = [
    playersById[String(formData.team1Player1Id)] || null,
    formData.matchType === "Doubles" ? playersById[String(formData.team1Player2Id)] || null : null
  ];

  const team2Players = [
    playersById[String(formData.team2Player1Id)] || null,
    formData.matchType === "Doubles" ? playersById[String(formData.team2Player2Id)] || null : null
  ];

  if (!team1Players[0] || !team2Players[0]) {
    return { error: "Could not load selected players." };
  }

  if (formData.matchType === "Doubles" && (!team1Players[1] || !team2Players[1])) {
    return { error: "Could not load all four doubles players." };
  }

  return { team1Players, team2Players };
}

function buildScoreText(
  set1Team1Games,
  set1Team2Games,
  set2Team1Games,
  set2Team2Games,
  set3Team1Games,
  set3Team2Games
) {
  const parts = [
    `${set1Team1Games}-${set1Team2Games}`,
    `${set2Team1Games}-${set2Team2Games}`
  ];

  if (set3Team1Games !== null && set3Team2Games !== null) {
    parts.push(`${set3Team1Games}-${set3Team2Games}`);
  }

  return parts.join(" ");
}

function determineWinnerFromScore(formData) {
  const sets = [
    [formData.set1Team1Games, formData.set1Team2Games],
    [formData.set2Team1Games, formData.set2Team2Games]
  ];

  if (formData.set3Team1Games !== null && formData.set3Team2Games !== null) {
    sets.push([formData.set3Team1Games, formData.set3Team2Games]);
  }

  let team1Sets = 0;
  let team2Sets = 0;

  sets.forEach(([a, b]) => {
    if (a > b) team1Sets += 1;
    if (b > a) team2Sets += 1;
  });

  if (team1Sets === team2Sets) return null;
  return team1Sets > team2Sets ? 1 : 2;
}

function isValidSetScore(a, b) {
  if (a === null || b === null) return false;
  if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
  if (a < 0 || b < 0) return false;

  return (
    (a === 6 && b <= 4) ||
    (b === 6 && a <= 4) ||
    (a === 7 && (b === 5 || b === 6)) ||
    (b === 7 && (a === 5 || a === 6))
  );
}

function isValidOptionalSetScore(a, b) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
  if (a < 0 || b < 0) return false;

  return (
    (a >= 10 && a - b >= 2) ||
    (b >= 10 && b - a >= 2) ||
    isValidSetScore(a, b)
  );
}

function validateTennisScore(scoreText) {
  if (!scoreText || typeof scoreText !== "string") {
    return { valid: false, message: "Enter a valid score." };
  }

  const cleaned = scoreText.trim();
  const sets = cleaned.split(/\s+/);

  if (sets.length < 2 || sets.length > 3) {
    return { valid: false, message: "Score should usually have 2 or 3 sets, like 6-4 3-6 10-8." };
  }

  for (let i = 0; i < sets.length; i++) {
    const set = sets[i];

    if (!/^(\d+)-(\d+)$/.test(set)) {
      return { valid: false, message: `Invalid set format: ${set}` };
    }

    const [a, b] = set.split("-").map(Number);

    if (i < 2) {
      const validNormalSet =
        (a === 6 && b <= 4) ||
        (b === 6 && a <= 4) ||
        (a === 7 && (b === 5 || b === 6)) ||
        (b === 7 && (a === 5 || a === 6));

      const validSuperTiebreakSet =
        (a >= 10 && a - b >= 2) ||
        (b >= 10 && b - a >= 2);

      if (!validNormalSet && !validSuperTiebreakSet) {
        return { valid: false, message: `Set score does not look valid: ${set}` };
      }
    } else {
      const validThirdSet =
        (a >= 10 && a - b >= 2) ||
        (b >= 10 && b - a >= 2) ||
        (a === 6 && b <= 4) ||
        (b === 6 && a <= 4) ||
        (a === 7 && (b === 5 || b === 6)) ||
        (b === 7 && (a === 5 || a === 6));

      if (!validThirdSet) {
        return { valid: false, message: `Third set score does not look valid: ${set}` };
      }
    }
  }

  return { valid: true };
}

async function validateMatchForm(formData) {
  const {
    matchType,
    team1Player1Id,
    team1Player2Id,
    team2Player1Id,
    team2Player2Id,
    winnerTeam,
    set1Team1Games,
    set1Team2Games,
    set2Team1Games,
    set2Team2Games,
    set3Team1Games,
    set3Team2Games,
    datePlayed
  } = formData;

  if (!matchType) return "Please select a match type.";
  if (!team1Player1Id || !team2Player1Id) return "Please select valid players.";
  if (matchType === "Doubles" && (!team1Player2Id || !team2Player2Id)) {
    return "Please select all four doubles players.";
  }
  if (![1, 2].includes(winnerTeam)) return "Please select the winning team.";
  if (!datePlayed) return "Please choose the date played.";

  const selectedIds = [team1Player1Id, team2Player1Id];
  if (matchType === "Doubles") selectedIds.push(team1Player2Id, team2Player2Id);

  const nonEmptyIds = selectedIds.filter(Boolean);
  const uniqueIds = new Set(nonEmptyIds);

  if (uniqueIds.size !== nonEmptyIds.length) {
    return "A player cannot appear on both sides of a match.";
  }

  if (!isValidSetScore(set1Team1Games, set1Team2Games)) return "Set 1 score is not valid.";
  if (!isValidSetScore(set2Team1Games, set2Team2Games)) return "Set 2 score is not valid.";

  if ((set3Team1Games !== null || set3Team2Games !== null) &&
      !isValidOptionalSetScore(set3Team1Games, set3Team2Games)) {
    return "Set 3 tiebreak score is not valid.";
  }

  const inferredWinner = determineWinnerFromScore(formData);
  if (inferredWinner !== null && inferredWinner !== winnerTeam) {
    return "Winner does not match the score entered.";
  }

  const scoreText = buildScoreText(
    set1Team1Games,
    set1Team2Games,
    set2Team1Games,
    set2Team2Games,
    set3Team1Games,
    set3Team2Games
  );

  const scoreCheck = validateTennisScore(scoreText);
  if (!scoreCheck.valid) return scoreCheck.message;

  return null;
}

function averageRating(players) {
  const validPlayers = players.filter(Boolean);
  if (!validPlayers.length) return 0;

  const total = validPlayers.reduce((sum, player) => {
    const rating = player.dynamic_rating ?? player.display_rating ?? 0;
    return sum + Number(rating || 0);
  }, 0);

  return total / validPlayers.length;
}

function buildScoringContext(formData, hydrated) {
  const {
    set1Team1Games,
    set1Team2Games,
    set2Team1Games,
    set2Team2Games,
    set3Team1Games,
    set3Team2Games
  } = formData;

  const sets = [
    [set1Team1Games, set1Team2Games],
    [set2Team1Games, set2Team2Games]
  ];

  if (set3Team1Games !== null && set3Team2Games !== null) {
    sets.push([set3Team1Games, set3Team2Games]);
  }

  const team1TotalGames = sets.reduce((sum, [a]) => sum + Number(a || 0), 0);
  const team2TotalGames = sets.reduce((sum, [, b]) => sum + Number(b || 0), 0);

  return {
    matchType: formData.matchType,
    winnerTeam: formData.winnerTeam,
    team1Players: hydrated.team1Players,
    team2Players: hydrated.team2Players,
    team1TotalGames,
    team2TotalGames
  };
}

function calculateMatchScoring({
  matchType,
  winnerTeam,
  team1Players,
  team2Players,
  team1TotalGames,
  team2TotalGames
}) {
  const team1AvgRating = averageRating(team1Players);
  const team2AvgRating = averageRating(team2Players);

  const ratingGap = Math.abs(team1AvgRating - team2AvgRating);
  const expectedTeam1 = 1 / (1 + Math.pow(10, (team2AvgRating - team1AvgRating) / 0.45));
  const expectedTeam2 = 1 - expectedTeam1;

  const actualTeam1 = winnerTeam === 1 ? 1 : 0;
  const actualTeam2 = winnerTeam === 2 ? 1 : 0;

  const totalGames = Math.max(team1TotalGames + team2TotalGames, 1);
  const marginRatio = Math.abs(team1TotalGames - team2TotalGames) / totalGames;

  let baseK = matchType === "Doubles" ? 0.1 : 0.12;
  baseK += Math.min(ratingGap * 0.04, 0.05);
  baseK += marginRatio * 0.06;

  const rawChangeTeam1 = roundToTwo((actualTeam1 - expectedTeam1) * baseK);
  const rawChangeTeam2 = roundToTwo((actualTeam2 - expectedTeam2) * baseK);

  const team1Change = Number.isFinite(rawChangeTeam1) ? rawChangeTeam1 : 0;
  const team2Change = Number.isFinite(rawChangeTeam2) ? rawChangeTeam2 : 0;

  const winnerGames = winnerTeam === 1 ? team1TotalGames : team2TotalGames;
  const loserGames = winnerTeam === 1 ? team2TotalGames : team1TotalGames;
  const gameMargin = Math.max(winnerGames - loserGames, 0);

  const winnerBonus = Math.min(Math.floor(gameMargin / 3), 5);
  const winnerPoints = 10 + winnerBonus;
  const loserPoints = 4;

  return {
    team1AvgRating: roundToTwo(team1AvgRating),
    team2AvgRating: roundToTwo(team2AvgRating),
    ratingChanges: [
      team1Change,
      team1Change,
      team2Change,
      team2Change
    ],
    ladderPoints: winnerTeam === 1
      ? [winnerPoints, winnerPoints, loserPoints, loserPoints]
      : [loserPoints, loserPoints, winnerPoints, winnerPoints]
  };
}

function buildMatchPayload({ formData, hydrated, scoringResult }) {
  const scoreText = buildScoreText(
    formData.set1Team1Games,
    formData.set1Team2Games,
    formData.set2Team1Games,
    formData.set2Team2Games,
    formData.set3Team1Games,
    formData.set3Team2Games
  );

  return {
    match_type: formData.matchType,
    score_text: scoreText,
    date_played: formData.datePlayed,
    submitted_by_name: formData.submittedBy || null,
    match_notes: formData.matchNotes || null,
    season_year: new Date(formData.datePlayed).getFullYear(),
    team1_player1_id: Number(formData.team1Player1Id),
    team1_player2_id: formData.matchType === "Doubles" ? Number(formData.team1Player2Id) : null,
    team2_player1_id: Number(formData.team2Player1Id),
    team2_player2_id: formData.matchType === "Doubles" ? Number(formData.team2Player2Id) : null,
    winner_team: formData.winnerTeam,
    set1_team1_games: formData.set1Team1Games,
    set1_team2_games: formData.set1Team2Games,
    set2_team1_games: formData.set2Team1Games,
    set2_team2_games: formData.set2Team2Games,
    set3_team1_games: formData.set3Team1Games,
    set3_team2_games: formData.set3Team2Games,
    team1_total_games: buildScoringContext(formData, hydrated).team1TotalGames,
    team2_total_games: buildScoringContext(formData, hydrated).team2TotalGames,
    team1_avg_rating: scoringResult.team1AvgRating,
    team2_avg_rating: scoringResult.team2AvgRating,
    rating_change_p1: scoringResult.ratingChanges[0],
    rating_change_p2: hydrated.team1Players[1] ? scoringResult.ratingChanges[1] : null,
    rating_change_p3: scoringResult.ratingChanges[2],
    rating_change_p4: hydrated.team2Players[1] ? scoringResult.ratingChanges[3] : null,
    ladder_points_p1: scoringResult.ladderPoints[0],
    ladder_points_p2: hydrated.team1Players[1] ? scoringResult.ladderPoints[1] : null,
    ladder_points_p3: scoringResult.ladderPoints[2],
    ladder_points_p4: hydrated.team2Players[1] ? scoringResult.ladderPoints[3] : null
  };
}

async function isDuplicateMatchSameDay(matchPayload) {
  const ids = [
    matchPayload.team1_player1_id,
    matchPayload.team1_player2_id,
    matchPayload.team2_player1_id,
    matchPayload.team2_player2_id
  ].filter(Boolean).sort((a, b) => a - b);

  const { data, error } = await supabaseClient
    .from("matches")
    .select(`
      id,
      date_played,
      team1_player1_id,
      team1_player2_id,
      team2_player1_id,
      team2_player2_id
    `)
    .eq("date_played", matchPayload.date_played);

  if (error) throw error;

  return (data || []).some((match) => {
    const matchIds = [
      match.team1_player1_id,
      match.team1_player2_id,
      match.team2_player1_id,
      match.team2_player2_id
    ].filter(Boolean).sort((a, b) => a - b);

    return JSON.stringify(ids) === JSON.stringify(matchIds);
  });
}

async function applyPlayerUpdates({
  team1Players,
  team2Players,
  winnerTeam,
  scoringResult,
  team1TotalGames,
  team2TotalGames
}) {
  const updates = [];

  function pushUpdate(player, ratingChange, ladderPoints, won, gamesWon, gamesLost) {
    if (!player) return;

    const currentDisplayRating = Number(player.display_rating ?? player.dynamic_rating ?? 0);
    const nextDisplayRating = roundToTwo(currentDisplayRating + Number(ratingChange || 0));

    updates.push({
      id: player.id,
      display_rating: nextDisplayRating,
      dynamic_rating: nextDisplayRating,
      rating: Math.round(nextDisplayRating * 100),
      ladder_points: Number(player.ladder_points || 0) + Number(ladderPoints || 0),
      wins: Number(player.wins || 0) + (won ? 1 : 0),
      losses: Number(player.losses || 0) + (won ? 0 : 1),
      games_won: Number(player.games_won || 0) + Number(gamesWon || 0),
      games_lost: Number(player.games_lost || 0) + Number(gamesLost || 0),
      matches_played: Number(player.matches_played || 0) + 1
    });
  }

  const team1Won = winnerTeam === 1;
  const team2Won = winnerTeam === 2;

  pushUpdate(
    team1Players[0],
    scoringResult.ratingChanges[0],
    scoringResult.ladderPoints[0],
    team1Won,
    team1TotalGames,
    team2TotalGames
  );

  pushUpdate(
    team1Players[1],
    scoringResult.ratingChanges[1],
    scoringResult.ladderPoints[1],
    team1Won,
    team1TotalGames,
    team2TotalGames
  );

  pushUpdate(
    team2Players[0],
    scoringResult.ratingChanges[2],
    scoringResult.ladderPoints[2],
    team2Won,
    team2TotalGames,
    team1TotalGames
  );

  pushUpdate(
    team2Players[1],
    scoringResult.ratingChanges[3],
    scoringResult.ladderPoints[3],
    team2Won,
    team2TotalGames,
    team1TotalGames
  );

  for (const update of updates) {
    const payload = {
      display_rating: update.display_rating,
      dynamic_rating: update.dynamic_rating,
      rating: update.rating,
      ladder_points: update.ladder_points,
      wins: update.wins,
      losses: update.losses,
      games_won: update.games_won,
      games_lost: update.games_lost,
      matches_played: update.matches_played
    };

    const { error } = await supabaseClient
      .from("players")
      .update(payload)
      .eq("id", update.id);

    if (error) return error;
  }

  return null;
}

function renderScoringRulesBox() {
  const box = document.getElementById("scoring-rules-box");
  if (!box) return;

  box.innerHTML = `
    <div class="scoring-rules-card">
      <h3>How points work</h3>
      <p><strong>Rating Adjustment:</strong> Ratings move after every match using a slower, NTRP-inspired formula based on player ratings, match result, and score margin.</p>
      <p><strong>Ladder Points:</strong> Winners earn 10 points plus up to 5 bonus points based on game margin. Losers earn 4 points.</p>
      <p><strong>Doubles:</strong> Teammates receive the same rating change and ladder points.</p>
    </div>
  `;
}

/* =========================
   DIRECTORY PAGE
========================= */

/* =========================
   DIRECTORY PAGE
========================= */

const DIRECTORY_PASSWORD = "Resto";
const DIRECTORY_SESSION_KEY = "rtl_directory_access";

const directoryState = {
  players: [],
  filteredPlayers: [],
  sortKey: "season_rank",
  sortDirection: "asc"
};

function formatDirectoryPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length !== 10) return String(phone || "—");
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function getDirectoryPhoneDigits(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function getDirectorySexBadge(sex) {
  const normalized = String(sex || "").trim().toLowerCase();

  if (normalized === "man" || normalized === "male" || normalized === "m") {
    return `<span class="directory-sex-badge sex-badge-m">M</span>`;
  }

  if (normalized === "woman" || normalized === "female" || normalized === "w" || normalized === "f") {
    return `<span class="directory-sex-badge sex-badge-w">W</span>`;
  }

  return `<span class="directory-sex-badge sex-badge-default">—</span>`;
}

function getSortedDirectoryPlayers(players) {
  const sorted = [...players].sort((a, b) => {
    const key = directoryState.sortKey;
    const direction = directoryState.sortDirection === "asc" ? 1 : -1;

    let aVal = a[key];
    let bVal = b[key];

    if (["name", "area", "phone", "sex"].includes(key)) {
      aVal = String(aVal || "").toLowerCase();
      bVal = String(bVal || "").toLowerCase();
    }

    if (["season_rank", "ladder_points", "display_rating"].includes(key)) {
      aVal = Number(aVal || 0);
      bVal = Number(bVal || 0);
    }

    if (aVal < bVal) return -1 * direction;
    if (aVal > bVal) return 1 * direction;

    const aName = String(a.name || "").toLowerCase();
    const bName = String(b.name || "").toLowerCase();
    if (aName < bName) return -1;
    if (aName > bName) return 1;

    return 0;
  });

  return sorted;
}

function updateDirectorySortIndicators() {
  const headers = document.querySelectorAll("#directory-table th[data-sort]");
  if (!headers.length) return;

  headers.forEach((header) => {
    const label = header.dataset.label || header.textContent.replace(" ▲", "").replace(" ▼", "");
    header.textContent = label;

    if (header.dataset.sort === directoryState.sortKey) {
      header.textContent = `${label} ${directoryState.sortDirection === "asc" ? "▲" : "▼"}`;
    }
  });
}

function setupDirectorySorting() {
  const headers = document.querySelectorAll("#directory-table th[data-sort]");
  if (!headers.length) return;

  headers.forEach((header) => {
    if (header.dataset.bound === "true") return;

    header.addEventListener("click", () => {
      const clickedKey = header.dataset.sort;
      if (!clickedKey) return;

      if (directoryState.sortKey === clickedKey) {
        directoryState.sortDirection = directoryState.sortDirection === "asc" ? "desc" : "asc";
      } else {
        directoryState.sortKey = clickedKey;

        if (["name", "area", "sex"].includes(clickedKey)) {
          directoryState.sortDirection = "asc";
        } else {
          directoryState.sortDirection = "desc";
        }

        if (clickedKey === "season_rank") {
          directoryState.sortDirection = "asc";
        }
      }

      renderDirectory(directoryState.filteredPlayers);
    });

    header.dataset.bound = "true";
  });

  updateDirectorySortIndicators();
}

function setupDirectoryPage() {
  const loginForm = document.getElementById("directory-login-form");
  const passwordInput = document.getElementById("directory-password");
  const loginMessage = document.getElementById("directory-login-message");
  const loginOverlay = document.getElementById("directory-login-overlay");
  const directoryPage = document.getElementById("directory-page");
  const searchInput = document.getElementById("directory-search");

  if (!loginForm || !passwordInput || !loginMessage || !loginOverlay || !directoryPage) return;

  const grantAccess = async () => {
    sessionStorage.setItem(DIRECTORY_SESSION_KEY, "granted");
    loginOverlay.classList.add("hidden");
    directoryPage.classList.remove("hidden");
    await loadDirectory();
  };

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (passwordInput.value.trim() !== DIRECTORY_PASSWORD) {
      loginMessage.textContent = "Incorrect password. Please try again.";
      passwordInput.value = "";
      passwordInput.focus();
      return;
    }

    loginMessage.textContent = "";
    await grantAccess();
  });

  if (searchInput && !searchInput.dataset.bound) {
    searchInput.addEventListener("input", () => {
      filterDirectoryPlayers(searchInput.value || "");
    });
    searchInput.dataset.bound = "true";
  }

  if (sessionStorage.getItem(DIRECTORY_SESSION_KEY) === "granted") {
    grantAccess();
  } else {
    passwordInput.focus();
  }
}

async function loadDirectory() {
  const tbody = document.getElementById("directory-body");
  const summary = document.getElementById("directory-summary");

  if (!tbody || !summary) return;

  setTableMessage(tbody, "Loading directory...", 7);
  summary.textContent = "Loading...";

  try {
    const { data, error } = await supabaseClient
      .from("players")
      .select("id, name, area, phone, display_rating, ladder_points, sex")
      .order("ladder_points", { ascending: false })
      .order("display_rating", { ascending: false })
      .order("name", { ascending: true });

    if (error) throw error;

    const players = (data || [])
      .filter((player) => player.name && player.phone)
      .map((player, index) => ({
        ...player,
        season_rank: index + 1
      }));

    directoryState.players = players;
    directoryState.filteredPlayers = players;

    setupDirectorySorting();
    renderDirectory(players);
  } catch (error) {
    console.error("Load directory error:", error);
    setTableMessage(tbody, "Error loading directory.", 7);
    summary.textContent = "Directory unavailable";
  }
}

function filterDirectoryPlayers(searchTerm) {
  const normalized = String(searchTerm || "").trim().toLowerCase();

  const filtered = directoryState.players.filter((player) =>
    [
      player.name || "",
      player.area || "",
      player.sex || "",
      formatDirectoryPhone(player.phone || "")
    ].some((value) => String(value).toLowerCase().includes(normalized))
  );

  directoryState.filteredPlayers = filtered;
  renderDirectory(filtered);
}

function renderDirectory(players) {
  const tbody = document.getElementById("directory-body");
  const summary = document.getElementById("directory-summary");

  if (!tbody || !summary) return;

  if (!players.length) {
    setTableMessage(tbody, "No matching players found.", 8);
    summary.textContent = "0 members shown";
    updateDirectorySortIndicators();
    return;
  }

  const sortedPlayers = getSortedDirectoryPlayers(players);

  tbody.innerHTML = sortedPlayers.map((player) => {
    const safeName = escapeHtml(player.name || "");
    const safeArea = escapeHtml(player.area || "—");
    const safeRating = formatDisplayRating(player.display_rating);
    const safePhone = formatDirectoryPhone(player.phone);
    const safePoints = Number(player.ladder_points || 0);
    const safeRank = Number(player.season_rank || 0);
    const sexBadge = getDirectorySexBadge(player.sex);
    const phoneDigits = getDirectoryPhoneDigits(player.phone);

    const firstName = String(player.name || "").split(" ")[0] || "";

    const challengeMessage = encodeURIComponent(
      `Hey ${firstName} — I'd like to schedule a match for the Resto Tennis Ladder. Want to play this week?`
    );

  return `
  <tr>
    <td class="num">${safeRank}</td>
    <td>${safeName}</td>
    <td>${sexBadge}</td>
    <td class="num">${safePoints}</td>
    <td class="directory-area">${safeArea}</td>
    <td class="num">${safeRating}</td>
    <td>${safePhone}</td>
    <td>
      <a class="directory-text-btn" href="sms:${phoneDigits}?body=${challengeMessage}">
        Text
      </a>
    </td>
  </tr>
    `;
  }).join("");

  summary.textContent = `${sortedPlayers.length} member${sortedPlayers.length === 1 ? "" : "s"} shown`;
  updateDirectorySortIndicators();
}

/* =========================
   MATCH HISTORY PAGE
========================= */

function setupHistoryFilterButtons() {
  const buttons = document.querySelectorAll(".history-filters .filter-btn, .history-filters .filter-chip");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const rawFilter = button.dataset.filter || "All";

      if (rawFilter.toLowerCase() === "all") state.history.filterType = "All";
      else if (rawFilter.toLowerCase() === "singles") state.history.filterType = "Singles";
      else if (rawFilter.toLowerCase() === "doubles") state.history.filterType = "Doubles";
      else state.history.filterType = "All";

      loadMatchHistory();
    });
  });

  const playerFilterInput = document.getElementById("history-player-filter");
  if (playerFilterInput && !playerFilterInput.dataset.bound) {
    playerFilterInput.addEventListener("input", () => {
      loadMatchHistory();
    });
    playerFilterInput.dataset.bound = "true";
  }
}

async function fetchMatches() {
  let query = supabaseClient
    .from("matches")
    .select(`
      id,
      match_type,
      winner_team,
      score_text,
      date_played,
      submitted_by_name,
      created_at,
      team1_player1_id,
      team1_player2_id,
      team2_player1_id,
      team2_player2_id,
      rating_change_p1,
      rating_change_p2,
      rating_change_p3,
      rating_change_p4,
      ladder_points_p1,
      ladder_points_p2,
      ladder_points_p3,
      ladder_points_p4,
      match_notes
    `)
    .order("date_played", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (state.history.filterType === "Singles" || state.history.filterType === "Doubles") {
    query = query.eq("match_type", state.history.filterType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function fetchPlayerNamesForMatches(matches) {
  const ids = new Set();

  matches.forEach((match) => {
    [
      match.team1_player1_id,
      match.team1_player2_id,
      match.team2_player1_id,
      match.team2_player2_id
    ].forEach((id) => {
      if (id !== null && id !== undefined) ids.add(id);
    });
  });

  const uniqueIds = [...ids];
  if (!uniqueIds.length) return {};

  const { data, error } = await supabaseClient
    .from("players")
    .select("id, name")
    .in("id", uniqueIds);

  if (error) {
    console.error("Player map load error:", error);
    return {};
  }

  const playerMap = {};
  (data || []).forEach((player) => {
    playerMap[player.id] = player.name;
  });

  return playerMap;
}

function buildMatchDisplay(match, playerMap) {
  const team1Names = [
    playerMap[match.team1_player1_id],
    playerMap[match.team1_player2_id]
  ].filter(Boolean);

  const team2Names = [
    playerMap[match.team2_player1_id],
    playerMap[match.team2_player2_id]
  ].filter(Boolean);

  return {
    team1Text: team1Names.join(" / "),
    team2Text: team2Names.join(" / "),
    playersText: `${team1Names.join(" / ")} vs ${team2Names.join(" / ")}`
  };
}

function renderMatchExtras(match, playerMap) {
  const rows = [];

  function addRow(playerId, ratingChange, ladderPoints) {
    if (!playerId) return;
    rows.push(`
      <div class="match-extra-row">
        <span class="match-extra-name">${escapeHtml(playerMap[playerId] || "Player")}</span>
        <span class="match-extra-stat">Rating: ${escapeHtml(formatSignedNumber(ratingChange))}</span>
        <span class="match-extra-stat">Points: ${escapeHtml(String(ladderPoints ?? "—"))}</span>
      </div>
    `);
  }

  addRow(match.team1_player1_id, match.rating_change_p1, match.ladder_points_p1);
  addRow(match.team1_player2_id, match.rating_change_p2, match.ladder_points_p2);
  addRow(match.team2_player1_id, match.rating_change_p3, match.ladder_points_p3);
  addRow(match.team2_player2_id, match.rating_change_p4, match.ladder_points_p4);

  if (!rows.length) return "";
  return `<div class="match-extras">${rows.join("")}</div>`;
}

function formatRatingChange(value) {
  const num = Number(value || 0);
  return `${num > 0 ? "+" : ""}${num.toFixed(2)}`;
}

function formatLadderPoints(value) {
  const num = Number(value || 0);
  return `${num > 0 ? "+" : ""}${num}`;
}

function getDeltaClass(value) {
  const num = Number(value || 0);
  if (num > 0) return "positive";
  if (num < 0) return "negative";
  return "neutral";
}

function renderMatchPlayerImpact(match, display) {
  const rows = [];

  if (display.team1Player1) {
    rows.push({
      name: display.team1Player1,
      rating: match.rating_change_p1,
      points: match.ladder_points_p1
    });
  }

  if (display.team1Player2) {
    rows.push({
      name: display.team1Player2,
      rating: match.rating_change_p2,
      points: match.ladder_points_p2
    });
  }

  if (display.team2Player1) {
    rows.push({
      name: display.team2Player1,
      rating: match.rating_change_p3,
      points: match.ladder_points_p3
    });
  }

  if (display.team2Player2) {
    rows.push({
      name: display.team2Player2,
      rating: match.rating_change_p4,
      points: match.ladder_points_p4
    });
  }

  if (!rows.length) return "";

  return `
    <div class="history-player-impact">
      ${rows.map((row) => `
        <div class="history-player-impact-row">
          <span class="history-player-impact-name">${escapeHtml(row.name)}</span>
          <span class="history-player-impact-metrics">
            <span class="rating-change ${getDeltaClass(row.rating)}">
              ${formatRatingChange(row.rating)} rating
            </span>
            <span class="impact-separator">•</span>
            <span class="ladder-points">
              ${formatLadderPoints(row.points)} pts
            </span>
          </span>
        </div>
      `).join("")}
    </div>
  `;
}

async function loadMatchHistory() { 
  const container = document.getElementById("history-list");
  if (!container) return;

  container.innerHTML = "<p>Loading match history...</p>";
  setActiveFilterButton(".history-filters", state.history.filterType);

  try {
    const matches = await fetchMatches();
    const playerMap = await fetchPlayerNamesForMatches(matches);

    const playerFilterValue = (document.getElementById("history-player-filter")?.value || "").trim().toLowerCase();

    const filteredMatches = playerFilterValue
      ? matches.filter((match) => {
          const display = buildMatchDisplay(match, playerMap);
          return display.playersText.toLowerCase().includes(playerFilterValue);
        })
      : matches;

    if (!filteredMatches.length) {
      container.innerHTML = "<p>No matches found.</p>";
      return;
    }

    container.innerHTML = filteredMatches.map((match) => {
      const display = buildMatchDisplay(match, playerMap);
      const winnerText = match.winner_team === 1 ? display.team1Text : display.team2Text;

      return `
        <div class="history-item fade-in-card premium-match-card">
          <div class="history-top-row">
            <div class="history-title-group">
              <h3>${escapeHtml(match.match_type || "Match")}</h3>
            </div>
            <span class="winner-pill">Winner: ${escapeHtml(winnerText || "—")}</span>
          </div>

          <div class="history-meta">
            <strong>Date:</strong> ${escapeHtml(safeDateText(match.date_played))}
            ${match.submitted_by_name ? ` • <strong>Submitted by:</strong> ${escapeHtml(match.submitted_by_name)}` : ""}
          </div>

          <div class="history-matchup">
            <strong>Players:</strong> ${escapeHtml(display.playersText)}
          </div>

          <div class="history-score">
            <strong>Score:</strong> ${escapeHtml(match.score_text || "")}
          </div>

          ${renderMatchPlayerImpact(match, display)}

          ${match.match_notes ? `
            <div class="history-meta">
              <strong>Notes:</strong> ${escapeHtml(match.match_notes)}
            </div>
          ` : ""}

          ${renderMatchExtras(match, playerMap)}
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error("Load match history error:", error);
    container.innerHTML = "<p>Error loading match history.</p>";
  }
}

/* =========================
   PLAYER PROFILE PAGE
========================= */

async function fetchPlayerById(playerId) {
  const { data, error } = await supabaseClient
    .from("players")
    .select(`
      id,
      name,
      sex,
      area,
      display_rating,
      dynamic_rating,
      ladder_points,
      wins,
      losses,
      games_won,
      games_lost,
      matches_played
    `)
    .eq("id", playerId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function fetchMatchesForPlayer(playerId) {
  const pid = Number(playerId);

  const { data, error } = await supabaseClient
    .from("matches")
    .select(`
      id,
      match_type,
      winner_team,
      score_text,
      date_played,
      created_at,
      team1_player1_id,
      team1_player2_id,
      team2_player1_id,
      team2_player2_id,
      rating_change_p1,
      rating_change_p2,
      rating_change_p3,
      rating_change_p4,
      ladder_points_p1,
      ladder_points_p2,
      ladder_points_p3,
      ladder_points_p4
    `)
    .order("date_played", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || []).filter((match) =>
    [
      match.team1_player1_id,
      match.team1_player2_id,
      match.team2_player1_id,
      match.team2_player2_id
    ].includes(pid)
  );
}

function getPlayerMatchPerspective(match, playerId) {
  const pid = Number(playerId);

  if (match.team1_player1_id === pid) {
    return {
      won: match.winner_team === 1,
      ratingChange: match.rating_change_p1,
      ladderPoints: match.ladder_points_p1
    };
  }

  if (match.team1_player2_id === pid) {
    return {
      won: match.winner_team === 1,
      ratingChange: match.rating_change_p2,
      ladderPoints: match.ladder_points_p2
    };
  }

  if (match.team2_player1_id === pid) {
    return {
      won: match.winner_team === 2,
      ratingChange: match.rating_change_p3,
      ladderPoints: match.ladder_points_p3
    };
  }

  if (match.team2_player2_id === pid) {
    return {
      won: match.winner_team === 2,
      ratingChange: match.rating_change_p4,
      ladderPoints: match.ladder_points_p4
    };
  }

  return null;
}

async function loadPlayerProfile() {
  const container = document.getElementById("player-profile");
  if (!container) return;

  const playerId = getPlayerIdFromUrl();
  if (!playerId) {
    container.innerHTML = "<p>Player not found.</p>";
    return;
  }

  try {
    const player = await fetchPlayerById(playerId);

    if (!player) {
      container.innerHTML = "<p>Player not found.</p>";
      return;
    }

    container.innerHTML = `
      <div class="profile-header">
        <h2>${escapeHtml(player.name || "Player")}</h2>
        <p class="small-text">
          ${escapeHtml(player.sex || "—")} • ${escapeHtml(player.area || "—")}
        </p>
      </div>

      <div class="profile-stats">
        <div class="profile-stat">
          <div class="profile-stat-label">Rating</div>
          <div class="profile-stat-value">${formatDisplayRating(player.display_rating)}</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-label">Ladder Points</div>
          <div class="profile-stat-value">${player.ladder_points ?? 0}</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-label">Record</div>
          <div class="profile-stat-value">${player.wins ?? 0}-${player.losses ?? 0}</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-label">Win %</div>
          <div class="profile-stat-value">${calculateWinPercentage(player.wins, player.losses)}</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-label">Games Won</div>
          <div class="profile-stat-value">${player.games_won ?? 0}</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-label">Games Lost</div>
          <div class="profile-stat-value">${player.games_lost ?? 0}</div>
        </div>
      </div>

      <div class="profile-actions">
        <a href="report.html?opponentId=${player.id}" class="button">Report a Match Against ${escapeHtml(player.name || "Player")}</a>
      </div>
    `;

    await renderPlayerRatingTrend(playerId, player.display_rating);
  } catch (error) {
    console.error("Load player profile error:", error);
    container.innerHTML = "<p>Error loading player profile.</p>";
  }
}

async function loadPlayerMatchHistory() {
  const container = document.getElementById("player-match-history");
  if (!container) return;

  const playerId = getPlayerIdFromUrl();
  if (!playerId) {
    container.innerHTML = "<p>Player not found.</p>";
    return;
  }

  container.innerHTML = "<p>Loading player match history...</p>";

  try {
    const matches = await fetchMatchesForPlayer(playerId);
    const playerMap = await fetchPlayerNamesForMatches(matches);

    if (!matches.length) {
      container.innerHTML = "<p>No matches found for this player.</p>";
      return;
    }

    const reversed = [...matches].sort(sortByDateDesc);

    container.innerHTML = reversed.map((match) => {
      const display = buildMatchDisplay(match, playerMap);
      const perspective = getPlayerMatchPerspective(match, playerId);
      const resultClass = perspective?.won ? "win" : "loss";
      const resultText = perspective?.won ? "Win" : "Loss";

      return `
        <div class="history-item fade-in-card premium-match-card">
          <div class="history-top-row">
            <div class="history-title-group">
              <h3>${escapeHtml(match.match_type || "Match")}</h3>
            </div>
            <span class="winner-pill ${resultClass}">${resultText}</span>
          </div>

          <div class="history-meta">
            <strong>Date:</strong> ${escapeHtml(safeDateText(match.date_played))}
          </div>

          <div class="history-matchup">
            <strong>Players:</strong> ${escapeHtml(display.playersText)}
          </div>

          <div class="history-score">
            <strong>Score:</strong> ${escapeHtml(match.score_text || "")}
          </div>

          <div class="match-impact-grid">
            <div class="match-impact-card">
              <div class="match-impact-name">Rating Change</div>
              <div class="match-impact-value">${formatSignedNumber(perspective?.ratingChange)}</div>
            </div>
            <div class="match-impact-card">
              <div class="match-impact-name">Ladder Points</div>
              <div class="match-impact-value">${perspective?.ladderPoints ?? "—"}</div>
            </div>
          </div>
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error("Load player history error:", error);
    container.innerHTML = "<p>Error loading player history.</p>";
  }
}

async function renderPlayerRatingTrend(playerId, currentDisplayRating) {
  const canvas = document.getElementById("rating-trend-canvas");
  if (!canvas || typeof Chart === "undefined") return;

  try {
    const matches = await fetchMatchesForPlayer(playerId);
    if (!matches.length) return;

    const perspectives = matches
      .map((match) => ({
        match,
        perspective: getPlayerMatchPerspective(match, playerId)
      }))
      .filter((item) => item.perspective);

    let running = Number(currentDisplayRating ?? 0);
    const ratings = [];

    for (let i = perspectives.length - 1; i >= 0; i--) {
      ratings.unshift(roundToTwo(running));
      running = roundToTwo(running - Number(perspectives[i].perspective.ratingChange || 0));
    }

    const labels = perspectives.map((item) => item.match.date_played || "");

    const ctx = canvas.getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Rating",
            data: ratings,
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            ticks: {
              callback: (value) => Number(value).toFixed(2)
            }
          }
        }
      }
    });
  } catch (error) {
    console.error("Render rating trend error:", error);
  }
}

/* =========================
   REALTIME
========================= */

function setupRealtimeSubscriptions() {
  try {
    if (state.realtime.playersChannel) supabaseClient.removeChannel(state.realtime.playersChannel);
    if (state.realtime.matchesChannel) supabaseClient.removeChannel(state.realtime.matchesChannel);

    state.realtime.playersChannel = supabaseClient
      .channel("players-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        async () => {
          if (getLadderBodyEl()) await loadLadder();
          if (document.getElementById("directory-body")) await loadDirectory();
          if (document.getElementById("report-form")) await populatePlayerDropdowns();
          if (document.getElementById("player-profile")) await loadPlayerProfile();
        }
      )
      .subscribe();

    state.realtime.matchesChannel = supabaseClient
      .channel("matches-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        async () => {
          if (getLadderBodyEl()) await loadLadder();
          if (document.getElementById("activity-feed")) await loadActivityFeed();
          if (document.getElementById("match-of-week")) await loadMatchOfWeek();
          if (document.getElementById("history-list")) await loadMatchHistory();
          if (document.getElementById("player-match-history")) await loadPlayerMatchHistory();
          if (document.getElementById("player-profile")) await loadPlayerProfile();
          if (document.getElementById("player-h2h-section")) await loadPlayerH2H();
        }
      )
      .subscribe();
  } catch (error) {
    console.error("Realtime setup error:", error);
  }
}