const SUPABASE_URL = "https://jntspohwzkugcuisoofm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CgGyn2sReCxWz6Li9QnWnw_kC-8CgVO";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  ladder: {
    filterSex: "All",
    search: "",
    sortBy: "ladder_points",
    sortDir: "desc",
    showMoreStats: false,
    userHasSorted: false
  },
  history: {
    filterType: "All",
    myMatchesOnly: false
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


/* =========================
   MATCH CARD MODAL (Feature 4)
========================= */

function showMatchCardModal(matchData) {
  // Remove any existing modal
  document.getElementById("match-card-overlay")?.remove();

  const { type, winner, loser, score, date, notes } = matchData;

  const overlay = document.createElement("div");
  overlay.className = "match-card-overlay";
  overlay.id = "match-card-overlay";

  overlay.innerHTML = `
    <div class="match-card-modal" role="dialog" aria-modal="true" aria-label="Match result card">
      <div class="mcm-header">
        <p class="mcm-badge">${escapeHtml(type || "Match")} Result</p>
        <p class="mcm-winner">${escapeHtml(winner || "—")}</p>
        <p class="mcm-score">${escapeHtml(score || "")}</p>
      </div>
      <div class="mcm-body">
        <div class="mcm-row">
          <span class="mcm-label">Winner</span>
          <span class="mcm-value">${escapeHtml(winner || "—")}</span>
        </div>
        <div class="mcm-row">
          <span class="mcm-label">Loser</span>
          <span class="mcm-value">${escapeHtml(loser || "—")}</span>
        </div>
        <div class="mcm-row">
          <span class="mcm-label">Score</span>
          <span class="mcm-value">${escapeHtml(score || "—")}</span>
        </div>
        <div class="mcm-row">
          <span class="mcm-label">Date</span>
          <span class="mcm-value">${escapeHtml(date || "—")}</span>
        </div>
        ${notes ? `
        <div class="mcm-row">
          <span class="mcm-label">Notes</span>
          <span class="mcm-value">${escapeHtml(notes)}</span>
        </div>` : ""}
      </div>
      <div class="mcm-footer">
        <button class="mcm-btn-copy" id="mcm-copy-btn">Copy Result</button>
        <button class="mcm-btn-close" id="mcm-close-btn">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const copyText = `${type} Result\nWinner: ${winner}\nLoser: ${loser}\nScore: ${score}\nDate: ${date}${notes ? "\nNotes: " + notes : ""}\nRestoration Tennis Ladder`;

  overlay.querySelector("#mcm-copy-btn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      const btn = overlay.querySelector("#mcm-copy-btn");
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = "Copy Result"; }, 2000);
    } catch (_) {}
  });

  overlay.querySelector("#mcm-close-btn").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
}

document.addEventListener("DOMContentLoaded", async () => {
  setupMobileMenu();
  initMyLadderNav(); // always — injects button and sets label from localStorage
  try {
    if (document.getElementById("join-form")) handleJoinForm();
    if (document.getElementById("report-form")) await setupReportForm();
    if (document.getElementById("phone")) setupPhoneFormatting();

    if (getLadderBodyEl()) {
      setupLadderSearch();
      setupLadderFilterButtons();
      setupLadderSorting();
      setupShowMoreStats();
      await loadLadder();
    }

    if (document.getElementById("home-stats")) {
      await loadHomeStats();
      await loadMyLadderCard(); // injected before stat cards, no-op if no player selected
    }
    if (document.getElementById("weather-widget")) loadWeatherWidget(); // fire-and-forget — hides itself on error
    if (document.getElementById("activity-feed")) await loadActivityFeed();
    if (document.getElementById("season-story")) await loadSeasonStory();

    if (document.getElementById("match-of-week")) await loadMatchOfWeek();
    if (document.getElementById("history-list")) {
      setupHistoryFilterButtons();
      addMyMatchesChip(); // added only if a player is identified
      await loadMatchHistory();
    }

    if (document.getElementById("directory-body")) {
      setupDirectoryPage();
    }

    if (document.getElementById("player-profile")) {
      await loadPlayerProfile();
    }
    if (document.getElementById("gauntlet-section")) await loadGauntlet();
    if (document.getElementById("player-h2h-section")) await loadPlayerH2H();
    if (document.getElementById("player-doubles-section")) await loadDoublesPartners();
    if (document.getElementById("dropin-section")) await renderDropInSection();

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

// Returns a map of id -> displayName for a set of players in the same match context.
// Unique first names show as "First"; shared first names show as "First L."
// The last initial is taken from the LAST word of the full name (handles middle names correctly).
function disambiguateNames(playerObjects) {
  const firstNames = {};
  playerObjects.forEach(p => {
    if (!p || !p.name) return;
    const first = p.name.trim().split(/\s+/)[0];
    if (!firstNames[first]) firstNames[first] = [];
    firstNames[first].push(p);
  });
  const displayNames = {};
  playerObjects.forEach(p => {
    if (!p || !p.name) return;
    const parts  = p.name.trim().split(/\s+/);
    const first  = parts[0];
    const lastInitial = parts[parts.length - 1]?.[0] || "";
    if (firstNames[first].length > 1) {
      // Shared first name — use "First L." to disambiguate
      displayNames[p.id] = lastInitial ? `${first} ${lastInitial}.` : p.name;
    } else {
      // Unique first name — use full name
      displayNames[p.id] = p.name;
    }
  });
  return displayNames;
}

function sortPlayersForStandings(players) {
  return [...players].sort((a, b) => {
    const byPoints = compareValues(a.ladder_points ?? 0, b.ladder_points ?? 0, "desc");
    if (byPoints !== 0) return byPoints;

    const byDynamicRating = compareValues(a.dynamic_rating ?? 0, b.dynamic_rating ?? 0, "desc");
    if (byDynamicRating !== 0) return byDynamicRating;

    const byWins = compareValues(a.wins ?? 0, b.wins ?? 0, "desc");
    if (byWins !== 0) return byWins;

    const bySOS = compareValues(a.sos ?? 0, b.sos ?? 0, "desc");
    if (bySOS !== 0) return bySOS;

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

      if (!area) {
        showError("Please select your area of the DMV.");
        return;
      }

      const numericRating = parseFloat(rating);
      if (!Number.isFinite(numericRating)) {
        showError("Please choose a valid self-rating.");
        return;
      }

      if (!sex) {
        showError("Please select your sex.");
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
        initial_rating: numericRating,
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
          <p>Welcome to the Restoration Tennis Ladder. You’ll appear in the rankings shortly.</p>
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
  return document.getElementById("ladder-body");
}

function getLadderColspan() {
  return state.ladder.showMoreStats ? 16 : 9;
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
          ["name", "sex", "area", "status", "season_rank"].includes(sortBy) ? "asc" : "desc";
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
      matches_played,
      previous_rank,
      mini_games_won,
      mini_games_lost,
      incomplete_matches
    `);

  if (error) throw error;
  return data || [];
}

async function fetchRecentMatchesForStatus() {
  const { data, error } = await supabaseClient
    .from("matches")
    .select(`
      id,
      match_type,
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

async function fetchAllMatchesForSOS() {
  const { data, error } = await supabaseClient
    .from("matches")
    .select(`
      id,
      team1_player1_id, team1_player2_id,
      team2_player1_id, team2_player2_id,
      team1_avg_rating, team2_avg_rating
    `);
  if (error) {
    console.error("SOS match fetch error:", error);
    return [];
  }
  return data || [];
}

function calculatePlayerSOS(playerId, allMatches, sexMap) {
  const pid = Number(playerId);
  const oppRatings = [];

  for (const match of allMatches) {
    const t1ids = [match.team1_player1_id, match.team1_player2_id].filter(Boolean);
    const t2ids = [match.team2_player1_id, match.team2_player2_id].filter(Boolean);
    const onTeam1 = t1ids.includes(pid);
    const onTeam2 = t2ids.includes(pid);
    if (!onTeam1 && !onTeam2) continue;

    const oppIds    = onTeam1 ? t2ids : t1ids;
    const storedAvg = onTeam1 ? match.team2_avg_rating : match.team1_avg_rating;
    if (storedAvg == null) continue;

    const isMixed = matchIsMixedGender(match, sexMap);
    const unadj   = unadjustedTeamRating(storedAvg, oppIds, sexMap, isMixed);
    if (unadj != null) oppRatings.push(unadj);
  }

  if (!oppRatings.length) return null;
  return roundToTwo(oppRatings.reduce((a, b) => a + b, 0) / oppRatings.length);
}

function getPlayerStatus(playerId, matches) {
  const pid = Number(playerId);

  const playerMatches = matches
    .filter((match) =>
      match.match_type !== "mini" &&
      match.match_type !== "retired" &&
      [
        match.team1_player1_id,
        match.team1_player2_id,
        match.team2_player1_id,
        match.team2_player2_id
      ].includes(pid)
    )
    .sort(sortByDateDesc);

  if (!playerMatches.length) return "New";

  const lastThree = playerMatches.slice(0, 3).map((match) => {
    const onTeam1 = [match.team1_player1_id, match.team1_player2_id].includes(pid);
    return (onTeam1 && match.winner_team === 1) || (!onTeam1 && match.winner_team === 2);
  });

  if (lastThree.length === 3 && lastThree.every(Boolean)) return "Hot";
  if (lastThree.length === 3 && lastThree.every((result) => !result)) return "On a Slide";

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
    // For SOS, null/undefined always sorts to the bottom regardless of direction
    if (sortBy === "sos") {
      const aNull = a.sos == null;
      const bNull = b.sos == null;
      if (aNull && bNull) return compareValues(a.name || "", b.name || "", "asc");
      if (aNull) return 1;
      if (bNull) return -1;
    }

    const primary = compareValues(a[sortBy], b[sortBy], sortDir);
    if (primary !== 0) return primary;

    const secondary = compareValues(a.ladder_points ?? 0, b.ladder_points ?? 0, "desc");
    if (secondary !== 0) return secondary;

    const tertiary = compareValues(a.wins ?? 0, b.wins ?? 0, "desc");
    if (tertiary !== 0) return tertiary;

    return compareValues(a.name || "", b.name || "", "asc");
  });
}


function getRankBadge(index) {
  if (index === 0) return '<span class="rank-medal">🥇</span>';
  if (index === 1) return '<span class="rank-medal">🥈</span>';
  if (index === 2) return '<span class="rank-medal">🥉</span>';
  return index + 1;
}

function getRankMovementHtml(currentRank, previousRank) {
  if (!previousRank) return "";
  const diff = previousRank - currentRank;
  if (diff > 0) return `<span class="rank-move rank-move-up" title="Up ${diff}">▲${diff}</span>`;
  if (diff < 0) return `<span class="rank-move rank-move-down" title="Down ${Math.abs(diff)}">▼${Math.abs(diff)}</span>`;
  return `<span class="rank-move rank-move-same" title="No change">—</span>`;
}

function setupStickyTableHeader(table) {
  // Remove previous clone and cancel previous listeners
  const prevClone = document.getElementById('ladder-sticky-header-clone');
  if (prevClone) prevClone.remove();
  if (table._stickyController) table._stickyController.abort();
  if (table._stickyResizeObs) table._stickyResizeObs.disconnect();
  if (table._stickyMutationObs) table._stickyMutationObs.disconnect();

  const thead = table.querySelector('thead');
  const tableWrap = table.closest('.table-wrap');
  if (!thead || !tableWrap) return;

  const ac = new AbortController();
  table._stickyController = ac;

  const getHeaderHeight = () =>
    document.querySelector('.site-header')?.offsetHeight || 68;

  // Fixed-position clone container
  const clone = document.createElement('div');
  clone.id = 'ladder-sticky-header-clone';
  clone.className = 'ladder-sticky-header-clone';
  clone.style.position = 'fixed';
  clone.style.zIndex = '100';
  clone.style.overflowX = 'auto';
  clone.style.overflowY = 'hidden';
  clone.style.scrollbarWidth = 'none';
  clone.style.msOverflowStyle = 'none';
  clone.style.pointerEvents = 'none';
  clone.style.display = 'none';
  clone.style.background = 'transparent';

  // Wrap cloned thead in a real table so .ladder-table CSS rules (backgrounds,
  // borders, sticky columns) apply correctly
  const cloneTable = document.createElement('table');
  cloneTable.className = table.className;
  cloneTable.style.tableLayout = 'fixed';
  cloneTable.style.borderCollapse = 'separate';
  cloneTable.style.borderSpacing = '0';

  const cloneThead = thead.cloneNode(true);
  cloneTable.appendChild(cloneThead);
  clone.appendChild(cloneTable);
  document.body.appendChild(clone);

  function syncWidths() {
    const ths = Array.from(thead.querySelectorAll('th'));
    const cloneThs = Array.from(cloneThead.querySelectorAll('th'));
    ths.forEach((th, i) => {
      if (!cloneThs[i]) return;
      const w = th.getBoundingClientRect().width;
      cloneThs[i].style.width = w + 'px';
      cloneThs[i].style.minWidth = w + 'px';
      cloneThs[i].style.maxWidth = w + 'px';
    });
    cloneTable.style.width = table.scrollWidth + 'px';
    cloneTable.style.minWidth = table.scrollWidth + 'px';
  }

  function updatePosition() {
    const rect = tableWrap.getBoundingClientRect();
    clone.style.top = getHeaderHeight() + 'px';
    clone.style.left = rect.left + 'px';
    clone.style.width = rect.width + 'px';
  }

  function syncScroll() {
    clone.scrollLeft = tableWrap.scrollLeft;
  }

  // Mirror show-more-stats class to clone table so column visibility stays in sync
  const mutationObs = new MutationObserver(() => {
    cloneTable.className = table.className;
    requestAnimationFrame(syncWidths);
  });
  mutationObs.observe(table, { attributes: true, attributeFilter: ['class'] });
  table._stickyMutationObs = mutationObs;

  // Show clone when thead has scrolled above the fixed nav
  let ioObserver;
  function createObserver() {
    if (ioObserver) ioObserver.disconnect();
    ioObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        clone.style.display = 'none';
      } else if (entry.boundingClientRect.top < 0) {
        syncWidths();
        syncScroll();
        clone.style.display = 'block';
      } else {
        clone.style.display = 'none';
      }
    }, {
      threshold: 0,
      rootMargin: `-${getHeaderHeight()}px 0px 0px 0px`
    });
    ioObserver.observe(thead);
  }

  tableWrap.addEventListener('scroll', syncScroll, { passive: true, signal: ac.signal });

  if (window.ResizeObserver) {
    const resizeObs = new ResizeObserver(() => {
      syncWidths();
      syncScroll();
    });
    resizeObs.observe(table);
    table._stickyResizeObs = resizeObs;
  }

  // Orientation change and window resize: update top offset and column widths,
  // recreate observer with updated rootMargin for new header height
  window.addEventListener('resize', () => {
    updatePosition();
    syncWidths();
    createObserver();
  }, { passive: true, signal: ac.signal });

  updatePosition();
  syncWidths();
  createObserver();
}

function renderLadder(players) {
  const ladderBody = getLadderBodyEl();
  if (!ladderBody) return;

  if (!players.length) {
    setTableMessage(ladderBody, "No players found.", getLadderColspan());
    return;
  }

  const mePlayer = getMyLadderPlayer();

  ladderBody.innerHTML = players.map((player, index) => {
    const rank = index + 1;
    const badge = getRankBadge(index);
    const isMe = mePlayer && String(player.id) === String(mePlayer.id);

    let rowClass = "fade-in-row";
    if (isMe) rowClass += " rank-me";
    else if (rank === 1) rowClass += " rank-1";
    else if (rank === 2) rowClass += " rank-2";
    else if (rank === 3) rowClass += " rank-3";
    else if (rank <= 10) rowClass += " rank-top-10";

    const moveHtml = getRankMovementHtml(rank, player.previous_rank);
    const youTag = isMe ? '<span class="rank-me-tag">← You</span>' : "";

    return `
      <tr class="${rowClass}">
        <td>${badge}${moveHtml}</td>
        <td><a class="player-link" href="player.html?id=${player.id}">${escapeHtml(player.name || "")}</a>${youTag}</td>
        <td>${escapeHtml(player.area || "")}</td>
        <td class="num">${player.ladder_points ?? 0}</td>
        <td class="num">${player.wins ?? 0}</td>
        <td class="num">${player.losses ?? 0}</td>
        <td class="num">${formatDisplayRating(player.dynamic_rating)}</td>
        <td>${escapeHtml(player.status || "—")}</td>
        <td class="num">${player.sos != null ? player.sos : "—"}</td>
        <td class="num">${player.games_won ?? 0}</td>
        <td class="num">${player.games_lost ?? 0}</td>
        <td class="num">${player.matches_played ?? 0}</td>
        <td>
          ${player.sex?.toLowerCase().startsWith("m")
            ? '<span class="ladder-badge badge-men">M</span>'
            : '<span class="ladder-badge badge-women">W</span>'}
        </td>
        <td class="num">${player.mini_games_won ?? 0}</td>
        <td class="num">${player.mini_games_lost ?? 0}</td>
        <td class="num">${player.incomplete_matches > 0 ? player.incomplete_matches : "—"}</td>
      </tr>
    `;
  }).join("");

  if (mePlayer) {
    requestAnimationFrame(() => {
      const meRow = ladderBody.querySelector(".rank-me");
      if (meRow) meRow.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  // Set up JS clone-based sticky header after DOM paints (getBoundingClientRect needs layout)
  requestAnimationFrame(() => {
    const tbl = document.querySelector('.ladder-table');
    if (tbl) setupStickyTableHeader(tbl);
  });
}

async function loadLadder() {
  const ladderBody = getLadderBodyEl();
  if (!ladderBody) return;

  setActiveFilterButton(".ladder-filters", state.ladder.filterSex);
  setTableMessage(ladderBody, "Loading rankings...", getLadderColspan());

  try {
    const [players, recentMatches, sosMatches] = await Promise.all([
      fetchPlayers(),
      fetchRecentMatchesForStatus(),
      fetchAllMatchesForSOS()
    ]);

    const sexMap = {};
    players.forEach(p => { sexMap[p.id] = p.sex || ""; });

    const playersWithStatus = players.map((player) => ({
      ...player,
      status: getPlayerStatus(player.id, recentMatches),
      sos: calculatePlayerSOS(player.id, sosMatches, sexMap)
    }));

    // Assign overall standings rank before filtering so it stays consistent
    // across Men's / Women's / All views and when the user sorts by Rank.
    sortPlayersForStandings(playersWithStatus).forEach((p, i) => { p.season_rank = i + 1; });

    const filtered = applyLadderFilters(playersWithStatus);
    const sorted = state.ladder.userHasSorted
      ? sortPlayers(filtered)
      : sortPlayersForStandings(filtered);

    renderLadder(sorted);
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
    <a href="ladder.html" class="stat-card">
      <div class="stat-value">${playerCount}</div>
      <div class="stat-label">Players</div>
    </a>
    <a href="history.html" class="stat-card">
      <div class="stat-value">${matchCount}</div>
      <div class="stat-label">Matches Played</div>
    </a>
    <a href="ladder.html" class="stat-card">
      <div class="stat-value">${daysLeft}</div>
      <div class="stat-label">Days Left</div>
    </a>
  `;
}

/* =========================
   WEATHER WIDGET
========================= */

async function loadWeatherWidget() {
  const container = document.getElementById("weather-widget");
  if (!container) return;

  try {
    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=38.8816&longitude=-77.0910" +
      "&current=temperature_2m,weathercode,windspeed_10m" +
      "&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=America%2FNew_York"
    );
    if (!res.ok) { container.style.display = "none"; return; }

    const data = await res.json();
    const { temperature_2m: tempRaw, weathercode: code, windspeed_10m: windRaw } = data.current;
    const temp = Math.round(tempRaw);
    const wind = Math.round(windRaw);

    // Step 1 — severe/unplayable conditions override everything
    let message, accent;
    if (code >= 95) {
      message = "⛈️ Thunderstorms — do not play";                        accent = "red";
    } else if (code >= 80) {
      message = "🌦️ Showers expected — check before you go";             accent = "red";
    } else if (code >= 51 && code <= 67) {
      message = "🌧️ Rain today — courts likely wet";                     accent = "red";
    } else if (code >= 71 && code <= 77) {
      message = "❄️ Snow — courts closed";                               accent = "red";
    } else if (code >= 45 && code <= 48) {
      message = "🌫️ Foggy — check conditions before heading out";        accent = "amber";
    } else {
      // Step 2 — temperature is the primary driver for playable conditions
      let base;
      if      (temp >= 95) { base = "🌡️ Very hot — stay hydrated and take breaks";              accent = "amber"; }
      else if (temp >= 88) { base = "☀️ Hot day — bring water and sunscreen";                   accent = "amber"; }
      else if (temp >= 78) { base = "☀️ Great conditions — ideal tennis weather";               accent = "green"; }
      else if (temp >= 68) { base = "🌤️ Perfect conditions for tennis";                        accent = "green"; }
      else if (temp >= 58) { base = "⛅ Comfortable — a light layer might help between games"; accent = "amber"; }
      else if (temp >= 48) { base = "🧥 Cool out — dress in layers and warm up well";           accent = "amber"; }
      else                 { base = "🥶 Cold — bundle up if you're heading out";               accent = "amber"; }

      // Step 3 — append wind modifier when significant
      let wind_note = "";
      if      (wind > 35) wind_note = " · 💨 Dangerously windy — consider rescheduling";
      else if (wind > 25) wind_note = " · 💨 Very windy — tough conditions today";
      else if (wind > 15) wind_note = " · 🌬️ Windy — expect the ball to move";
      else if (wind >= 10) wind_note = " · Light breeze — factor it into your serve";

      message = base + wind_note;
    }

    container.innerHTML = `
      <div class="weather-card weather-${escapeHtml(accent)}">
        <div class="weather-location">Arlington, VA</div>
        <div class="weather-condition">${escapeHtml(message)}</div>
        <div class="weather-detail">${temp}°F · ${wind} mph winds</div>
      </div>
    `;
  } catch (_) {
    container.style.display = "none";
  }
}

/* =========================
   ACTIVITY FEED
========================= */

async function loadActivityFeed() {
  const container = document.getElementById("activity-feed");
  if (!container) return;

  try {
    // Fetch a wider window to catch mini-games in last 10 days alongside recent ladder matches
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { data, error } = await supabaseClient
      .from("matches")
      .select(`
        id, match_type, winner_team, score_text, date_played, created_at,
        team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id
      `)
      .gte("date_played", tenDaysAgo)
      .order("date_played", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    const allRecent = data || [];

    // Separate mini-games from real matches
    const miniMatches   = allRecent.filter(m => m.match_type === "mini");
    const realAndOther  = allRecent.filter(m => m.match_type !== "mini");

    // Take the 5 most recent non-mini matches for the feed
    const feedMatches = realAndOther.slice(0, 5);

    if (!feedMatches.length && !miniMatches.length) {
      container.innerHTML = `
        <h2>Recent Activity</h2>
        <p class="small-text">No matches reported yet — be the first!</p>
      `;
      return;
    }

    const playerMap = await fetchPlayerNamesForMatches(feedMatches);

    // Build aggregate mini entry if any mini-games played recently
    let miniEntry = null;
    if (miniMatches.length > 0) {
      const mostRecentMini = miniMatches[0].date_played || miniMatches[0].created_at;
      const miniTimeAgo = relativeTime(mostRecentMini);
      miniEntry = {
        date_played: miniMatches[0].date_played,
        html: `<li class="activity-feed-item activity-dropin">
          <span style="color:#10b981;font-weight:600;">🎾 ${miniMatches.length} drop-in game${miniMatches.length === 1 ? "" : "s"} played at the last drop-in night</span> — <a href="ladder.html" class="player-link">see player profiles for results</a> · ${escapeHtml(miniTimeAgo)}
        </li>`
      };
    }

    const items = feedMatches.map((match, i) => {
      const feedPlayerObjs = [
        match.team1_player1_id, match.team1_player2_id,
        match.team2_player1_id, match.team2_player2_id,
      ].filter(Boolean).map(id => ({ id, name: playerMap[id] })).filter(p => p.name);
      const feedNameMap = disambiguateNames(feedPlayerObjs);
      const feedName = id => id ? (feedNameMap[id] || abbreviateName(playerMap[id])) : "";
      const timeAgo = relativeTime(match.date_played || match.created_at);

      // Retired / incomplete match: show as pending
      if (match.match_type === "retired") {
        const allIds = [match.team1_player1_id, match.team1_player2_id, match.team2_player1_id, match.team2_player2_id].filter(Boolean);
        const playerLinks = allIds.map(id => `<a href="player.html?id=${id}" class="player-link">${escapeHtml(feedName(id))}</a>`).join(" &amp; ");
        return { date_played: match.date_played, html: `<li class="activity-feed-item${i === 0 ? " activity-new" : ""}">
          🏳️ <strong>${playerLinks}</strong> have an incomplete match pending · ${escapeHtml(timeAgo)}
        </li>` };
      }

      const winnerIds = match.winner_team === 1
        ? [match.team1_player1_id, match.team1_player2_id]
        : [match.team2_player1_id, match.team2_player2_id];
      const loserIds = match.winner_team === 1
        ? [match.team2_player1_id, match.team2_player2_id]
        : [match.team1_player1_id, match.team1_player2_id];

      const winnerLinks = winnerIds.filter(Boolean)
        .map(id => `<a href="player.html?id=${id}" class="player-link">${escapeHtml(feedName(id))}</a>`)
        .join(" &amp; ");
      const loserLinks = loserIds.filter(Boolean)
        .map(id => `<a href="player.html?id=${id}" class="player-link">${escapeHtml(feedName(id))}</a>`)
        .join(" &amp; ");
      const score = match.score_text ? ` · ${escapeHtml(winnerFirstScore(match.score_text, match.winner_team))}` : "";
      const type  = match.match_type || "Match";

      return { date_played: match.date_played, html: `<li class="activity-feed-item${i === 0 ? " activity-new" : ""}">
        <strong>${winnerLinks}</strong> defeated <strong>${loserLinks}</strong>${score} · ${escapeHtml(type)} · ${escapeHtml(timeAgo)}
      </li>` };
    });

    // Insert the mini aggregate entry in chronological position
    const allEntries = miniEntry ? [...items, miniEntry] : items;
    allEntries.sort((a, b) => (b.date_played || "").localeCompare(a.date_played || ""));
    const htmlItems = allEntries.map(e => e.html);

    container.innerHTML = `
      <h2>Recent Activity</h2>
      <ul class="activity-feed-list">${htmlItems.join("")}</ul>
    `;
  } catch (error) {
    console.error("Activity feed error:", error);
  }
}

/* =========================
   SEASON STORY SO FAR
========================= */

async function loadSeasonStory() {
  const container = document.getElementById("season-story");
  if (!container) return;

  try {
    const [playersRes, matchesRes] = await Promise.all([
      supabaseClient.from("players").select(
        "id, name, sex, dynamic_rating, initial_rating, ladder_points, wins, losses, matches_played, previous_rank"
      ),
      supabaseClient.from("matches").select(
        "id, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, " +
        "team1_avg_rating, team2_avg_rating, winner_team, date_played, " +
        "match_type, score_text, team1_total_games, team2_total_games, " +
        "ladder_points_p1, ladder_points_p2, ladder_points_p3, ladder_points_p4"
      )
    ]);

    const players = playersRes.data || [];
    const matches = matchesRes.data || [];

    if (!players.length || !matches.length) {
      container.innerHTML = "<h2>📖 Season Story So Far</h2><p class=\"season-story-text\">The 2026 season is just getting started — no results yet. Check back once matches are in.</p>";
      return;
    }

    const sexMap = {};
    players.forEach(p => { sexMap[p.id] = p.sex || ""; });

    const standings    = sortPlayersForStandings(players);
    const menPlayers   = sortPlayersForStandings(players.filter(p => p.sex === "Man"));
    const womenPlayers = sortPlayersForStandings(players.filter(p => p.sex === "Woman"));

    const totalMatches   = matches.filter(m => m.match_type !== "mini" && m.match_type !== "retired").length;
    const activePlayers  = players.filter(p => (p.matches_played ?? 0) > 0);
    const inactivePlayers = players.length - activePlayers.length;
    const totalPlayers   = players.length;

    const overallLeader = standings[0];
    const overallSecond = standings[1];
    const mensLeader    = menPlayers[0];
    const womensLeader  = womenPlayers[0];

    const pointsGap = (overallLeader && overallSecond)
      ? (overallLeader.ladder_points ?? 0) - (overallSecond.ladder_points ?? 0)
      : 0;

    // Split matches: real ladder matches (excludes mini and retired)
    const realMatches = matches.filter(m => m.match_type !== "mini" && m.match_type !== "retired");

    // Most improved: biggest dynamic_rating gain from initial_rating
    const playerMap = {};
    players.forEach(p => { playerMap[p.id] = p.name; });

    const mostImproved = activePlayers.length
      ? [...activePlayers].sort((a, b) =>
          ((b.dynamic_rating ?? 0) - (b.initial_rating ?? 0)) -
          ((a.dynamic_rating ?? 0) - (a.initial_rating ?? 0))
        )[0]
      : null;
    const mostImprovedGain = mostImproved
      ? roundToTwo((mostImproved.dynamic_rating ?? 0) - (mostImproved.initial_rating ?? 0))
      : 0;

    // Biggest upset: match where winner had lowest pre-match win probability (real matches only)
    let biggestUpsetMatch   = null;
    let biggestUpsetWinner  = "";
    let biggestUpsetLoser   = "";
    let biggestUpsetProb    = 1;

    for (const match of realMatches) {
      const t1avg = Number(match.team1_avg_rating);
      const t2avg = Number(match.team2_avg_rating);
      if (!t1avg || !t2avg) continue;

      const winnerAvg = match.winner_team === 1 ? t1avg : t2avg;
      const loserAvg  = match.winner_team === 1 ? t2avg : t1avg;
      const prob = 1 / (1 + Math.pow(10, (loserAvg - winnerAvg) / 0.45));

      if (prob < biggestUpsetProb) {
        biggestUpsetProb  = prob;
        biggestUpsetMatch = match;
        const wIds = (match.winner_team === 1
          ? [match.team1_player1_id, match.team1_player2_id]
          : [match.team2_player1_id, match.team2_player2_id]).filter(Boolean);
        const lIds = (match.winner_team === 1
          ? [match.team2_player1_id, match.team2_player2_id]
          : [match.team1_player1_id, match.team1_player2_id]).filter(Boolean);
        biggestUpsetWinner = wIds.map(id => playerMap[id] || "").filter(Boolean).join(" / ");
        biggestUpsetLoser  = lIds.map(id => playerMap[id] || "").filter(Boolean).join(" / ");
      }
    }

    // Highest SOS among active players
    let topSOSPlayer = null;
    let topSOSValue  = -1;
    for (const p of activePlayers) {
      const sos = calculatePlayerSOS(p.id, matches, sexMap);
      if (sos != null && sos > topSOSValue) { topSOSValue = sos; topSOSPlayer = p; }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    const fn = name => {
      if (!name) return "";
      return escapeHtml(name.split(" / ")[0].trim().split(" ")[0]);
    };

    // Daily seed — text rotates each day, stable within a day
    const seed = new Date().toISOString().slice(0, 10);
    const seededRand = (i) => {
      let h = 0; const s = seed + i;
      for (let j = 0; j < s.length; j++) { h = ((h << 5) - h) + s.charCodeAt(j); h |= 0; }
      return Math.abs(h) / 2147483647;
    };
    const pick = (arr, i) => arr[Math.floor(seededRand(i) * arr.length)];

    // ── New data computations ─────────────────────────────────────────────────

    // Total points from real ladder matches only (mini points shown separately in rankings)
    const totalPoints = realMatches.reduce((sum, m) =>
      sum + (Number(m.ladder_points_p1) || 0) + (Number(m.ladder_points_p2) || 0) +
            (Number(m.ladder_points_p3) || 0) + (Number(m.ladder_points_p4) || 0), 0);

    // Times men's #1 changed hands — replay all matches (mini included, they add to ladder_points)
    const chromoMatches = [...matches].sort((a, b) => a.date_played.localeCompare(b.date_played));
    const rPts = {};
    let curMensLead = null;
    let timesLeadChanged = 0;
    for (const m of chromoMatches) {
      [
        [m.team1_player1_id, m.ladder_points_p1],
        [m.team1_player2_id, m.ladder_points_p2],
        [m.team2_player1_id, m.ladder_points_p3],
        [m.team2_player2_id, m.ladder_points_p4],
      ].forEach(([pid, pts]) => {
        if (pid && pts != null) rPts[pid] = (rPts[pid] || 0) + Number(pts);
      });
      let topP = -1, topId = null;
      for (const [pid, p] of Object.entries(rPts)) {
        if (sexMap[pid] === "Man" && p > topP) { topP = p; topId = pid; }
      }
      if (topId && topId !== curMensLead) {
        if (curMensLead !== null) timesLeadChanged++;
        curMensLead = topId;
      }
    }

    // Top 3 men and women — disambiguate within each top-3 group
    const mensTop3Objs   = menPlayers.slice(0, 3).map(p => ({ id: p.id, name: p.name }));
    const womensTop3Objs = womenPlayers.slice(0, 3).map(p => ({ id: p.id, name: p.name }));
    const mensTop3Names   = disambiguateNames(mensTop3Objs);
    const womensTop3Names = disambiguateNames(womensTop3Objs);
    const mensTop3    = menPlayers.slice(0, 3).map(p => ({ name: mensTop3Names[p.id] || fn(p.name), points: p.ladder_points ?? 0 }));
    const womensTop3  = womenPlayers.slice(0, 3).map(p => ({ name: womensTop3Names[p.id] || fn(p.name), points: p.ladder_points ?? 0 }));

    // Season clock
    const seasonStart     = new Date("2026-04-17");
    const seasonEnd       = new Date("2026-11-01");
    const todayDate       = new Date();
    const msPerWeek       = 7 * 24 * 60 * 60 * 1000;
    const seasonWeek      = Math.max(1, Math.ceil((todayDate - seasonStart) / msPerWeek));
    const totalSeasonWeeks = Math.ceil((seasonEnd - seasonStart) / msPerWeek);
    const weeksLeft       = Math.max(0, totalSeasonWeeks - seasonWeek);

    // Biggest rank mover in last 10 days
    const tenDaysAgoStr = new Date(todayDate - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const curRankMap = {};
    standings.forEach((p, i) => { curRankMap[p.id] = i + 1; });
    const recentPids = new Set();
    for (const m of realMatches) { // only real matches count for rank movement
      if (m.date_played >= tenDaysAgoStr) {
        [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id]
          .filter(Boolean).forEach(pid => recentPids.add(String(pid)));
      }
    }
    let biggestMover = null;
    let biggestMoverMag = 0;
    for (const pidStr of recentPids) {
      const player = players.find(p => String(p.id) === pidStr);
      if (!player) continue;
      const prev = player.previous_rank, curr = curRankMap[player.id];
      if (!prev || !curr) continue;
      const change = prev - curr;
      if (Math.abs(change) > biggestMoverMag) {
        biggestMoverMag = Math.abs(change);
        let rW = 0, rL = 0;
        for (const m of matches) {
          if (m.date_played < tenDaysAgoStr) continue;
          const t1 = [m.team1_player1_id, m.team1_player2_id].filter(Boolean).map(String);
          const t2 = [m.team2_player1_id, m.team2_player2_id].filter(Boolean).map(String);
          if (t1.includes(pidStr))      { m.winner_team === 1 ? rW++ : rL++; }
          else if (t2.includes(pidStr)) { m.winner_team === 2 ? rW++ : rL++; }
        }
        biggestMover = { name: fn(player.name), spots: Math.abs(change),
          direction: change > 0 ? "up" : "down", recentWins: rW, recentLosses: rL };
      }
    }

    // Last 4 real (non-mini) matches, newest first — with per-match disambiguated first names
    const recentFour = [...realMatches]
      .sort((a, b) => b.date_played.localeCompare(a.date_played))
      .slice(0, 4)
      .map(m => {
        const allMIds = [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id].filter(Boolean);
        const mObjs   = allMIds.map(id => ({ id, name: playerMap[id] })).filter(p => p.name);
        const mNames  = disambiguateNames(mObjs);
        const dispN   = id => id ? (mNames[id] || fn(playerMap[id] || "")) : "";

        const wIds = (m.winner_team === 1
          ? [m.team1_player1_id, m.team1_player2_id]
          : [m.team2_player1_id, m.team2_player2_id]).filter(Boolean);
        const lIds = (m.winner_team === 1
          ? [m.team2_player1_id, m.team2_player2_id]
          : [m.team1_player1_id, m.team1_player2_id]).filter(Boolean);
        const t1a = Number(m.team1_avg_rating), t2a = Number(m.team2_avg_rating);
        let winProb = null;
        if (t1a && t2a) {
          const wA = m.winner_team === 1 ? t1a : t2a, lA = m.winner_team === 1 ? t2a : t1a;
          winProb = Math.round(100 / (1 + Math.pow(10, (lA - wA) / 0.45)));
        }
        return {
          winner:     wIds.map(dispN).filter(Boolean).join(" & "),
          loser:      lIds.map(dispN).filter(Boolean).join(" & "),
          score:      m.score_text ? winnerFirstScore(m.score_text, m.winner_team) : "",
          winProb,
          totalGames: (Number(m.team1_total_games) || 0) + (Number(m.team2_total_games) || 0),
          matchType:  m.match_type || "Singles",
        };
      })
      .filter(m => m.winner && m.loser);

    // Highlight 1: most surprising (lowest win prob); fallback: most games
    const hl1 = recentFour.length
      ? [...recentFour].sort((a, b) => {
          if (a.winProb !== null && b.winProb !== null) return a.winProb - b.winProb;
          return b.totalGames - a.totalGames;
        })[0]
      : null;
    // Highlight 2: most total games from the remaining matches
    const hl2 = recentFour.length > 1
      ? recentFour.filter(m => m !== hl1).sort((a, b) => b.totalGames - a.totalGames)[0]
      : null;

    const playersWithMatches = activePlayers.length;

    // ── SENTENCE 1: Season numbers ────────────────────────────────────────────
    const s1 = pick([
      `${totalMatches} matches played, ${totalPoints} points on the board${timesLeadChanged > 1 ? `, and the men's top spot has changed hands ${timesLeadChanged} times` : ""} — the ${new Date().getFullYear()} ladder is well underway.`,
      `The ladder has ${totalMatches} matches in the books and ${totalPoints} total points awarded — and things are just getting started.`,
      `${totalPoints} points distributed across ${totalMatches} matches. The ${new Date().getFullYear()} season is finding its shape.`,
      `${totalMatches} matches played and ${totalPoints} points earned so far this season${timesLeadChanged > 2 ? ` — the men's lead has already flipped ${timesLeadChanged} times` : ""}.`,
      `Through ${totalMatches} matches and ${totalPoints} points, the ${new Date().getFullYear()} ladder has enough data to start telling a real story.`,
    ], 1);

    // ── SENTENCE 2: Men's top 3 ───────────────────────────────────────────────
    let s2 = "";
    if (mensTop3.length >= 3) {
      const gap12 = mensTop3[0].points - mensTop3[1].points;
      const gap23 = mensTop3[1].points - mensTop3[2].points;
      s2 = pick([
        `${mensTop3[0].name} leads the men with ${mensTop3[0].points} points, ${gap12} ahead of ${mensTop3[1].name}, with ${mensTop3[2].name} another ${gap23} back in third.`,
        `On the men's side: ${mensTop3[0].name} at ${mensTop3[0].points}, ${mensTop3[1].name} ${gap12} back, ${mensTop3[2].name} ${gap23} further behind — ${gap12 <= 8 ? "tight at the top" : "some separation starting to form"}.`,
        `${mensTop3[0].name} holds the men's top spot at ${mensTop3[0].points} points with ${gap12 <= 5 ? `${mensTop3[1].name} right behind at ${mensTop3[1].points}` : `a ${gap12}-point edge over ${mensTop3[1].name}`}. ${mensTop3[2].name} is third at ${mensTop3[2].points}.`,
        `Men's ladder: ${mensTop3[0].name} (${mensTop3[0].points}), ${mensTop3[1].name} (${mensTop3[1].points}, -${gap12}), ${mensTop3[2].name} (${mensTop3[2].points}, -${gap12 + gap23}). ${gap12 <= 8 ? "Nobody has run away with it yet." : "The gap is starting to matter."}`,
        `${gap12 <= 5 ? `${mensTop3[0].name} and ${mensTop3[1].name} are ${gap12} points apart at the top of the men's ladder` : `${mensTop3[0].name} leads the men by ${gap12} over ${mensTop3[1].name}`} — ${mensTop3[2].name} sits third at ${mensTop3[2].points}.`,
      ], 2);
    } else if (mensTop3.length === 2) {
      const g = mensTop3[0].points - mensTop3[1].points;
      s2 = `${mensTop3[0].name} leads the men at ${mensTop3[0].points} points, ${g} ahead of ${mensTop3[1].name}.`;
    } else if (mensTop3.length === 1) {
      s2 = `${mensTop3[0].name} leads the men's ladder at ${mensTop3[0].points} points.`;
    }

    // ── SENTENCE 3: Women's top 3 ─────────────────────────────────────────────
    let s3 = "";
    if (womensTop3.length >= 3) {
      const gap12w = womensTop3[0].points - womensTop3[1].points;
      const gap23w = womensTop3[1].points - womensTop3[2].points;
      s3 = pick([
        `${womensTop3[0].name} leads the women at ${womensTop3[0].points} points, ${gap12w <= 3 ? `with ${womensTop3[1].name} just ${gap12w} back in what has been a tight race all season` : `${gap12w} ahead of ${womensTop3[1].name}`}. ${womensTop3[2].name} is third.`,
        `Women's side: ${womensTop3[0].name} on top at ${womensTop3[0].points}, ${womensTop3[1].name} at ${womensTop3[1].points}, ${womensTop3[2].name} at ${womensTop3[2].points}. ${gap12w <= 5 ? "One match separates first from second." : "Some distance opening up at the top."}`,
        `${womensTop3[0].name} leads the women's ladder with ${womensTop3[0].points} points — ${gap12w} clear of ${womensTop3[1].name}, with ${womensTop3[2].name} rounding out the top three.`,
        `On the women's side, ${womensTop3[0].name} holds first at ${womensTop3[0].points}, ${gap12w} ahead of ${womensTop3[1].name}. ${womensTop3[2].name} is in third at ${womensTop3[2].points}.`,
        `${womensTop3[0].name} (${womensTop3[0].points} pts) leads ${womensTop3[1].name} (${womensTop3[1].points} pts) by ${gap12w} on the women's side. ${womensTop3[2].name} is third at ${womensTop3[2].points}.`,
      ], 3);
    } else if (womensTop3.length === 2) {
      const gw = womensTop3[0].points - womensTop3[1].points;
      s3 = `${womensTop3[0].name} leads the women at ${womensTop3[0].points} points, ${gw} ahead of ${womensTop3[1].name}.`;
    } else if (womensTop3.length === 1) {
      s3 = `${womensTop3[0].name} leads the women's ladder at ${womensTop3[0].points} points.`;
    }

    // ── SENTENCE 4: Season clock ──────────────────────────────────────────────
    const s4 = pick([
      `We're in week ${seasonWeek} of ${totalSeasonWeeks} — ${weeksLeft} weeks left to play.`,
      `${seasonWeek} weeks in, ${weeksLeft} to go. The season is ${Math.round((seasonWeek / totalSeasonWeeks) * 100)}% complete.`,
      `The finish line is November 1st. That's ${weeksLeft} more weeks of tennis.`,
      `Week ${seasonWeek} of ${totalSeasonWeeks}. Enough time left for everything to change.`,
      `${weeksLeft} weeks remain in the ${new Date().getFullYear()} season. There is still plenty of ladder left to climb.`,
    ], 4);

    // ── SENTENCE 5: Biggest mover last 10 days ────────────────────────────────
    let s5 = "The standings have been fairly locked in this week — which means anyone who plays next has a real chance to shake things up.";
    if (biggestMover && biggestMover.spots >= 2) {
      if (biggestMover.direction === "up") {
        s5 = pick([
          `${biggestMover.name} is the story of the last 10 days — up ${biggestMover.spots} spots after ${biggestMover.recentWins > 0 ? `going ${biggestMover.recentWins}-${biggestMover.recentLosses}` : "a strong showing"}.`,
          `Keep an eye on ${biggestMover.name}, who climbed ${biggestMover.spots} places in the standings over the past 10 days.`,
          `${biggestMover.name} has moved up ${biggestMover.spots} spots in the last 10 days and is starting to make some noise.`,
          `The biggest mover recently is ${biggestMover.name} — up ${biggestMover.spots} in the standings and trending the right direction.`,
        ], 5);
      } else {
        s5 = pick([
          `${biggestMover.name} has slipped ${biggestMover.spots} spots in the last 10 days — a stretch worth reversing.`,
          `On the other side, ${biggestMover.name} has dropped ${biggestMover.spots} places recently and will want to get back on court.`,
          `${biggestMover.name} has fallen ${biggestMover.spots} spots in the standings over the past 10 days.`,
          `${biggestMover.name} is down ${biggestMover.spots} in the last 10 days — the ladder moves fast.`,
        ], 5);
      }
    }

    // ── SENTENCE 6: Match highlight 1 ────────────────────────────────────────
    let s6 = "";
    if (hl1) {
      const h1s     = hl1.score ? ` ${hl1.score}` : "";
      const h1upset = hl1.winProb !== null && hl1.winProb < 40;
      s6 = pick([
        `${h1upset ? `The result of the week: ${escapeHtml(hl1.winner)} over ${escapeHtml(hl1.loser)} at ${hl1.winProb}% odds` : `${escapeHtml(hl1.winner)} over ${escapeHtml(hl1.loser)}`}${h1s}${h1upset ? ", which nobody saw coming" : ", a result that mattered"}.`,
        `${escapeHtml(hl1.winner)} beat ${escapeHtml(hl1.loser)}${h1s}${h1upset ? ` as a ${hl1.winProb}% underdog — the upset of the recent stretch` : " in a match worth noting"}.`,
        `${h1upset ? `${hl1.winProb}% — that's what the system gave ${escapeHtml(hl1.winner)} before they beat ${escapeHtml(hl1.loser)}${h1s}` : `${escapeHtml(hl1.winner)} over ${escapeHtml(hl1.loser)}${h1s} — a result that moved the needle`}.`,
        `Recent highlight: ${escapeHtml(hl1.winner)} def. ${escapeHtml(hl1.loser)}${h1s}${h1upset ? ". The ladder did not predict that one." : "."}`,
      ], 6);
    }

    // ── SENTENCE 7: Match highlight 2 ────────────────────────────────────────
    let s7 = "";
    if (hl2) {
      const h2s = hl2.score ? ` ${hl2.score}` : "";
      s7 = pick([
        `${escapeHtml(hl2.winner)} and ${escapeHtml(hl2.loser)} also played recently —${h2s}, ${hl2.totalGames} standard games, ${hl2.matchType.toLowerCase()}.`,
        `Also worth noting: ${escapeHtml(hl2.winner)} over ${escapeHtml(hl2.loser)}${h2s}.`,
        `${escapeHtml(hl2.winner)} beat ${escapeHtml(hl2.loser)}${h2s} in a ${hl2.matchType.toLowerCase()} that earned both sides meaningful points.`,
        `${hl2.matchType === "Doubles" ? "On the doubles side" : "Also"}, ${escapeHtml(hl2.winner)} over ${escapeHtml(hl2.loser)}${h2s}.`,
      ], 7);
    }

    // ── SENTENCE 8: Participation ─────────────────────────────────────────────
    const s8 = pick([
      `${playersWithMatches} of ${totalPlayers} registered players have now competed — ${totalPlayers - playersWithMatches} are still waiting for the right moment.`,
      `${playersWithMatches} players have stepped on court this season out of ${totalPlayers} registered.`,
      `The ladder has ${totalPlayers} players signed up. ${playersWithMatches} have played. The other ${totalPlayers - playersWithMatches} are still on deck.`,
      `${totalPlayers - playersWithMatches} registered players haven't played yet. The standings are going to look different when they do.`,
    ], 8);

    // ── Assemble — filter null/empty, join into paragraph ─────────────────────
    const parts = [s1, s2, s3, s4, s5, s6, s7, s8].filter(Boolean);

    container.innerHTML = `
      <h2>📖 Season Story So Far</h2>
      <p class="season-story-text">${parts.join(" ")}</p>
    `;
  } catch (err) {
    console.error("Season story error:", err);
    container.innerHTML = "<h2>📖 Season Story So Far</h2><p class=\"small-text\">Unable to load season story.</p>";
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

    const matches = (data || []).filter(m => m.match_type !== "mini" && m.match_type !== "retired");
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
    const statText = isUpset ? "" : `${mostGamesTotal} total games played`;

    const playerMap = await fetchPlayerNamesForMatches([featured]);
    const dateStr = featured.date_played
      ? new Date(featured.date_played).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "";

    // Build linked team names for winner and loser (disambiguated first names)
    const motwAllIds = [
      featured.team1_player1_id, featured.team1_player2_id,
      featured.team2_player1_id, featured.team2_player2_id,
    ].filter(Boolean);
    const motwObjs = motwAllIds.map(id => ({ id, name: playerMap[id] })).filter(p => p.name);
    const motwNames = disambiguateNames(motwObjs);
    const linkedTeam = (ids) => ids.filter(Boolean)
      .map(id => `<a href="player.html?id=${id}" class="player-link">${escapeHtml(motwNames[id] || playerMap[id] || "?")}</a>`)
      .join(" / ");
    const winnerIds = featured.winner_team === 1
      ? [featured.team1_player1_id, featured.team1_player2_id]
      : [featured.team2_player1_id, featured.team2_player2_id];
    const loserIds = featured.winner_team === 1
      ? [featured.team2_player1_id, featured.team2_player2_id]
      : [featured.team1_player1_id, featured.team1_player2_id];
    const winnerLinked = linkedTeam(winnerIds);
    const loserLinked  = linkedTeam(loserIds);

    container.style.display = "";
    container.innerHTML = `
      <div class="motw-card">
        <div class="motw-header">
          <span class="motw-badge">⚡ Match of the Week</span>
          <span class="motw-descriptor">${escapeHtml(descriptor)}</span>
        </div>
        <div class="motw-result">
          <span class="motw-winner">${winnerLinked}</span>
          <span class="motw-defeated">defeated</span>
          <span class="motw-loser">${loserLinked}</span>
        </div>
        <div class="motw-details">
          <span>${escapeHtml(winnerFirstScore(featured.score_text || "", featured.winner_team))}</span>
          <span>·</span>
          <span>${escapeHtml(featured.match_type || "")}</span>
          <span>·</span>
          <span>${escapeHtml(dateStr)}</span>
        </div>
        ${statText ? `<div class="motw-stat">${escapeHtml(statText)}</div>` : ""}
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
      if (match.match_type === "mini" || match.match_type === "retired") continue; // excluded from H2H
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
   DOUBLES PARTNERS TABLE
========================= */

async function loadDoublesPartners() {
  const container = document.getElementById("player-doubles-section");
  if (!container) return;

  const playerId = getPlayerIdFromUrl();
  if (!playerId) { container.style.display = "none"; return; }

  const emptyState = () => {
    container.innerHTML = `
      <h2>🤝 Doubles Partners</h2>
      <p class="small-text" style="color: var(--muted); margin: 0;">No doubles matches yet</p>
    `;
  };

  try {
    const matches = await fetchMatchesForPlayer(playerId);
    const pid = Number(playerId);

    const doubles = matches.filter(m => m.match_type === "Doubles");
    if (!doubles.length) { emptyState(); return; }

    const partners = {};

    for (const match of doubles) {
      const onTeam1 = [match.team1_player1_id, match.team1_player2_id].includes(pid);
      const won = onTeam1 ? match.winner_team === 1 : match.winner_team === 2;

      const partnerId = onTeam1
        ? (match.team1_player1_id === pid ? match.team1_player2_id : match.team1_player1_id)
        : (match.team2_player1_id === pid ? match.team2_player2_id : match.team2_player1_id);

      if (!partnerId) continue;
      if (!partners[partnerId]) partners[partnerId] = { wins: 0, losses: 0 };
      won ? partners[partnerId].wins++ : partners[partnerId].losses++;
    }

    const partnerIds = Object.keys(partners).map(Number);
    if (!partnerIds.length) { emptyState(); return; }

    const { data: partnerData } = await supabaseClient
      .from("players").select("id, name").in("id", partnerIds);

    const partnerMap = {};
    (partnerData || []).forEach(p => { partnerMap[p.id] = p; });

    const sorted = [...partnerIds].sort((a, b) => {
      const ta = partners[a].wins + partners[a].losses;
      const tb = partners[b].wins + partners[b].losses;
      if (tb !== ta) return tb - ta;
      return (partnerMap[a]?.name || "").localeCompare(partnerMap[b]?.name || "");
    });

    container.innerHTML = `
      <h2>🤝 Doubles Partners</h2>
      <div class="table-wrap">
        <table class="h2h-table">
          <thead>
            <tr>
              <th>Partner</th>
              <th class="num">W</th>
              <th class="num">L</th>
              <th class="num">Record</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(partnerId => {
              const rec = partners[partnerId];
              const partner = partnerMap[partnerId];
              const nameHtml = partner
                ? `<a href="player.html?id=${partner.id}" class="player-link">${escapeHtml(partner.name)}</a>`
                : "Unknown";
              return `<tr>
                <td>${nameHtml}</td>
                <td class="num">${rec.wins}</td>
                <td class="num">${rec.losses}</td>
                <td class="num">${rec.wins}-${rec.losses}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    console.error("Doubles partners load error:", error);
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

  function retiredIsDoubles() {
    return document.getElementById("retired-doubles-btn")?.classList.contains("active") ?? false;
  }

  function toggleDoublesFields() {
    const isDoubles  = matchTypeSelect?.value === "Doubles";
    const isMini     = matchTypeSelect?.value === "mini";
    const isRetired  = matchTypeSelect?.value === "retired";

    // Partner slots — shown for Doubles, or retired-doubles
    const showDoubles = isDoubles || (isRetired && retiredIsDoubles());
    if (team1Player2Wrap) team1Player2Wrap.style.display = showDoubles ? "block" : "none";
    if (team2Player2Wrap) team2Player2Wrap.style.display = showDoubles ? "block" : "none";
    if (team1Player2) team1Player2.required = showDoubles;
    if (team2Player2) team2Player2.required = showDoubles;
    if (!showDoubles) {
      if (team1Player2) team1Player2.value = "";
      if (team2Player2) team2Player2.value = "";
    }

    // Score / winner / mini / retired sections
    const scoreSection         = document.getElementById("score-section");
    const winnerSection        = document.getElementById("winner-section");
    const miniSection          = document.getElementById("mini-game-section");
    const miniFormatSection    = document.getElementById("mini-format-section");
    const retiredFormatSection = document.getElementById("retired-format-section");
    const retiredHelperNote    = document.getElementById("retired-helper-note");

    if (scoreSection)         scoreSection.style.display         = isMini ? "none" : "";
    if (winnerSection)        winnerSection.style.display        = (isMini || isRetired) ? "none" : "";
    if (miniFormatSection)    miniFormatSection.style.display    = isMini    ? "" : "none";
    if (miniSection)          miniSection.style.display          = isMini    ? "" : "none";
    if (retiredFormatSection) retiredFormatSection.style.display = isRetired ? "" : "none";
    if (retiredHelperNote)    retiredHelperNote.style.display    = isRetired ? "" : "none";

    // Score helper text for retired
    const scoreHelper = scoreSection?.querySelector(".section-helper");
    if (scoreHelper) {
      scoreHelper.textContent = isRetired
        ? "Enter the score at the point the match stopped (optional)."
        : "Enter each set score. The third set is a match tiebreak to 10 if played.";
    }

    // Required — not required for mini or retired
    ["set1-team1-games","set1-team2-games","set2-team1-games","set2-team2-games"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.required = (!isMini && !isRetired);
    });
    const winnerTeamEl = document.getElementById("winner-team");
    if (winnerTeamEl) winnerTeamEl.required = (!isMini && !isRetired);

    // Submit button label
    const submitBtn = form?.querySelector('[type="submit"]');
    if (submitBtn) {
      if (isMini)          submitBtn.textContent = "Report Mini-Game";
      else if (isRetired)  submitBtn.textContent = "Log Incomplete Match";
      else                 submitBtn.textContent = "Submit Match";
    }

    // Side labels
    const sideALabel = document.getElementById("side-a-label");
    const sideBLabel = document.getElementById("side-b-label");
    if (isMini) {
      if (sideALabel) sideALabel.textContent = "You";
      if (sideBLabel) sideBLabel.textContent = "Opponent";
    } else if (!isRetired) {
      if (sideALabel) sideALabel.textContent = "Side A";
      if (sideBLabel) sideBLabel.textContent = "Side B";
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

    // Compact first-name labels for score inputs (always short — full names don't fit)
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

  // Mini-game Singles/Doubles toggle and dynamic player exclusion
  setupMiniFormatToggle();
  // Retired match Singles/Doubles toggle
  setupRetiredFormatToggle(toggleDoublesFields);

  function showReportError(text) {
    message.innerHTML = `<p class="form-error">${text}</p>`;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.innerHTML = '<p class="small-text">Submitting match…</p>';

    // Mini-game has a completely separate, simpler submission path
    if (matchTypeSelect?.value === "mini") {
      await handleMiniGameSubmit(form, message, showReportError);
      return;
    }
    // Retired / incomplete match submission path
    if (matchTypeSelect?.value === "retired") {
      await handleRetiredMatchSubmit(form, message, showReportError);
      return;
    }

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

      const { data: insertedMatch, error: matchError } = await supabaseClient
        .from("matches")
        .insert([finalMatchPayload])
        .select("id")
        .single();

      if (matchError) {
        showReportError(`Error saving match: ${matchError.message}`);
        return;
      }

      const updateError = await applyPlayerUpdates({
        team1Players: hydrated.team1Players,
        team2Players: hydrated.team2Players,
        winnerTeam: formData.winnerTeam,
        scoringResult,
        team1TotalGames: scoringContext.team1StandardGames,
        team2TotalGames: scoringContext.team2StandardGames
      });

      if (updateError) {
        showReportError(`Match saved but player updates failed: ${updateError.message || updateError}`);
        return;
      }

      const t1Names = hydrated.team1Players.filter(Boolean).map((p) => p.name || "?").join(" & ");
      const t2Names = hydrated.team2Players.filter(Boolean).map((p) => p.name || "?").join(" & ");
      const winnerNames = formData.winnerTeam === 1 ? t1Names : t2Names;
      const loserNames  = formData.winnerTeam === 1 ? t2Names : t1Names;

      const confirmMatchData = {
        type: formData.matchType,
        winner: winnerNames,
        loser: loserNames,
        score: winnerFirstScore(finalMatchPayload.score_text || "", formData.winnerTeam),
        date: formData.datePlayed,
        notes: formData.matchNotes || ""
      };

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
          <div style="margin-top:12px;">
            <button type="button" class="btn-share-match" id="confirm-share-btn">⬆ Share Result</button>
          </div>
        </div>
      `;

      document.getElementById("confirm-share-btn")?.addEventListener("click", (e) => {
        shareMatchResult(confirmMatchData, e.currentTarget);
      });

      if (insertedMatch?.id) {
        setupPhotoUploadSection(insertedMatch.id, message);
      }

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

function setupMiniFormatToggle() {
  const singlesBtn = document.getElementById("mini-singles-btn");
  const doublesBtn = document.getElementById("mini-doubles-btn");
  const partnerWrap  = document.getElementById("mini-partner-wrap");
  const opp2Wrap     = document.getElementById("mini-opponent2-wrap");
  const gamesLabel   = document.getElementById("mini-games-won-label");
  if (!singlesBtn || !doublesBtn) return;

  function isMiniDoubles() {
    return doublesBtn.classList.contains("active");
  }

  function applyFormat(doubles) {
    singlesBtn.classList.toggle("active", !doubles);
    doublesBtn.classList.toggle("active",  doubles);
    if (partnerWrap) partnerWrap.style.display = doubles ? "" : "none";
    if (opp2Wrap)    opp2Wrap.style.display    = doubles ? "" : "none";
    if (gamesLabel)  gamesLabel.textContent = doubles
      ? "Your Team's Games Won"
      : "Your Games Won";
    // Clear fields being hidden so they don't smuggle stale values
    if (!doubles) {
      const partner = document.getElementById("mini-partner");
      const opp2    = document.getElementById("mini-opponent2");
      if (partner) partner.value = "";
      if (opp2)    opp2.value    = "";
    }
    updateMiniExclusions();
  }

  singlesBtn.addEventListener("click", () => applyFormat(false));
  doublesBtn.addEventListener("click", () => applyFormat(true));

  // Dynamic option exclusion: grey-out already-chosen players across all four mini selects
  function updateMiniExclusions() {
    const ids = {
      reporter: document.getElementById("team1-player1")?.value  || "",
      partner:  document.getElementById("mini-partner")?.value   || "",
      opp1:     document.getElementById("team2-player1")?.value  || "",
      opp2:     document.getElementById("mini-opponent2")?.value || "",
    };

    const targets = [
      { el: document.getElementById("team1-player1"),  own: "reporter" },
      { el: document.getElementById("mini-partner"),   own: "partner"  },
      { el: document.getElementById("team2-player1"),  own: "opp1"     },
      { el: document.getElementById("mini-opponent2"), own: "opp2"     },
    ];

    targets.forEach(({ el, own }) => {
      if (!el) return;
      const myValue = ids[own];
      Array.from(el.options).forEach(opt => {
        if (!opt.value) return;
        const takenByOther = Object.entries(ids).some(([k, v]) => k !== own && v === opt.value);
        opt.disabled = takenByOther && opt.value !== myValue;
      });
    });
  }

  // Re-run exclusions whenever any of the four mini selects changes
  ["team1-player1", "mini-partner", "team2-player1", "mini-opponent2"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", updateMiniExclusions);
  });
}

function setupRetiredFormatToggle(onFormatChange) {
  const singlesBtn = document.getElementById("retired-singles-btn");
  const doublesBtn = document.getElementById("retired-doubles-btn");
  if (!singlesBtn || !doublesBtn) return;

  singlesBtn.addEventListener("click", () => {
    singlesBtn.classList.add("active");
    doublesBtn.classList.remove("active");
    if (onFormatChange) onFormatChange();
  });
  doublesBtn.addEventListener("click", () => {
    doublesBtn.classList.add("active");
    singlesBtn.classList.remove("active");
    if (onFormatChange) onFormatChange();
  });
}

async function handleRetiredMatchSubmit(form, message, showReportError) {
  const isDoubles  = document.getElementById("retired-doubles-btn")?.classList.contains("active") ?? false;
  const t1p1Id     = document.getElementById("team1-player1")?.value;
  const t1p2Id     = isDoubles ? document.getElementById("team1-player2")?.value : null;
  const t2p1Id     = document.getElementById("team2-player1")?.value;
  const t2p2Id     = isDoubles ? document.getElementById("team2-player2")?.value : null;
  const datePlayed = document.getElementById("date-played")?.value;
  const submittedBy = document.getElementById("submitted-by")?.value?.trim() || null;
  const matchNotes  = document.getElementById("match-notes")?.value?.trim() || null;

  if (!t1p1Id || !t2p1Id) return showReportError("Please select both players.");
  if (isDoubles && (!t1p2Id || !t2p2Id)) return showReportError("Please select all four players for doubles.");
  if (!datePlayed) return showReportError("Please enter the date played.");

  const selectedIds = [t1p1Id, t1p2Id, t2p1Id, t2p2Id].filter(Boolean);
  if (new Set(selectedIds).size !== selectedIds.length) return showReportError("A player cannot appear twice in the same match.");

  // Build optional score text
  const s1t1 = toNumberOrNull(document.getElementById("set1-team1-games")?.value);
  const s1t2 = toNumberOrNull(document.getElementById("set1-team2-games")?.value);
  const s2t1 = toNumberOrNull(document.getElementById("set2-team1-games")?.value);
  const s2t2 = toNumberOrNull(document.getElementById("set2-team2-games")?.value);
  const scoreText = (s1t1 != null && s1t2 != null)
    ? buildScoreText(s1t1, s1t2, s2t1 ?? 0, s2t2 ?? 0, null, null)
    : "Incomplete";

  message.innerHTML = '<p class="small-text">Logging incomplete match…</p>';

  try {
    const ids = selectedIds.map(Number);
    const { data: players, error: fetchErr } = await supabaseClient
      .from("players")
      .select("id, name, ladder_points, incomplete_matches")
      .in("id", ids);
    if (fetchErr) throw fetchErr;

    const playerMap = {};
    (players || []).forEach(p => { playerMap[p.id] = p; });

    const retiredPayload = {
      match_type:         "retired",
      is_completed:       false,
      winner_team:        null,
      score_text:         scoreText,
      date_played:        datePlayed,
      submitted_by_name:  submittedBy,
      match_notes:        matchNotes,
      season_year:        new Date(datePlayed).getFullYear(),
      team1_player1_id:   Number(t1p1Id),
      team1_player2_id:   t1p2Id ? Number(t1p2Id) : null,
      team2_player1_id:   Number(t2p1Id),
      team2_player2_id:   t2p2Id ? Number(t2p2Id) : null,
      ladder_points_p1:   5,
      ladder_points_p2:   t1p2Id ? 5 : null,
      ladder_points_p3:   5,
      ladder_points_p4:   t2p2Id ? 5 : null,
      rating_change_p1:   0,
      rating_change_p2:   0,
      rating_change_p3:   0,
      rating_change_p4:   0,
    };

    const { error: insertErr } = await supabaseClient.from("matches").insert([retiredPayload]);
    if (insertErr) throw insertErr;

    await Promise.all(ids.map(id => {
      const p = playerMap[id];
      if (!p) return Promise.resolve();
      return supabaseClient.from("players").update({
        ladder_points:      (p.ladder_points || 0) + 5,
        incomplete_matches: (p.incomplete_matches || 0) + 1,
      }).eq("id", id);
    }));

    form.style.display = "none";
    message.innerHTML = `
      <div class="form-confirmation">
        <div class="confirmation-icon">🏳️</div>
        <h3>Match logged as incomplete</h3>
        <p>Both players receive 5 points for making the effort. Come back and complete it when you reschedule — the full match points will replace these when you do.</p>
        <div class="confirmation-links">
          <a href="history.html" class="button">View Match History</a>
          <a href="report.html" class="button-secondary">Report Another Match</a>
        </div>
      </div>
    `;
  } catch (err) {
    console.error("Retired match submit error:", err);
    showReportError("Something went wrong — please try again or text Michael at 832-833-1990.");
  }
}

async function handleMiniGameSubmit(form, message, showReportError) {
  const isMiniDoubles = document.getElementById("mini-doubles-btn")?.classList.contains("active");
  const p1Id  = Number(document.getElementById("team1-player1")?.value);
  const p2Id  = Number(document.getElementById("mini-partner")?.value)   || null; // partner (doubles)
  const p3Id  = Number(document.getElementById("team2-player1")?.value);
  const p4Id  = Number(document.getElementById("mini-opponent2")?.value) || null; // opp2 (doubles)
  const gamesWon    = parseInt(document.getElementById("mini-games-won")?.value, 10);
  const gamesPlayed = parseInt(document.getElementById("mini-games-played")?.value, 10) || 4;
  const datePlayed  = document.getElementById("date-played")?.value || "";
  const submittedBy = document.getElementById("submitted-by")?.value?.trim() || "";
  const matchNotes  = document.getElementById("match-notes")?.value?.trim() || null;

  // Validate
  if (!p1Id)  { showReportError("Please select yourself as Player 1."); return; }
  if (!p3Id)  { showReportError("Please select an opponent."); return; }
  if (isMiniDoubles && !p2Id) { showReportError("Please select your partner."); return; }
  if (isMiniDoubles && !p4Id) { showReportError("Please select Opponent 2."); return; }

  const selectedIds = [p1Id, p2Id, p3Id, p4Id].filter(Boolean);
  if (new Set(selectedIds).size !== selectedIds.length) {
    showReportError("All players must be different."); return;
  }
  if (isNaN(gamesWon) || gamesWon < 0) { showReportError("Please enter your team's games won (0–4)."); return; }
  if (gamesWon > gamesPlayed) { showReportError("Games won cannot exceed games played."); return; }
  if (gamesPlayed < 1 || gamesPlayed > 4) { showReportError("Games played must be between 1 and 4."); return; }
  if (!datePlayed) { showReportError("Please enter the date played."); return; }

  const gamesLost  = gamesPlayed - gamesWon;
  const winnerTeam = gamesWon > gamesLost ? 1 : gamesLost > gamesWon ? 2 : null;

  // Fetch all participating players
  const { data: players, error: fetchErr } = await supabaseClient
    .from("players")
    .select("id, name, ladder_points, mini_games_won, mini_games_lost, mini_points")
    .in("id", selectedIds);

  if (fetchErr) { showReportError(`Error loading players: ${fetchErr.message}`); return; }

  const find = id => id ? (players || []).find(p => p.id === id) : null;
  const pl1 = find(p1Id), pl2 = find(p2Id), pl3 = find(p3Id), pl4 = find(p4Id);
  if (!pl1 || !pl3 || (isMiniDoubles && (!pl2 || !pl4))) {
    showReportError("Could not find player data. Try again."); return;
  }

  const payload = {
    match_type:        "mini",
    date_played:       datePlayed,
    submitted_by_name: submittedBy || null,
    match_notes:       matchNotes,
    season_year:       new Date(datePlayed).getFullYear(),
    team1_player1_id:  p1Id,
    team1_player2_id:  isMiniDoubles ? p2Id : null,
    team2_player1_id:  p3Id,
    team2_player2_id:  isMiniDoubles ? p4Id : null,
    winner_team:       winnerTeam,
    score_text:        `${gamesWon}-${gamesLost}`,
    mini_games_won_p1: gamesWon,
    mini_games_won_p3: gamesLost,
    ladder_points_p1:  gamesWon,
    ladder_points_p2:  isMiniDoubles ? gamesWon  : null,
    ladder_points_p3:  gamesLost,
    ladder_points_p4:  isMiniDoubles ? gamesLost : null,
    rating_change_p1:  0,
    rating_change_p2:  isMiniDoubles ? 0 : null,
    rating_change_p3:  0,
    rating_change_p4:  isMiniDoubles ? 0 : null,
    team1_avg_rating:  null,
    team2_avg_rating:  null,
    team1_total_games: gamesWon,
    team2_total_games: gamesLost,
  };

  const { data: inserted, error: insertErr } = await supabaseClient
    .from("matches").insert([payload]).select("id").single();

  if (insertErr) { showReportError(`Error saving match: ${insertErr.message}`); return; }

  // Build player updates: team 1 earned gamesWon, team 2 earned gamesLost
  const teamUpdates = [
    { player: pl1, pts: gamesWon,  won: gamesWon,  lost: gamesLost },
    ...(isMiniDoubles && pl2 ? [{ player: pl2, pts: gamesWon,  won: gamesWon,  lost: gamesLost }] : []),
    { player: pl3, pts: gamesLost, won: gamesLost, lost: gamesWon  },
    ...(isMiniDoubles && pl4 ? [{ player: pl4, pts: gamesLost, won: gamesLost, lost: gamesWon  }] : []),
  ];

  const updateErrors = await Promise.all(
    teamUpdates.map(({ player, pts, won, lost }) =>
      supabaseClient.from("players").update({
        ladder_points:   (player.ladder_points   || 0) + pts,
        mini_games_won:  (player.mini_games_won  || 0) + won,
        mini_games_lost: (player.mini_games_lost || 0) + lost,
        mini_points:     (player.mini_points     || 0) + pts,
      }).eq("id", player.id).then(r => r.error)
    )
  );

  if (updateErrors.some(Boolean)) {
    showReportError("Match saved but some player stats failed to update. Contact the commissioner.");
    return;
  }

  // Confirmation message
  const partnerName = pl2 ? pl2.name.split(" ")[0] : "";
  const confirmBody = isMiniDoubles
    ? `Your team won ${gamesWon} of ${gamesPlayed} games — <strong>${gamesWon} point${gamesWon === 1 ? "" : "s"}</strong> added for you and ${escapeHtml(partnerName)}.`
    : `You won ${gamesWon} of ${gamesPlayed} games — <strong>${gamesWon} point${gamesWon === 1 ? "" : "s"}</strong> added to your total.`;

  form.style.display = "none";
  message.innerHTML = `
    <div class="form-confirmation">
      <div class="confirmation-icon">✓</div>
      <h3>Mini-game reported! 🎾</h3>
      <p>${confirmBody}</p>
      <div class="confirmation-links">
        <a href="history.html" class="button">View Match History</a>
        <a href="report.html" class="button-secondary">Report Another</a>
      </div>
    </div>
  `;

  if (inserted?.id) setupPhotoUploadSection(inserted.id, message);
  if (getLadderBodyEl()) await loadLadder();
  if (document.getElementById("history-list")) await loadMatchHistory();
}

async function populatePlayerDropdowns() {
  const selects = [
    document.getElementById("team1-player1"),
    document.getElementById("team1-player2"),
    document.getElementById("team2-player1"),
    document.getElementById("team2-player2"),
    document.getElementById("mini-partner"),
    document.getElementById("mini-opponent2"),
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

// Reorders a stored score string (always team1-first) so the winner's games
// appear first in each set. E.g. "3-6, 0-6" with winner_team=2 → "6-3, 6-0".
// Splits on ", " or " " so it handles both old (space) and new (comma-space) records.
function winnerFirstScore(scoreText, winnerTeam) {
  if (!scoreText) return scoreText;
  const sets = scoreText.split(/,?\s+/);
  if (winnerTeam === 1) return sets.join(", ");
  return sets.map((set) => {
    const [a, b] = set.split("-");
    return `${b}-${a}`;
  }).join(", ");
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

  return parts.join(", ");
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
  const sets = cleaned.split(/,?\s+/);

  if (sets.length < 2 || sets.length > 3) {
    return { valid: false, message: "Score should usually have 2 or 3 sets, like 6-4, 3-6, 10-8." };
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

function isMixedGenderMatch(team1Players, team2Players) {
  const all = [...team1Players, ...team2Players].filter(Boolean);
  return all.some((p) => p.sex === "Man") && all.some((p) => p.sex === "Woman");
}

function averageAdjustedRating(players, applyGenderAdj) {
  const validPlayers = players.filter(Boolean);
  if (!validPlayers.length) return 0;
  const total = validPlayers.reduce((sum, player) => {
    const base = Number(player.dynamic_rating ?? player.display_rating ?? 0);
    // Gender adjustment: +0.5 added to male ratings for mixed-gender match calculations per NTRP convention
    return sum + (applyGenderAdj && player.sex === "Man" ? base + 0.5 : base);
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

  // Standard games: sets 1 and 2 only. Tiebreak (set 3) is never counted in the spread.
  const standardSets = [
    [set1Team1Games, set1Team2Games],
    [set2Team1Games, set2Team2Games]
  ];

  const team1StandardGames = standardSets.reduce((sum, [a]) => sum + Number(a || 0), 0);
  const team2StandardGames = standardSets.reduce((sum, [, b]) => sum + Number(b || 0), 0);
  const team1TotalGames = team1StandardGames + Number(set3Team1Games || 0);
  const team2TotalGames = team2StandardGames + Number(set3Team2Games || 0);

  // has3Set triggers the 3-set bonus in calculateMatchScoring
  const has3Set = set3Team1Games !== null && set3Team2Games !== null;

  return {
    matchType: formData.matchType,
    winnerTeam: formData.winnerTeam,
    team1Players: hydrated.team1Players,
    team2Players: hydrated.team2Players,
    team1StandardGames,
    team2StandardGames,
    team1TotalGames,
    team2TotalGames,
    has3Set
  };
}

/*
 * calculateMatchScoring — scoring formula
 *
 * Expected spread = gapMagnitude × 16, signed (+ if winner is favorite, - if underdog).
 * Gap capped at 0.5, so expected spread ranges from -8 to +8.
 * Delta = (winner_std_games - loser_std_games) - expected_spread.
 * Positive delta = outperformed expectations; negative = closer than expected.
 *
 * Anchor verification (no 3-set bonus):
 *   Even match,        6-3 6-2 → winner=13, loser=8
 *   Fav 0.5,           6-3 6-2 → winner=11, loser=8
 *   Fav 0.75 (capped), 6-0 6-0 → winner=12, loser=7
 *   Major upset 0.5,   6-0 6-0 → winner=17, loser=7
 */
function calculateMatchScoring({
  matchType,
  winnerTeam,
  team1Players,
  team2Players,
  team1StandardGames,
  team2StandardGames,
  team1TotalGames,
  team2TotalGames,
  has3Set = false
}) {
  const mixedGender = isMixedGenderMatch(team1Players, team2Players);
  // Gender adjustment: +0.5 added to male ratings in mixed matches before all calculations
  const team1AvgRating = averageAdjustedRating(team1Players, mixedGender);
  const team2AvgRating = averageAdjustedRating(team2Players, mixedGender);

  const winnerAvgRating = winnerTeam === 1 ? team1AvgRating : team2AvgRating;
  const loserAvgRating  = winnerTeam === 1 ? team2AvgRating : team1AvgRating;
  const winnerStdGames  = winnerTeam === 1 ? team1StandardGames : team2StandardGames;
  const loserStdGames   = winnerTeam === 1 ? team2StandardGames : team1StandardGames;

  // Gap capped at 0.5; expected spread uses ×16 anchor.
  const gapMagnitude = Math.min(Math.abs(winnerAvgRating - loserAvgRating), 0.5);
  const expectedSpread = winnerAvgRating >= loserAvgRating
    ? gapMagnitude * 16
    : -(gapMagnitude * 16);
  const actualSpread = winnerStdGames - loserStdGames;
  const delta = actualSpread - expectedSpread;

  // --- Dynamic rating change ---
  // RC = (delta / 24) × K × 0.85. Winner gains, loser loses.
  // Elo win probability is NOT used here — only in buildOddsLine for display.
  // K three-tier by sequential match count: matches 1-3 = 0.15, 4-8 = 0.10, 9+ = 0.06.
  // Applied per player so doubles teammates at different experience levels get different K.
  function playerK(player) {
    const mp = player?.matches_played ?? 0;
    if (mp < 3) return 0.15;
    if (mp < 8) return 0.10;
    return 0.06;
  }

  function playerRc(player, isWinnerTeam) {
    const raw = roundToTwo((delta / 24) * playerK(player) * 0.85);
    const rc = Number.isFinite(raw) ? raw : 0;
    return isWinnerTeam ? rc : -rc;
  }

  const rc1 = playerRc(team1Players[0], winnerTeam === 1);
  const rc2 = playerRc(team1Players[1], winnerTeam === 1);
  const rc3 = playerRc(team2Players[0], winnerTeam === 2);
  const rc4 = playerRc(team2Players[1], winnerTeam === 2);

  // --- Ladder points ---
  // Winner: 11-base scaled by delta × 0.29, clamped [8, 18].
  let winnerPoints = Math.max(8, Math.min(18, Math.round(11 + delta * 0.29)));

  // LOSER POINTS — expectation-adjusted formula
  // Loser context flags drive the expectation component below.
  let loserPoints;
  const loserWasFavorite = loserAvgRating > winnerAvgRating;
  const loserWasUnderdog = loserAvgRating < winnerAvgRating;
  const evenMatch = gapMagnitude < 0.1;

  if (loserStdGames === 0) {
    // Bagel exception — gap-based floor, smaller coefficient encourages mismatched play.
    loserPoints = Math.max(5, Math.round(4 + gapMagnitude * 4));
  } else {
    // games_component: rewards the loser for games won regardless of context.
    const gamesComponent = loserStdGames * 0.6;
    // expect_component: adjusts for whether the loser was expected to win or lose.
    //   Favorite lost → penalised (they were supposed to win).
    //   Underdog lost → rewarded (they were expected to lose by more).
    //   Even match    → no adjustment (expectations were symmetric).
    let expectComponent = 0;
    if (loserWasFavorite) expectComponent = -(gapMagnitude * 6);
    if (loserWasUnderdog) expectComponent = +(gapMagnitude * 4);
    const loserRaw = 4 + gamesComponent + expectComponent;
    loserPoints = Math.max(5, Math.round(loserRaw));
  }

  // Enforce minimum 2-point gap between winner and loser.
  loserPoints = Math.min(loserPoints, winnerPoints - 2);
  loserPoints = Math.max(5, loserPoints);
  if (winnerPoints - loserPoints < 2) winnerPoints = loserPoints + 2;

  // 3-set bonus: awarded only when a set-3 score is present (has3Set = true).
  if (has3Set) {
    winnerPoints += 2;
    // Loser bonus based on pre-match rating relationship (adjusted ratings):
    //   even match (gap < 0.1)        → +2  (credits pushing the favorite to a decider)
    //   loser was the favorite        → +1  (expected to win; partial credit for losing in 3)
    //   loser was the underdog        → +2  (rewards an underdog going the distance)
    if (gapMagnitude < 0.1) {
      loserPoints += 2;
    } else if (loserAvgRating > winnerAvgRating) {
      loserPoints += 1;
    } else {
      loserPoints += 2;
    }
    // Re-enforce 2-point minimum spread after bonuses
    if (winnerPoints - loserPoints < 2) winnerPoints = loserPoints + 2;
  }

  return {
    team1AvgRating: roundToTwo(team1AvgRating),
    team2AvgRating: roundToTwo(team2AvgRating),
    ratingChanges: [rc1, rc2, rc3, rc4],
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
    team1_total_games: buildScoringContext(formData, hydrated).team1StandardGames,
    team2_total_games: buildScoringContext(formData, hydrated).team2StandardGames,
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

async function applyPlayerUpdates({
  team1Players,
  team2Players,
  winnerTeam,
  scoringResult,
  team1TotalGames,
  team2TotalGames
}) {
  // Fetch all players to compute current standings rank (saved as previous_rank after update)
  let allPlayersForRank = [];
  try {
    const { data } = await supabaseClient.from("players").select("id, ladder_points, dynamic_rating, wins, name");
    allPlayersForRank = data || [];
  } catch (_) {}

  const sortedForRank = sortPlayersForStandings(allPlayersForRank);
  const currentRankMap = {};
  sortedForRank.forEach((p, i) => { currentRankMap[p.id] = i + 1; });

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
      matches_played: Number(player.matches_played || 0) + 1,
      previous_rank: currentRankMap[player.id] ?? null
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
      matches_played: update.matches_played,
      previous_rank: update.previous_rank
    };

    const { error } = await supabaseClient
      .from("players")
      .update(payload)
      .eq("id", update.id);

    if (error) return error;
  }

  return null;
}

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

// Adds a mirrored scrollbar below a table-wrap so users can scroll horizontally
// without travelling to the bottom of a tall table. Used for the Directory only.
function setupStickyScrollbar(tableWrap) {
  if (!tableWrap) return;
  if (tableWrap.nextElementSibling?.classList.contains("scroll-mirror-wrap")) return;

  const mirror = document.createElement("div");
  mirror.className = "scroll-mirror-wrap";
  const inner = document.createElement("div");
  inner.className = "scroll-mirror-inner";
  mirror.appendChild(inner);
  tableWrap.parentNode.insertBefore(mirror, tableWrap.nextSibling);

  function syncWidth() {
    inner.style.width = tableWrap.scrollWidth + "px";
    mirror.style.display = tableWrap.scrollWidth > tableWrap.clientWidth ? "" : "none";
  }
  syncWidth();
  if (window.ResizeObserver) new ResizeObserver(syncWidth).observe(tableWrap);

  let syncing = false;
  mirror.addEventListener("scroll", () => {
    if (syncing) return;
    syncing = true;
    tableWrap.scrollLeft = mirror.scrollLeft;
    requestAnimationFrame(() => { syncing = false; });
  });
  tableWrap.addEventListener("scroll", () => {
    if (syncing) return;
    syncing = true;
    mirror.scrollLeft = tableWrap.scrollLeft;
    requestAnimationFrame(() => { syncing = false; });
  });
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

  setTableMessage(tbody, "Loading directory...", 8);
  summary.textContent = "Loading...";

  try {
    const { data, error } = await supabaseClient
      .from("players")
      .select("id, name, area, phone, display_rating, dynamic_rating, ladder_points, wins, sex");

    if (error) throw error;

    // Rank using the same sort as the Rankings page so numbers match.
    const players = sortPlayersForStandings(
      (data || []).filter((player) => player.name && player.phone)
    ).map((player, index) => ({
      ...player,
      season_rank: index + 1
    }));

    directoryState.players = players;
    directoryState.filteredPlayers = players;

    setupDirectorySorting();
    renderDirectory(players);
    setupStickyScrollbar(document.querySelector(".directory-table")?.closest(".table-wrap"));
  } catch (error) {
    console.error("Load directory error:", error);
    setTableMessage(tbody, "Error loading directory.", 8);
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
    <td><a class="player-link" href="player.html?id=${player.id}">${safeName}</a></td>
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
      else if (rawFilter.toLowerCase() === "drop-in" || rawFilter.toLowerCase() === "mini") state.history.filterType = "mini";
      else if (rawFilter.toLowerCase() === "retired") state.history.filterType = "retired";
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
      team1_avg_rating,
      team2_avg_rating,
      set1_team1_games,
      set1_team2_games,
      set2_team1_games,
      set2_team2_games,
      match_notes,
      photo_url,
      mini_games_won_p1,
      mini_games_won_p3
    `)
    .order("date_played", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  // Mini-game matches are never shown on the Match History page
  query = query.neq("match_type", "mini");

  if (["Singles", "Doubles", "retired"].includes(state.history.filterType)) {
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

// Returns { id → sex } for all players involved in the given matches.
// Used to un-apply the gender adjustment (+0.5) when displaying ratings.
async function fetchPlayerSexMap(matches) {
  const ids = new Set();
  matches.forEach((match) => {
    [match.team1_player1_id, match.team1_player2_id,
     match.team2_player1_id, match.team2_player2_id]
      .forEach((id) => { if (id != null) ids.add(id); });
  });
  const uniqueIds = [...ids];
  if (!uniqueIds.length) return {};

  const { data, error } = await supabaseClient
    .from("players").select("id, sex").in("id", uniqueIds);

  if (error) { console.error("Player sex map error:", error); return {}; }
  const sexMap = {};
  (data || []).forEach((p) => { sexMap[p.id] = p.sex; });
  return sexMap;
}

// Returns true if the match has at least one Man and one Woman across all players.
function matchIsMixedGender(match, sexMap) {
  const ids = [match.team1_player1_id, match.team1_player2_id,
               match.team2_player1_id, match.team2_player2_id].filter(Boolean);
  return ids.some((id) => sexMap[id] === "Man") && ids.some((id) => sexMap[id] === "Woman");
}

// Derives the un-adjusted display rating from the stored gender-adjusted avg.
// The +0.5 adjustment is applied per male player then averaged, so we reverse it.
function unadjustedTeamRating(storedAvg, teamIds, sexMap, isMixed) {
  if (!isMixed || storedAvg == null) return storedAvg;
  const players = teamIds.filter(Boolean);
  if (!players.length) return storedAvg;
  const maleCount = players.filter((id) => sexMap[id] === "Man").length;
  return roundToTwo(storedAvg - (maleCount * 0.5) / players.length);
}

// Returns true if the winner had <40% pre-match win probability (upset)
function isMatchUpset(match) {
  const t1avg = Number(match.team1_avg_rating);
  const t2avg = Number(match.team2_avg_rating);
  if (!t1avg || !t2avg) return false;
  const winnerAvg = match.winner_team === 1 ? t1avg : t2avg;
  const loserAvg  = match.winner_team === 1 ? t2avg : t1avg;
  return (1 / (1 + Math.pow(10, (loserAvg - winnerAvg) / 0.45))) < 0.40;
}

function buildMatchDisplay(match, playerMap) {
  const allIds = [
    match.team1_player1_id, match.team1_player2_id,
    match.team2_player1_id, match.team2_player2_id,
  ].filter(Boolean);
  const playerObjs = allIds.map(id => ({ id, name: playerMap[id] })).filter(p => p.name);
  const nameMap = disambiguateNames(playerObjs);
  const dispFor = id => (id && nameMap[id]) || "";
  const fullFor = id => (id && playerMap[id]) || "";

  const t1Display = [dispFor(match.team1_player1_id), dispFor(match.team1_player2_id)].filter(Boolean);
  const t2Display = [dispFor(match.team2_player1_id), dispFor(match.team2_player2_id)].filter(Boolean);
  const t1Full    = [fullFor(match.team1_player1_id), fullFor(match.team1_player2_id)].filter(Boolean);
  const t2Full    = [fullFor(match.team2_player1_id), fullFor(match.team2_player2_id)].filter(Boolean);

  return {
    team1Text:   t1Display.join(" / "),
    team2Text:   t2Display.join(" / "),
    playersText: `${t1Display.join(" / ")} vs ${t2Display.join(" / ")}`,
    searchText:  `${t1Full.join(" / ")} vs ${t2Full.join(" / ")}`,
    nameMap,
  };
}


// selfId: when viewing a player profile, pass their ID so their own name renders as plain text.
function renderMiniMatchExtras(match, playerMap, selfId = null) {
  const ids = [match.team1_player1_id, match.team2_player1_id].filter(Boolean);
  const playerObjs = ids.map(id => ({ id, name: playerMap[id] })).filter(p => p.name);
  const nameMap = disambiguateNames(playerObjs);
  const rows = [];

  const addRow = (playerId, pts) => {
    if (!playerId) return;
    const dn = nameMap[playerId] || playerMap[playerId] || "Player";
    const isSelf = selfId && Number(playerId) === Number(selfId);
    const nameHtml = isSelf
      ? escapeHtml(dn)
      : `<a href="player.html?id=${playerId}" class="player-link">${escapeHtml(dn)}</a>`;
    rows.push(`
      <div class="match-extra-row">
        <span class="match-extra-name">${nameHtml}</span>
        <span class="match-extra-stat">Games Won: ${pts ?? 0}</span>
        <span class="match-extra-stat">Points: +${pts ?? 0}</span>
      </div>
    `);
  };

  addRow(match.team1_player1_id, match.ladder_points_p1);
  addRow(match.team2_player1_id, match.ladder_points_p3);

  return rows.length ? `<div class="match-extras">${rows.join("")}</div>` : "";
}

function renderMatchExtras(match, playerMap, sexMap = {}, selfId = null) {
  const rows = [];
  const isDoubles = match.match_type === "Doubles";
  const isMixed = matchIsMixedGender(match, sexMap);
  const t1Display = unadjustedTeamRating(match.team1_avg_rating, [match.team1_player1_id, match.team1_player2_id], sexMap, isMixed);
  const t2Display = unadjustedTeamRating(match.team2_avg_rating, [match.team2_player1_id, match.team2_player2_id], sexMap, isMixed);

  // Disambiguate names within this match's context
  const extrasPlayerObjs = [
    match.team1_player1_id, match.team1_player2_id,
    match.team2_player1_id, match.team2_player2_id,
  ].filter(Boolean).map(id => ({ id, name: playerMap[id] })).filter(p => p.name);
  const extrasNameMap = disambiguateNames(extrasPlayerObjs);

  function addRow(playerId, ratingChange, ladderPoints, ratingAtMatch) {
    if (!playerId) return;
    const ratingLine = ratingAtMatch != null
      ? `<span class="match-extra-rating">${isDoubles
          ? `Team rating: ${Number(ratingAtMatch).toFixed(2)} (avg)`
          : `Rating at match: ${Number(ratingAtMatch).toFixed(2)}`
        }</span>`
      : "";
    const escapedName = escapeHtml(extrasNameMap[playerId] || playerMap[playerId] || "Player");
    const isSelf = selfId && Number(playerId) === Number(selfId);
    const nameHtml = isSelf
      ? escapedName
      : `<a href="player.html?id=${playerId}" class="player-link">${escapedName}</a>`;
    const combinedStat = `${formatSignedNumber(ratingChange)} · ${ladderPoints ?? "—"} pts`;
    rows.push(`
      <div class="match-extra-row">
        <span class="match-extra-name">${nameHtml}${ratingLine}</span>
        <span class="match-extra-stat">Rating: ${escapeHtml(formatSignedNumber(ratingChange))}</span>
        <span class="match-extra-stat">Points: ${escapeHtml(String(ladderPoints ?? "—"))}</span>
        <span class="match-extra-combined">${escapeHtml(combinedStat)}</span>
      </div>
    `);
  }

  addRow(match.team1_player1_id, match.rating_change_p1, match.ladder_points_p1, t1Display);
  addRow(match.team1_player2_id, match.rating_change_p2, match.ladder_points_p2, t1Display);
  addRow(match.team2_player1_id, match.rating_change_p3, match.ladder_points_p3, t2Display);
  addRow(match.team2_player2_id, match.rating_change_p4, match.ladder_points_p4, t2Display);

  if (!rows.length) return "";
  return `<div class="match-extras">${rows.join("")}</div>`;
}

// Returns a pre-match odds line using stored avg ratings (already gender-adjusted).
// Shows only the favorite with abbreviated "First L." names.
function buildOddsLine(match, display) {
  const t1avg = Number(match.team1_avg_rating);
  const t2avg = Number(match.team2_avg_rating);
  if (!match.team1_avg_rating || !match.team2_avg_rating) return "";

  const prob1 = 1 / (1 + Math.pow(10, (t2avg - t1avg) / 0.45));
  const pct1 = Math.round(prob1 * 100);
  const pct2 = 100 - pct1;

  if (pct1 === pct2) return `<div class="history-meta">Odds: Even match</div>`;

  const favTeamText = pct1 > pct2 ? display.team1Text : display.team2Text;
  const favPct      = pct1 > pct2 ? pct1 : pct2;

  // Abbreviate each player name to "First L." — always, regardless of conflicts
  const abbrevName = (name) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return parts[0] || name;
    const last = parts[parts.length - 1];
    if (last.length <= 2 && last.endsWith(".")) return name.trim(); // already "S."
    return `${parts[0]} ${last[0]}.`;
  };
  const abbrevTeam = favTeamText.split(" / ").map(abbrevName).join(" / ");

  return `<div class="history-meta">Odds: ${escapeHtml(abbrevTeam)} ${favPct}%</div>`;
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

/* =========================
   PHOTO FEATURES
========================= */

function openPhotoLightbox(url) {
  const old = document.getElementById("photo-lightbox");
  if (old) old.remove();

  const box = document.createElement("div");
  box.id = "photo-lightbox";
  box.className = "photo-lightbox";
  box.innerHTML = `
    <button class="photo-lightbox-close" aria-label="Close photo">✕</button>
    <img class="photo-lightbox-img" src="${escapeHtml(url)}" alt="Match photo">
  `;
  document.body.appendChild(box);
  requestAnimationFrame(() => box.classList.add("visible"));

  const close = () => {
    box.classList.remove("visible");
    setTimeout(() => box.remove(), 200);
  };
  box.querySelector(".photo-lightbox-close").addEventListener("click", (e) => { e.stopPropagation(); close(); });
  box.addEventListener("click", (e) => { if (e.target === box) close(); });
  const onKey = (e) => { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); } };
  document.addEventListener("keydown", onKey);
}

async function uploadMatchPhoto(matchId, file) {
  if (file.size > 8 * 1024 * 1024) throw new Error("Photo must be under 8MB");
  const ext  = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `match-photos/${matchId}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabaseClient.storage
    .from("match-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw upErr;
  const { data: urlData } = supabaseClient.storage.from("match-photos").getPublicUrl(path);
  const publicUrl = urlData.publicUrl;
  const { error: dbErr } = await supabaseClient
    .from("matches").update({ photo_url: publicUrl }).eq("id", matchId);
  if (dbErr) throw dbErr;
  return publicUrl;
}

function buildPhotoUploadUI(matchId, onSuccess, onSkip) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <label class="photo-upload-area" for="pup-file-${matchId}">
      <span class="photo-upload-icon">📷</span>
      <span class="photo-upload-label">Tap to choose a photo</span>
      <span class="photo-upload-sublabel">8MB max · JPEG, PNG, HEIC</span>
      <input type="file" id="pup-file-${matchId}" accept="image/*" style="display:none">
    </label>
    <img class="photo-preview-img" id="pup-preview-${matchId}" alt="Preview">
    <p class="photo-upload-error" id="pup-err-${matchId}"></p>
    <button class="primary-btn photo-upload-btn" id="pup-btn-${matchId}" disabled style="width:100%;margin-top:4px">Upload Photo</button>
    <button class="photo-skip-link" id="pup-skip-${matchId}" type="button">Skip</button>
  `;
  const fileInput = wrap.querySelector(`#pup-file-${matchId}`);
  const preview   = wrap.querySelector(`#pup-preview-${matchId}`);
  const errEl     = wrap.querySelector(`#pup-err-${matchId}`);
  const uploadBtn = wrap.querySelector(`#pup-btn-${matchId}`);
  const skipBtn   = wrap.querySelector(`#pup-skip-${matchId}`);

  const showErr = (msg) => { errEl.textContent = msg; errEl.style.display = "block"; };
  const clearErr = () => { errEl.style.display = "none"; };

  fileInput.addEventListener("change", () => {
    clearErr();
    const file = fileInput.files[0];
    if (!file) { uploadBtn.disabled = true; preview.style.display = "none"; return; }
    if (file.size > 8 * 1024 * 1024) {
      showErr("Photo must be under 8MB"); uploadBtn.disabled = true; preview.style.display = "none"; return;
    }
    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";
    uploadBtn.disabled = false;
  });

  uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading…";
    clearErr();
    try {
      const url = await uploadMatchPhoto(matchId, file);
      if (onSuccess) onSuccess(url);
    } catch (err) {
      showErr(err.message || "Upload failed — please try again.");
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Upload Photo";
    }
  });

  if (skipBtn && onSkip) skipBtn.addEventListener("click", onSkip);
  return wrap;
}

function setupPhotoUploadSection(matchId, parentEl) {
  const section = document.createElement("div");
  section.className = "photo-upload-section";
  section.innerHTML = `
    <h3>📷 Add a Match Photo <span style="font-weight:400;font-size:14px;color:var(--muted)">(optional)</span></h3>
    <p class="section-hint">Show everyone you actually played.</p>
  `;
  const ui = buildPhotoUploadUI(matchId, (url) => {
    section.innerHTML = `
      <div style="text-align:center;padding:12px 0;">
        <p style="font-weight:700;font-size:16px;margin-bottom:10px;">Photo added! 🎾</p>
        <img src="${escapeHtml(url)}" alt="Match photo" style="width:100%;max-height:240px;object-fit:cover;border-radius:12px;border:1px solid rgba(0,0,0,0.08);">
      </div>
    `;
  }, () => { section.remove(); });
  section.appendChild(ui);
  parentEl.appendChild(section);
}

function showPhotoUploadModal(matchId, onSuccess) {
  const overlay = document.createElement("div");
  overlay.className = "photo-modal-overlay";
  overlay.innerHTML = `
    <div class="photo-modal">
      <div class="photo-modal-header">
        <h3>Add a photo to this match</h3>
        <button class="photo-modal-close" aria-label="Close">✕</button>
      </div>
    </div>
  `;
  const modal = overlay.querySelector(".photo-modal");
  const closeBtn = overlay.querySelector(".photo-modal-close");

  const close = () => overlay.remove();
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  const ui = buildPhotoUploadUI(matchId, (url) => {
    close();
    if (onSuccess) onSuccess(url);
  }, close);
  modal.appendChild(ui);
  document.body.appendChild(overlay);
}

async function loadMatchHistory() { 
  const container = document.getElementById("history-list");
  if (!container) return;

  container.innerHTML = "<p>Loading match history...</p>";
  setActiveFilterButton(".history-filters", state.history.filterType);
  const myChip = document.getElementById("my-matches-chip");
  if (myChip) myChip.classList.toggle("active", !!state.history.myMatchesOnly);

  try {
    // Drop-In tab selected: show informational empty state — mini results live on player profiles
    if (state.history.filterType === "mini") {
      container.innerHTML = `
        <div style="padding:24px 16px;text-align:center;color:var(--muted);">
          <div style="font-size:32px;margin-bottom:12px;">🎾</div>
          <p style="font-size:15px;font-weight:600;margin:0 0 8px;color:var(--text);">Drop-in game results live on player profiles</p>
          <p style="font-size:14px;margin:0;">Visit any player's profile from the <a href="ladder.html" class="player-link">Rankings page</a> to see their drop-in history.</p>
        </div>
      `;
      return;
    }

    const matches = await fetchMatches();
    const [playerMap, sexMap] = await Promise.all([
      fetchPlayerNamesForMatches(matches),
      fetchPlayerSexMap(matches)
    ]);

    const playerFilterValue = (document.getElementById("history-player-filter")?.value || "").trim().toLowerCase();

    const myMatchId = state.history.myMatchesOnly ? getMyLadderPlayer()?.id : null;
    const baseMatches = myMatchId
      ? matches.filter((m) =>
          [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id]
            .includes(myMatchId)
        )
      : matches;

    const filteredMatches = playerFilterValue
      ? baseMatches.filter((match) => {
          const display = buildMatchDisplay(match, playerMap);
          return (display.searchText || display.playersText).toLowerCase().includes(playerFilterValue);
        })
      : baseMatches;

    if (!filteredMatches.length) {
      container.innerHTML = "<p>No matches found.</p>";
      return;
    }

    container.innerHTML = filteredMatches.map((match) => {
      const display = buildMatchDisplay(match, playerMap);
      const winnerText = match.winner_team === 1 ? display.team1Text : display.team2Text;
      const loserText  = match.winner_team === 1 ? display.team2Text : display.team1Text;

      const _wt = match.winner_team;
      const cardData = JSON.stringify({
        type: match.match_type || "Match",
        winner: winnerText || "—",
        loser: loserText || "—",
        score: winnerFirstScore(match.score_text || "", match.winner_team),
        date: safeDateText(match.date_played),
        notes: match.match_notes || "",
        winnerTeam: _wt,
        t1Avg: match.team1_avg_rating,
        t2Avg: match.team2_avg_rating,
        winnerPts: _wt === 1 ? match.ladder_points_p1 : match.ladder_points_p3,
        loserPts:  _wt === 1 ? match.ladder_points_p3 : match.ladder_points_p1,
        winnerRc:  _wt === 1 ? match.rating_change_p1 : match.rating_change_p3,
        loserRc:   _wt === 1 ? match.rating_change_p3 : match.rating_change_p1,
      });

      // Retired / incomplete match card
      if (match.match_type === "retired") {
        const allRetiredIds = [match.team1_player1_id, match.team1_player2_id, match.team2_player1_id, match.team2_player2_id].filter(Boolean);
        const retiredObjs = allRetiredIds.map(id => ({ id, name: playerMap[id] })).filter(p => p.name);
        const retiredNm = disambiguateNames(retiredObjs);
        const rName = id => id ? (retiredNm[id] || playerMap[id] || "?") : null;
        const t1Str = [match.team1_player1_id, match.team1_player2_id].filter(Boolean).map(rName).filter(Boolean).join(" / ");
        const t2Str = [match.team2_player1_id, match.team2_player2_id].filter(Boolean).map(rName).filter(Boolean).join(" / ");
        const matchFmt = match.team1_player2_id ? "Doubles" : "Singles";
        const ptsByPlayer = {
          [match.team1_player1_id]: match.ladder_points_p1 ?? 5,
          [match.team1_player2_id]: match.ladder_points_p2 ?? 5,
          [match.team2_player1_id]: match.ladder_points_p3 ?? 5,
          [match.team2_player2_id]: match.ladder_points_p4 ?? 5,
        };
        const partRows = allRetiredIds.map(id => {
          const dn = escapeHtml(retiredNm[id] || playerMap[id] || "?");
          const pts = ptsByPlayer[id] ?? 5;
          return `<div class="match-extra-row">
            <span class="match-extra-name"><a href="player.html?id=${id}" class="player-link">${dn}</a></span>
            <span class="match-extra-stat">Points: +${pts}</span>
            <span class="match-extra-combined">+${pts} pts</span>
          </div>`;
        }).join("");
        const retiredCardJson = escapeHtml(JSON.stringify({
          id: match.id, team1_player1_id: match.team1_player1_id, team1_player2_id: match.team1_player2_id,
          team2_player1_id: match.team2_player1_id, team2_player2_id: match.team2_player2_id,
          submitted_by_name: match.submitted_by_name, match_notes: match.match_notes,
        }));
        return `
          <div class="history-item fade-in-card premium-match-card retired-match history-list-card" data-match-id="${match.id}">
            <div class="card-badge-row">
              <span class="match-type-chip retired-chip">🏳️ Incomplete</span>
              <div class="card-badge-right">
                <span class="match-badge retired-badge">${escapeHtml(matchFmt)}</span>
              </div>
            </div>
            <div class="card-photo-date-row">
              ${match.photo_url ? `<img class="card-photo" src="${escapeHtml(match.photo_url)}" alt="Match photo" data-photo-url="${escapeHtml(match.photo_url)}">` : ""}
              <div class="card-date-info">
                <div class="history-meta">
                  <strong>Date:</strong> ${escapeHtml(safeDateText(match.date_played))}
                  ${match.submitted_by_name ? ` • <strong>Submitted by:</strong> ${escapeHtml(match.submitted_by_name)}` : ""}
                </div>
              </div>
            </div>
            <div class="history-matchup"><strong>Players:</strong> ${escapeHtml(t1Str)} vs ${escapeHtml(t2Str)}</div>
            <div class="history-score"><strong>Score at stoppage:</strong> ${escapeHtml(match.score_text || "Incomplete")}</div>
            ${match.match_notes ? `<div class="history-meta"><strong>Notes:</strong> ${escapeHtml(match.match_notes)}</div>` : ""}
            <div class="match-extras">${partRows}</div>
            <div class="history-card-actions history-card-actions-full">
              <button type="button" class="btn-complete-match history-complete-btn" data-match-id="${match.id}" data-retired-match="${retiredCardJson}">✅ Complete Match</button>
              ${!match.photo_url ? `<button type="button" class="btn-add-photo history-add-photo-btn" data-match-id="${match.id}">📷 Add Photo</button>` : ""}
            </div>
          </div>
        `;
      }

      // Mini-game (Drop-In) cards use a distinct teal-bordered layout
      if (match.match_type === "mini") {
        return `
          <div class="history-item fade-in-card premium-match-card mini-match history-list-card" data-match-id="${match.id}">
            <div class="card-badge-row">
              <span class="match-type-chip">🎾 Drop-In</span>
              <div class="card-badge-right">
                <span class="winner-pill">Winner: ${escapeHtml(winnerText || "—")}</span>
              </div>
            </div>
            <div class="card-photo-date-row">
              ${match.photo_url ? `<img class="card-photo" src="${escapeHtml(match.photo_url)}" alt="Match photo" data-photo-url="${escapeHtml(match.photo_url)}">` : ""}
              <div class="card-date-info">
                <div class="history-meta">
                  <strong>Date:</strong> ${escapeHtml(safeDateText(match.date_played))}
                  ${match.submitted_by_name ? ` • <strong>Submitted by:</strong> ${escapeHtml(match.submitted_by_name)}` : ""}
                </div>
              </div>
            </div>
            <div class="history-matchup"><strong>Players:</strong> ${escapeHtml(display.playersText)}</div>
            <div class="history-score"><strong>Score:</strong> ${escapeHtml(match.score_text || "—")} (games)</div>
            ${match.match_notes ? `<div class="history-meta"><strong>Notes:</strong> ${escapeHtml(match.match_notes)}</div>` : ""}
            ${renderMiniMatchExtras(match, playerMap)}
            <div class="history-card-actions history-card-actions-full">
              <button type="button" class="btn-share-match history-share-btn" data-match="${escapeHtml(cardData)}">⬆ Share</button>
              ${!match.photo_url ? `<button type="button" class="btn-add-photo history-add-photo-btn" data-match-id="${match.id}">📷 Add Photo</button>` : ""}
            </div>
          </div>
        `;
      }

      const upset = isMatchUpset(match);

      return `
        <div class="history-item fade-in-card premium-match-card${upset ? " upset-match" : ""} history-list-card" data-match-id="${match.id}">
          <div class="card-badge-row">
            <span class="match-type-chip">${escapeHtml(match.match_type || "Match")}</span>
            <div class="card-badge-right">
              ${upset ? '<span class="match-badge upset-badge">⚡ Upset</span>' : ""}
              <span class="winner-pill">Winner: ${escapeHtml(winnerText || "—")}</span>
            </div>
          </div>

          <div class="card-photo-date-row">
            ${match.photo_url ? `<img class="card-photo" src="${escapeHtml(match.photo_url)}" alt="Match photo" data-photo-url="${escapeHtml(match.photo_url)}">` : ""}
            <div class="card-date-info">
              <div class="history-meta">
                <strong>Date:</strong> ${escapeHtml(safeDateText(match.date_played))}
                ${match.submitted_by_name ? ` • <strong>Submitted by:</strong> ${escapeHtml(match.submitted_by_name)}` : ""}
              </div>
            </div>
          </div>

          <div class="history-matchup">
            <strong>Players:</strong> ${escapeHtml(display.playersText)}
          </div>

          ${buildOddsLine(match, display)}

          <div class="history-score">
            <strong>Score:</strong> ${escapeHtml(winnerFirstScore(match.score_text || "", match.winner_team))}
          </div>

          ${match.match_notes ? `
            <div class="history-meta">
              <strong>Notes:</strong> ${escapeHtml(match.match_notes)}
            </div>
          ` : ""}

          ${renderMatchExtras(match, playerMap, sexMap)}

          <div class="history-card-actions history-card-actions-full">
            <button type="button" class="btn-share-match history-share-btn" data-match="${escapeHtml(cardData)}">⬆ Share</button>
            ${!match.photo_url ? `<button type="button" class="btn-add-photo history-add-photo-btn" data-match-id="${match.id}">📷 Add Photo</button>` : ""}
          </div>
        </div>
      `;
    }).join("");

    // Event delegation for share, lightbox, add-photo, and complete-match
    if (!container.dataset.shareListenerAttached) {
      container.dataset.shareListenerAttached = "1";
      container.addEventListener("click", (e) => {
        const shareBtn = e.target.closest(".history-share-btn");
        if (shareBtn) {
          try { shareMatchResult(JSON.parse(shareBtn.getAttribute("data-match") || "{}"), shareBtn); } catch (_) {}
          return;
        }
        const thumb = e.target.closest(".match-photo-thumb, .card-photo");
        if (thumb) { openPhotoLightbox(thumb.dataset.photoUrl); return; }
        const completeBtn = e.target.closest(".history-complete-btn");
        if (completeBtn) {
          try { openCompleteMatchModal(completeBtn.dataset.matchId, JSON.parse(completeBtn.dataset.retiredMatch || "{}")); } catch (_) {}
          return;
        }
        const addBtn = e.target.closest(".history-add-photo-btn");
        if (addBtn) {
          const mid = addBtn.dataset.matchId;
          showPhotoUploadModal(mid, (url) => {
            const card = container.querySelector(`[data-match-id="${mid}"]`);
            if (!card) return;
            const photoDateRow = card.querySelector(".card-photo-date-row");
            if (photoDateRow) {
              const img = document.createElement("img");
              img.className = "card-photo";
              img.src = url; img.alt = "Match photo"; img.dataset.photoUrl = url;
              photoDateRow.prepend(img);
            }
            addBtn.remove();
          });
        }
      });
    }
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
      initial_rating,
      ladder_points,
      wins,
      losses,
      games_won,
      games_lost,
      matches_played,
      mini_games_won,
      mini_games_lost,
      mini_points,
      incomplete_matches
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
      ladder_points_p4,
      team1_avg_rating,
      team2_avg_rating,
      set1_team1_games,
      set1_team2_games,
      set2_team1_games,
      set2_team2_games,
      match_notes,
      photo_url,
      mini_games_won_p1,
      mini_games_won_p3
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

function getPlayerMatchPerspective(match, playerId, sexMap = {}) {
  const pid = Number(playerId);
  const isDoubles = match.match_type === "Doubles";
  const isMixed = matchIsMixedGender(match, sexMap);
  const t1Display = unadjustedTeamRating(match.team1_avg_rating, [match.team1_player1_id, match.team1_player2_id], sexMap, isMixed);
  const t2Display = unadjustedTeamRating(match.team2_avg_rating, [match.team2_player1_id, match.team2_player2_id], sexMap, isMixed);

  if (match.team1_player1_id === pid) {
    return { won: match.winner_team === 1, ratingChange: match.rating_change_p1, ladderPoints: match.ladder_points_p1, ratingAtMatch: t1Display, isDoubles };
  }

  if (match.team1_player2_id === pid) {
    return { won: match.winner_team === 1, ratingChange: match.rating_change_p2, ladderPoints: match.ladder_points_p2, ratingAtMatch: t1Display, isDoubles };
  }

  if (match.team2_player1_id === pid) {
    return { won: match.winner_team === 2, ratingChange: match.rating_change_p3, ladderPoints: match.ladder_points_p3, ratingAtMatch: t2Display, isDoubles };
  }

  if (match.team2_player2_id === pid) {
    return { won: match.winner_team === 2, ratingChange: match.rating_change_p4, ladderPoints: match.ladder_points_p4, ratingAtMatch: t2Display, isDoubles };
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
        <p class="small-text">${escapeHtml(player.area || "—")}</p>
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
        ${(player.incomplete_matches || 0) > 0 ? `
        <div class="profile-stat">
          <div class="profile-stat-label">Incomplete</div>
          <div class="profile-stat-value" style="color:#64748b">🏳️ ${player.incomplete_matches}</div>
        </div>
        ` : ""}
      </div>

      <div class="profile-actions">
        <a href="report.html?opponentId=${player.id}" class="button">Report a Match Against ${escapeHtml(player.name || "Player")}</a>
        <button class="btn-share-mobile" id="share-profile-image-btn">📲 Share Profile</button>
      </div>
    `;

    document.getElementById("share-profile-image-btn")?.addEventListener("click", (e) => {
      sharePlayerProfile(playerId, player, e.currentTarget);
    });

    await renderPlayerRatingTrend(playerId, player.display_rating, player.initial_rating);
    renderPointsRankingChart(playerId, player.sex); // async, hides itself on error or <2 matches
    initMatchPreviewButton(playerId, player);
  } catch (error) {
    console.error("Load player profile error:", error);
    container.innerHTML = "<p>Error loading player profile.</p>";
  }
}

/* =========================
   DROP-IN NIGHTS SECTION
========================= */

async function renderDropInSection() {
  const section = document.getElementById("dropin-section");
  if (!section) return;

  const playerId = getPlayerIdFromUrl();
  if (!playerId) return;

  try {
    const [player, allMatches] = await Promise.all([
      fetchPlayerById(playerId),
      fetchMatchesForPlayer(playerId)
    ]);

    const totalDropIn = (player.mini_games_won || 0) + (player.mini_games_lost || 0);
    if (totalDropIn === 0) return;

    const pid = Number(playerId);
    const miniMatches = allMatches
      .filter(m => m.match_type === "mini")
      .sort((a, b) => {
        const dc = (b.date_played || "").localeCompare(a.date_played || "");
        return dc !== 0 ? dc : (b.created_at || "").localeCompare(a.created_at || "");
      });

    const totalWon = player.mini_games_won || 0;
    const winRate = totalDropIn > 0 ? Math.round(totalWon / totalDropIn * 100) : 0;
    const dropInPts = player.mini_points || 0;

    const byDate = {};
    for (const match of miniMatches) {
      const date = match.date_played;
      if (!byDate[date]) byDate[date] = { won: 0, lost: 0 };
      const onTeam1 = [match.team1_player1_id, match.team1_player2_id].includes(pid);
      const gWon = onTeam1 ? (match.mini_games_won_p1 || 0) : (match.mini_games_won_p3 || 0);
      const total = (match.mini_games_won_p1 || 0) + (match.mini_games_won_p3 || 0);
      byDate[date].won += gWon;
      byDate[date].lost += total - gWon;
    }

    let bestDate = null;
    for (const [date, rec] of Object.entries(byDate)) {
      if (!bestDate || rec.won > byDate[bestDate].won) bestDate = date;
    }

    const shortDate = d => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const bestNightHtml = bestDate
      ? `<p class="dropin-best-night">Best night: ${escapeHtml(shortDate(bestDate))} — ${byDate[bestDate].won}W ${byDate[bestDate].lost}L</p>`
      : "";

    const makeRow = (match, hidden) => {
      const onTeam1 = [match.team1_player1_id, match.team1_player2_id].includes(pid);
      const gWon = onTeam1 ? (match.mini_games_won_p1 || 0) : (match.mini_games_won_p3 || 0);
      const total = (match.mini_games_won_p1 || 0) + (match.mini_games_won_p3 || 0);
      const pts = onTeam1 ? (match.ladder_points_p1 || 0) : (match.ladder_points_p3 || 0);
      const outcome = gWon >= total - gWon ? "Won" : "Lost";
      const ptsText = pts >= 0 ? `+${pts} pts` : `${pts} pts`;
      const hiddenAttr = hidden ? ' class="dropin-history-row dropin-hidden-row" style="display:none"' : ' class="dropin-history-row"';
      return `<div${hiddenAttr}>
          <span class="dropin-date">${escapeHtml(shortDate(match.date_played))}</span>
          <span class="dropin-dot"></span>
          <span class="dropin-result">${outcome} ${gWon} of ${total} games</span>
          <span class="dropin-pts">${escapeHtml(ptsText)}</span>
        </div>`;
    };

    const LIMIT = 10;
    const shownRows = miniMatches.slice(0, LIMIT).map(m => makeRow(m, false)).join("");
    const hiddenRows = miniMatches.length > LIMIT
      ? miniMatches.slice(LIMIT).map(m => makeRow(m, true)).join("")
      : "";
    const showAllBtn = miniMatches.length > LIMIT
      ? `<span class="dropin-show-all" id="dropin-show-all-btn">Show all ${miniMatches.length} games ▾</span>`
      : "";

    section.innerHTML = `
      <h2>🎾 Drop-In Nights</h2>
      <div class="dropin-stats-grid">
        <div class="profile-stat">
          <div class="profile-stat-label">Games Played</div>
          <div class="profile-stat-value">${totalDropIn}</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-label">Games Won</div>
          <div class="profile-stat-value">${totalWon}</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-label">Win Rate</div>
          <div class="profile-stat-value">${winRate}%</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-label">Drop-In Pts</div>
          <div class="profile-stat-value">${dropInPts}</div>
        </div>
      </div>
      ${bestNightHtml}
      <div class="dropin-history">
        ${shownRows}
        ${hiddenRows}
        ${showAllBtn}
      </div>
    `;

    section.style.display = "";

    document.getElementById("dropin-show-all-btn")?.addEventListener("click", () => {
      section.querySelectorAll(".dropin-hidden-row").forEach(r => r.style.display = "");
      document.getElementById("dropin-show-all-btn").style.display = "none";
    });
  } catch (err) {
    console.error("Drop-in section error:", err);
  }
}

/* =========================
   MATCH PREVIEW BUTTON + MODAL
========================= */

let _mpCachedPlayers = null;

const mpState = {
  playerId: null,
  player: null,
  genderPlayers: [],
  allSorted: [],
  rankMap: {},
};

function initMatchPreviewButton(playerId, player) {
  const wrap = document.getElementById("match-preview-btn-wrap");
  if (!wrap) return;
  wrap.innerHTML = `<button class="mp-trigger-btn" id="mp-trigger-btn">🎾 Generate Match Preview</button>`;
  document.getElementById("mp-trigger-btn").addEventListener("click", () => {
    openMatchPreviewModal(playerId, player);
  });
}

async function openMatchPreviewModal(playerId, player) {
  const overlay = document.getElementById("mp-overlay");
  if (!overlay) return;

  if (!_mpCachedPlayers) {
    try {
      const { data } = await supabaseClient
        .from("players")
        .select("id, name, sex, dynamic_rating, display_rating, ladder_points, wins, matches_played");
      _mpCachedPlayers = data || [];
    } catch (e) {
      console.error("Match preview: failed to load players", e);
      return;
    }
  }

  const menSorted   = sortPlayersForStandings(_mpCachedPlayers.filter(p => p.sex === "Man"));
  const womenSorted = sortPlayersForStandings(_mpCachedPlayers.filter(p => p.sex === "Woman"));
  const genderPlayers = player.sex === "Man" ? menSorted : womenSorted;
  const allSorted   = sortPlayersForStandings(_mpCachedPlayers);

  const rankMap = {};
  menSorted.forEach((p, i)   => { rankMap[p.id] = i + 1; });
  womenSorted.forEach((p, i) => { rankMap[p.id] = i + 1; });

  mpState.playerId      = Number(playerId);
  mpState.player        = player;
  mpState.genderPlayers = genderPlayers;
  mpState.allSorted     = allSorted;
  mpState.rankMap       = rankMap;

  // Reset to singles mode
  const singlesBtn   = document.getElementById("mp-btn-singles");
  const doublesBtn   = document.getElementById("mp-btn-doubles");
  const singlesFields = document.getElementById("mp-singles-fields");
  const doublesFields = document.getElementById("mp-doubles-fields");

  singlesBtn.classList.add("active");
  doublesBtn.classList.remove("active");
  singlesFields.style.display = "";
  doublesFields.style.display = "none";

  mpFillSinglesDropdown();
  mpFillDoublesDropdowns();

  singlesBtn.onclick = () => {
    singlesBtn.classList.add("active");
    doublesBtn.classList.remove("active");
    singlesFields.style.display = "";
    doublesFields.style.display = "none";
  };

  doublesBtn.onclick = () => {
    doublesBtn.classList.add("active");
    singlesBtn.classList.remove("active");
    singlesFields.style.display = "none";
    doublesFields.style.display = "";
  };

  const generateBtn = document.getElementById("mp-generate-btn");
  if (generateBtn) generateBtn.onclick = mpHandleGenerate;

  const closeBtn = document.getElementById("mp-close-btn");
  if (closeBtn) closeBtn.onclick = closeMatchPreviewModal;

  overlay.onclick = (e) => { if (e.target === overlay) closeMatchPreviewModal(); };

  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeMatchPreviewModal() {
  const overlay = document.getElementById("mp-overlay");
  if (overlay) {
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
  }
  document.body.style.overflow = "";
}

function mpPlayerOption(player, rankMap) {
  const rank = rankMap[player.id] ? `Rank #${rankMap[player.id]}` : "Unranked";
  return `<option value="${player.id}">${escapeHtml(player.name)} — ${rank}</option>`;
}

function mpFillSelect(sel, players) {
  if (!sel) return;
  const prev   = sel.value;
  const sorted = [...players].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  sel.innerHTML = sorted.map(p => mpPlayerOption(p, mpState.rankMap)).join("");
  if (prev && sorted.some(p => String(p.id) === prev)) sel.value = prev;
}

function mpFillSinglesDropdown() {
  const pid = mpState.playerId;
  const opp1 = document.getElementById("mp-opp1");
  mpFillSelect(opp1, mpState.allSorted.filter(p => p.id !== pid));
}

function mpFillDoublesDropdowns() {
  const pid      = mpState.playerId;
  const partner  = document.getElementById("mp-partner");
  const dopp1    = document.getElementById("mp-dopp1");
  const dopp2    = document.getElementById("mp-dopp2");

  const partnerId = partner ? Number(partner.value) || null : null;
  const dopp1Id   = dopp1   ? Number(dopp1.value)   || null : null;

  mpFillSelect(partner, mpState.allSorted.filter(p => p.id !== pid));

  const excl1 = new Set([pid, partnerId].filter(Boolean));
  mpFillSelect(dopp1, mpState.allSorted.filter(p => !excl1.has(p.id)));

  const excl2 = new Set([pid, partnerId, dopp1Id].filter(Boolean));
  mpFillSelect(dopp2, mpState.allSorted.filter(p => !excl2.has(p.id)));

  if (partner) partner.onchange = mpFillDoublesDropdowns;
  if (dopp1)   dopp1.onchange   = mpFillDoublesDropdowns;
}

function mpFindWatcher(playingIds, pts) {
  const pid      = new Set(playingIds.map(Number));
  const minPts   = Math.min(...pts);
  const maxPts   = Math.max(...pts);
  for (const p of mpState.genderPlayers) {
    if (pid.has(p.id)) continue;
    const pp = p.ladder_points ?? 0;
    if (pp > minPts && pp < maxPts) {
      const parts = p.name.trim().split(" ");
      const short = parts[0] + (parts.length > 1 ? " " + parts[parts.length - 1][0] + "." : "");
      return { name: short, points: pp, rank: mpState.rankMap[p.id] || null };
    }
  }
  return null;
}

function mpGetPlayerData(player) {
  return {
    id:     player.id,
    name:   player.name,
    rating: Number(player.dynamic_rating || player.display_rating || 0),
    points: player.ladder_points ?? 0,
    rank:   mpState.rankMap[player.id] || null,
    sex:    player.sex,
  };
}

function mpFindPlayerById(id) {
  return _mpCachedPlayers.find(p => p.id === Number(id)) || null;
}

function mpHandleGenerate() {
  const singlesActive = document.getElementById("mp-btn-singles")?.classList.contains("active");

  let team1, team2;

  if (singlesActive) {
    const opp1Id = document.getElementById("mp-opp1")?.value;
    if (!opp1Id) return alert("Please select an opponent.");
    const opp = mpFindPlayerById(opp1Id);
    if (!opp) return;
    team1 = [mpGetPlayerData(mpState.player)];
    team2 = [mpGetPlayerData(opp)];
  } else {
    const partnerId = document.getElementById("mp-partner")?.value;
    const dopp1Id   = document.getElementById("mp-dopp1")?.value;
    const dopp2Id   = document.getElementById("mp-dopp2")?.value;
    if (!partnerId || !dopp1Id || !dopp2Id) return alert("Please select all four players.");
    const ids = [mpState.playerId, Number(partnerId), Number(dopp1Id), Number(dopp2Id)];
    if (new Set(ids).size < 4) return alert("Please select four different players.");
    const partner = mpFindPlayerById(partnerId);
    const dopp1   = mpFindPlayerById(dopp1Id);
    const dopp2   = mpFindPlayerById(dopp2Id);
    if (!partner || !dopp1 || !dopp2) return;
    team1 = [mpGetPlayerData(mpState.player), mpGetPlayerData(partner)];
    team2 = [mpGetPlayerData(dopp1), mpGetPlayerData(dopp2)];
  }

  const playingIds = [...team1, ...team2].map(p => p.id);
  const allPts     = [...team1, ...team2].map(p => p.points);
  const watcher    = mpFindWatcher(playingIds, allPts);

  const payload = {
    matchType: singlesActive ? "singles" : "doubles",
    team1,
    team2,
    watcher,
  };

  const encoded = encodeURIComponent(JSON.stringify(payload));
  closeMatchPreviewModal();
  window.location.href = `match-preview.html?data=${encoded}`;
}

/* =========================
   THE GAUNTLET
========================= */

function renderGauntletStep({ stepNum, label, player, winProbPct, lowPts, highPts, isChaser, displayName }) {
  const probClass = winProbPct >= 40
    ? "gauntlet-prob-green"
    : winProbPct >= 20
    ? "gauntlet-prob-yellow"
    : "gauntlet-prob-red";

  const ptsStr = Math.round(lowPts) === Math.round(highPts)
    ? `~${Math.round(lowPts)} pts`
    : `~${lowPts}–${highPts} pts`;
  const ptsLabel = isChaser
    ? `Their win would earn: ${ptsStr}`
    : `Win this match: ${ptsStr}`;

  return `
    <div class="gauntlet-step">
      <div class="gauntlet-step-meta">
        <span class="gauntlet-step-num">${stepNum}</span>
        <span class="gauntlet-step-label">${escapeHtml(label)}</span>
      </div>
      <div class="gauntlet-step-body">
        <div class="gauntlet-step-top">
          <a class="gauntlet-name player-link" href="player.html?id=${player.id}">${escapeHtml(displayName || player.name || "")}</a>
          <span class="gauntlet-opp-pts">${player.ladder_points ?? 0} pts</span>
          <span class="gauntlet-prob ${probClass}" title="Your chance of winning this match">${winProbPct}% chance</span>
        </div>
        <div class="gauntlet-step-bottom">
          <span class="gauntlet-pts-range">${ptsLabel}</span>
        </div>
      </div>
    </div>
  `;
}

async function loadGauntlet() {
  const section = document.getElementById("gauntlet-section");
  if (!section) return;

  const playerId = getPlayerIdFromUrl();
  if (!playerId) { section.style.display = "none"; return; }

  try {
    const { data: players, error } = await supabaseClient
      .from("players")
      .select("id, name, sex, dynamic_rating, ladder_points, wins, losses, matches_played");

    if (error || !players?.length) { section.style.display = "none"; return; }

    const viewed = players.find(p => String(p.id) === String(playerId));
    if (!viewed) { section.style.display = "none"; return; }

    const gender      = viewed.sex;
    const genderLabel = gender === "Man" ? "Men's" : "Women's";

    const genderPlayers = sortPlayersForStandings(players.filter(p => p.sex === gender));
    const viewedRank    = genderPlayers.findIndex(p => String(p.id) === String(playerId)) + 1;
    if (viewedRank === 0) { section.style.display = "none"; return; }

    // Name disambiguation across all same-gender players so opponents are always legible
    const gauntletNameMap = disambiguateNames(genderPlayers.map(p => ({ id: p.id, name: p.name })));
    const gDisp = id => gauntletNameMap[id] || "";

    const leader    = genderPlayers[0];
    const viewedPts = Number(viewed.ladder_points ?? 0);
    const leaderPts = Number(leader.ladder_points ?? 0);
    const pointsGap = leaderPts - viewedPts;

    // Elo win probability (same-gender — no rating adjustment needed)
    function eloWinProb(myRating, oppRating) {
      return 1 / (1 + Math.pow(10, (oppRating - myRating) / 0.45));
    }

    // Estimate winner's ladder points for a singles match given hypothetical game counts
    function estimatePts(winnerObj, loserObj, winnerGames, loserGames) {
      const result = calculateMatchScoring({
        matchType: "Singles",
        winnerTeam: 1,
        team1Players: [winnerObj, null],
        team2Players: [loserObj, null],
        team1StandardGames: winnerGames,
        team2StandardGames: loserGames,
        team1TotalGames: winnerGames,
        team2TotalGames: loserGames
      });
      return result.ladderPoints[0]; // winnerPoints for team1
    }

    const viewedObj = {
      sex: viewed.sex,
      dynamic_rating: viewed.dynamic_rating,
      matches_played: viewed.matches_played ?? 0
    };

    // ── Already #1: show the top 3 chasers ────────────────────────────────
    if (viewedRank === 1) {
      const chaserLabels = ["Closest threat", "Next in line", "Keep an eye on"];
      const chasers = genderPlayers.slice(1, 4);

      let html = `<h2>The Gauntlet 🗡️</h2>
        <p class="small-text gauntlet-subtitle">You're at the top. Here's who's coming for you.</p>
        <div class="gauntlet-list">`;

      chasers.forEach((opp, i) => {
        const oppObj  = { sex: opp.sex, dynamic_rating: opp.dynamic_rating, matches_played: opp.matches_played ?? 0 };
        const probRaw = eloWinProb(Number(viewed.dynamic_rating ?? 0), Number(opp.dynamic_rating ?? 0));
        const probPct = Math.round(probRaw * 100);
        const lowPts  = estimatePts(oppObj, viewedObj, 13, 11);
        const highPts = estimatePts(oppObj, viewedObj, 12, 1);
        html += renderGauntletStep({
          stepNum: i + 1,
          label:   chaserLabels[i] || "Challenger",
          player:  opp,
          winProbPct: probPct,
          lowPts, highPts,
          isChaser: true,
          displayName: gDisp(opp.id),
        });
      });

      html += `</div>`;
      section.innerHTML = html;
      return;
    }

    // ── Not #1: build smart opponent selection ───────────────────────────────
    // Competitiveness multiplier: rewards playing up, penalises farming weaker opponents.
    // ratingGap = opp.dynamic_rating - viewed.dynamic_rating (positive = opp is stronger)
    function compMult(gap) {
      if (gap >= 0.5)   return 1.5;  // 0.5+ above: strongly rewarded
      if (gap >= 0)     return 1.3;  // 0 to 0.5 above: slight underdog
      if (gap >= -0.25) return 1.2;  // within 0.25 below: even match
      if (gap >= -0.5)  return 0.8;  // 0 to 0.5 below: mild penalty
      if (gap >= -1.0)  return 0.5;  // 0.5 to 1.0 below: strong penalty
      return 0.25;                   // 1.0+ below: very strong penalty
    }

    const candidates = genderPlayers
      .filter(p => String(p.id) !== String(playerId))
      .map(opp => {
        const oppObj    = { sex: opp.sex, dynamic_rating: opp.dynamic_rating, matches_played: opp.matches_played ?? 0 };
        const probRaw   = eloWinProb(Number(viewed.dynamic_rating ?? 0), Number(opp.dynamic_rating ?? 0));
        const probPct   = Math.round(probRaw * 100);
        const lowPts    = estimatePts(viewedObj, oppObj, 13, 11);
        const highPts   = estimatePts(viewedObj, oppObj, 12, 1);
        const midPts    = Math.round((lowPts + highPts) / 2);
        const ratingGap = Number(opp.dynamic_rating ?? 0) - Number(viewed.dynamic_rating ?? 0);
        const score     = midPts * probRaw * compMult(ratingGap);
        return { opp, probPct, probRaw, lowPts, highPts, midPts, score, ratingGap };
      });

    const eligible      = candidates.filter(c => c.probPct >= 20);
    const pool          = eligible.length >= 3 ? eligible : candidates;
    const showUpsetNote = eligible.length < 3;

    // Select top 4 by adjusted score
    let topPicks = [...pool].sort((a, b) => b.score - a.score).slice(0, 4);

    // Diversity cap: no more than 1 opponent rated > 0.5 below the viewed player
    const WEAK_THRESH = -0.5;
    if (topPicks.filter(c => c.ratingGap < WEAK_THRESH).length > 1) {
      let keptWeak = false;
      topPicks = topPicks.filter(c => {
        if (c.ratingGap < WEAK_THRESH) {
          if (!keptWeak) { keptWeak = true; return true; }
          return false;
        }
        return true;
      });
      // Fill gaps with the highest-scored non-weak eligible opponents not already chosen
      const selectedIds  = new Set(topPicks.map(c => String(c.opp.id)));
      const replacements = pool
        .filter(c => !selectedIds.has(String(c.opp.id)) && c.ratingGap >= WEAK_THRESH && c.probPct >= 20)
        .sort((a, b) => b.score - a.score);
      for (const r of replacements) {
        if (topPicks.length >= 4) break;
        topPicks.push(r);
      }
    }

    // Sort: highest win probability first (most actionable) → lowest (most aspirational)
    topPicks.sort((a, b) => b.probPct - a.probPct);

    const stepLabels = ["Most winnable", "Best value", "The challenge", "The stretch"];

    // Minimum wins needed: accumulate midPts from highest-yielding picks until gap closes
    const picksByMid  = [...topPicks].sort((a, b) => b.midPts - a.midPts);
    let accumulated   = 0;
    let minWins       = topPicks.length;
    for (let i = 0; i < picksByMid.length; i++) {
      accumulated += picksByMid[i].midPts;
      if (viewedPts + accumulated >= leaderPts) { minWins = i + 1; break; }
    }
    const minAccumulated = picksByMid.slice(0, minWins).reduce((s, c) => s + c.midPts, 0);
    const totalMidPts    = topPicks.reduce((s, c) => s + c.midPts, 0);
    const canClose       = viewedPts + minAccumulated >= leaderPts;
    const total          = topPicks.length;

    let html = `<h2>The Gauntlet 🗡️</h2>
      <p class="small-text gauntlet-subtitle">You're ${pointsGap} point${pointsGap === 1 ? "" : "s"} behind ${escapeHtml(gDisp(leader.id) || leader.name)}. Here's your path.</p>
      ${showUpsetNote ? `<p class="gauntlet-upset-warning">These won't be easy — but every upset starts somewhere.</p>` : ""}
      <div class="gauntlet-list">`;

    topPicks.forEach((c, i) => {
      html += renderGauntletStep({
        stepNum:     i + 1,
        label:       stepLabels[i] || "The stretch",
        player:      c.opp,
        winProbPct:  c.probPct,
        lowPts:      c.lowPts,
        highPts:     c.highPts,
        isChaser:    false,
        displayName: gDisp(c.opp.id),
      });
    });

    html += `</div>`;

    // Summary: minimum wins needed phrasing
    let summaryText;
    if (canClose && minWins < total) {
      summaryText = `Win any ${minWins} of these ${total} matches and you'd earn roughly ${minAccumulated} pts — <strong>enough to take the lead.</strong>`;
    } else if (canClose) {
      summaryText = `You'll need to win all ${total} of these to close the gap — roughly ${totalMidPts} pts total.`;
    } else {
      const remaining = leaderPts - (viewedPts + totalMidPts);
      summaryText = `Win all ${total} of these and you'd earn roughly ${totalMidPts} pts, putting you within <strong>${remaining} pts of #1.</strong>`;
    }

    html += `<p class="gauntlet-summary">${summaryText}</p>`;
    section.innerHTML = html;

  } catch (err) {
    console.error("Gauntlet error:", err);
    section.style.display = "none";
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
    const [playerMap, sexMap] = await Promise.all([
      fetchPlayerNamesForMatches(matches),
      fetchPlayerSexMap(matches)
    ]);

    if (!matches.length) {
      container.innerHTML = "<p>No matches found for this player.</p>";
      return;
    }

    const reversed = [...matches].sort(sortByDateDesc);

    container.innerHTML = reversed.map((match) => {
      const display = buildMatchDisplay(match, playerMap);
      const _wt = match.winner_team;
      const _winnerText = _wt === 1 ? display.team1Text : display.team2Text;
      const _loserText  = _wt === 1 ? display.team2Text : display.team1Text;
      const playerMatchCardData = JSON.stringify({
        type: match.match_type || "Match",
        winner: _winnerText || "—",
        loser:  _loserText  || "—",
        score: winnerFirstScore(match.score_text || "", match.winner_team),
        date: safeDateText(match.date_played),
        notes: match.match_notes || "",
        winnerTeam: _wt,
        t1Avg: match.team1_avg_rating,
        t2Avg: match.team2_avg_rating,
        winnerPts: _wt === 1 ? match.ladder_points_p1 : match.ladder_points_p3,
        loserPts:  _wt === 1 ? match.ladder_points_p3 : match.ladder_points_p1,
        winnerRc:  _wt === 1 ? match.rating_change_p1 : match.rating_change_p3,
        loserRc:   _wt === 1 ? match.rating_change_p3 : match.rating_change_p1,
      });

      // Retired / incomplete card (player profile view)
      if (match.match_type === "retired") {
        const allRetiredIds2 = [match.team1_player1_id, match.team1_player2_id, match.team2_player1_id, match.team2_player2_id].filter(Boolean);
        const retiredObjs2 = allRetiredIds2.map(id => ({ id, name: playerMap[id] })).filter(p => p.name);
        const retiredNm2 = disambiguateNames(retiredObjs2);
        const rName2 = id => id ? (retiredNm2[id] || playerMap[id] || "?") : null;
        const t1Str2 = [match.team1_player1_id, match.team1_player2_id].filter(Boolean).map(rName2).filter(Boolean).join(" / ");
        const t2Str2 = [match.team2_player1_id, match.team2_player2_id].filter(Boolean).map(rName2).filter(Boolean).join(" / ");
        const matchFmt2 = match.team1_player2_id ? "Doubles" : "Singles";
        const ptsByPlayer2 = {
          [match.team1_player1_id]: match.ladder_points_p1 ?? 5,
          [match.team1_player2_id]: match.ladder_points_p2 ?? 5,
          [match.team2_player1_id]: match.ladder_points_p3 ?? 5,
          [match.team2_player2_id]: match.ladder_points_p4 ?? 5,
        };
        const partRows2 = allRetiredIds2.map(id => {
          const dn = escapeHtml(retiredNm2[id] || playerMap[id] || "?");
          const pts = ptsByPlayer2[id] ?? 5;
          const isSelf = Number(id) === Number(playerId);
          const nameHtml = isSelf ? dn : `<a href="player.html?id=${id}" class="player-link">${dn}</a>`;
          return `<div class="match-extra-row">
            <span class="match-extra-name">${nameHtml}</span>
            <span class="match-extra-stat">Points: +${pts}</span>
            <span class="match-extra-combined">+${pts} pts</span>
          </div>`;
        }).join("");
        const retiredCardJson2 = escapeHtml(JSON.stringify({
          id: match.id, team1_player1_id: match.team1_player1_id, team1_player2_id: match.team1_player2_id,
          team2_player1_id: match.team2_player1_id, team2_player2_id: match.team2_player2_id,
          submitted_by_name: match.submitted_by_name, match_notes: match.match_notes,
        }));
        return `
          <div class="history-item fade-in-card premium-match-card retired-match" data-match-id="${match.id}">
            <div class="card-badge-row">
              <span class="match-type-chip retired-chip">🏳️ Incomplete</span>
              <div class="card-badge-right">
                <span class="match-badge retired-badge">${escapeHtml(matchFmt2)}</span>
              </div>
            </div>
            <div class="card-photo-date-row">
              ${match.photo_url ? `<img class="card-photo" src="${escapeHtml(match.photo_url)}" alt="Match photo" data-photo-url="${escapeHtml(match.photo_url)}">` : ""}
              <div class="card-date-info">
                <div class="history-meta"><strong>Date:</strong> ${escapeHtml(safeDateText(match.date_played))}</div>
              </div>
            </div>
            <div class="history-matchup"><strong>Players:</strong> ${escapeHtml(t1Str2)} vs ${escapeHtml(t2Str2)}</div>
            <div class="history-score"><strong>Score at stoppage:</strong> ${escapeHtml(match.score_text || "Incomplete")}</div>
            ${match.match_notes ? `<div class="history-meta"><strong>Notes:</strong> ${escapeHtml(match.match_notes)}</div>` : ""}
            <div class="match-extras">${partRows2}</div>
            <div class="history-card-actions history-card-actions-full">
              <button type="button" class="btn-complete-match history-complete-btn" data-match-id="${match.id}" data-retired-match="${retiredCardJson2}">✅ Complete Match</button>
              ${!match.photo_url ? `<button type="button" class="btn-add-photo history-add-photo-btn" data-match-id="${match.id}">📷 Add Photo</button>` : ""}
            </div>
          </div>
        `;
      }

      // Mini-game card
      if (match.match_type === "mini") {
        const pid = Number(playerId);
        const onTeam1 = match.team1_player1_id === pid;
        const myPts   = onTeam1 ? (match.ladder_points_p1 ?? 0) : (match.ladder_points_p3 ?? 0);
        const oppPts  = onTeam1 ? (match.ladder_points_p3 ?? 0) : (match.ladder_points_p1 ?? 0);
        const miniResult = myPts > oppPts ? "Win" : myPts < oppPts ? "Loss" : "Tie";
        const miniClass  = myPts > oppPts ? "win" : myPts < oppPts ? "loss" : "";
        return `
          <div class="history-item fade-in-card premium-match-card mini-match" data-match-id="${match.id}">
            <div class="card-badge-row">
              <span class="match-type-chip">🎾 Drop-In</span>
              <div class="card-badge-right">
                <span class="winner-pill ${miniClass}">${miniResult}</span>
              </div>
            </div>
            <div class="card-photo-date-row">
              ${match.photo_url ? `<img class="card-photo" src="${escapeHtml(match.photo_url)}" alt="Match photo" data-photo-url="${escapeHtml(match.photo_url)}">` : ""}
              <div class="card-date-info">
                <div class="history-meta"><strong>Date:</strong> ${escapeHtml(safeDateText(match.date_played))}</div>
              </div>
            </div>
            <div class="history-matchup"><strong>Players:</strong> ${escapeHtml(display.playersText)}</div>
            <div class="history-score"><strong>Score:</strong> ${escapeHtml(match.score_text || "—")} (games)</div>
            ${match.match_notes ? `<div class="history-meta"><strong>Notes:</strong> ${escapeHtml(match.match_notes)}</div>` : ""}
            <div class="match-bottom-section">
              ${renderMiniMatchExtras(match, playerMap, playerId)}
            </div>
            <div class="history-card-actions">
              <button type="button" class="btn-share-match history-share-btn" data-match="${escapeHtml(playerMatchCardData)}">⬆ Share</button>
              ${!match.photo_url ? `<button type="button" class="btn-add-photo history-add-photo-btn" data-match-id="${match.id}">📷 Add Photo</button>` : ""}
            </div>
          </div>
        `;
      }

      const perspective = getPlayerMatchPerspective(match, playerId, sexMap);
      const resultClass = perspective?.won ? "win" : "loss";
      const resultText = perspective?.won ? "Win" : "Loss";
      const upset = isMatchUpset(match);

      return `
        <div class="history-item fade-in-card premium-match-card${upset ? " upset-match" : ""}" data-match-id="${match.id}">
          <div class="card-badge-row">
            <span class="match-type-chip">${escapeHtml(match.match_type || "Match")}</span>
            <div class="card-badge-right">
              ${upset ? '<span class="match-badge upset-badge">⚡ Upset</span>' : ""}
              <span class="winner-pill ${resultClass}">${resultText}</span>
            </div>
          </div>

          <div class="card-photo-date-row">
            ${match.photo_url ? `<img class="card-photo" src="${escapeHtml(match.photo_url)}" alt="Match photo" data-photo-url="${escapeHtml(match.photo_url)}">` : ""}
            <div class="card-date-info">
              <div class="history-meta"><strong>Date:</strong> ${escapeHtml(safeDateText(match.date_played))}</div>
            </div>
          </div>

          <div class="history-matchup">
            <strong>Players:</strong> ${escapeHtml(display.playersText)}
          </div>

          ${buildOddsLine(match, display)}

          <div class="history-score">
            <strong>Score:</strong> ${escapeHtml(winnerFirstScore(match.score_text || "", match.winner_team))}
          </div>

          ${match.match_notes ? `
            <div class="history-meta">
              <strong>Notes:</strong> ${escapeHtml(match.match_notes)}
            </div>
          ` : ""}

          <div class="match-bottom-section">
            ${renderMatchExtras(match, playerMap, sexMap, playerId)}
          </div>

          <div class="history-card-actions">
            <button type="button" class="btn-share-match history-share-btn" data-match="${escapeHtml(playerMatchCardData)}">⬆ Share</button>
            ${!match.photo_url ? `<button type="button" class="btn-add-photo history-add-photo-btn" data-match-id="${match.id}">📷 Add Photo</button>` : ""}
          </div>
        </div>
      `;
    }).join("");

    if (!container.dataset.shareListenerAttached) {
      container.dataset.shareListenerAttached = "1";
      container.addEventListener("click", (e) => {
        const shareBtn = e.target.closest(".history-share-btn");
        if (shareBtn) {
          try { shareMatchResult(JSON.parse(shareBtn.getAttribute("data-match") || "{}"), shareBtn); } catch (_) {}
          return;
        }
        const thumb = e.target.closest(".match-photo-thumb, .card-photo");
        if (thumb) { openPhotoLightbox(thumb.dataset.photoUrl); return; }
        const completeBtn = e.target.closest(".history-complete-btn");
        if (completeBtn) {
          try { openCompleteMatchModal(completeBtn.dataset.matchId, JSON.parse(completeBtn.dataset.retiredMatch || "{}")); } catch (_) {}
          return;
        }
        const addBtn = e.target.closest(".history-add-photo-btn");
        if (addBtn) {
          const mid = addBtn.dataset.matchId;
          showPhotoUploadModal(mid, (url) => {
            const card = container.querySelector(`[data-match-id="${mid}"]`);
            if (!card) return;
            const photoDateRow = card.querySelector(".card-photo-date-row");
            if (photoDateRow) {
              const img = document.createElement("img");
              img.className = "card-photo";
              img.src = url; img.alt = "Match photo"; img.dataset.photoUrl = url;
              photoDateRow.prepend(img);
            }
            addBtn.remove();
          });
        }
      });
    }
  } catch (error) {
    console.error("Load player history error:", error);
    container.innerHTML = "<p>Error loading player history.</p>";
  }
}

/* =========================
   COMPLETE RETIRED MATCH
========================= */

async function openCompleteMatchModal(matchId, retiredMatch) {
  document.getElementById("complete-match-overlay")?.remove();

  // Fetch fresh player names
  const allIds = [retiredMatch.team1_player1_id, retiredMatch.team1_player2_id,
    retiredMatch.team2_player1_id, retiredMatch.team2_player2_id].filter(Boolean).map(Number);
  const { data: players } = await supabaseClient.from("players").select("id, name").in("id", allIds);
  const pmFresh = {};
  (players || []).forEach(p => { pmFresh[p.id] = p.name; });

  const playerObjs = allIds.map(id => ({ id, name: pmFresh[id] })).filter(p => p.name);
  const nmFresh = disambiguateNames(playerObjs);
  const gName = id => nmFresh[id] || pmFresh[id] || "?";

  const isDoubles = !!(retiredMatch.team1_player2_id);
  const t1Name = [retiredMatch.team1_player1_id, retiredMatch.team1_player2_id].filter(Boolean).map(gName).join(" & ");
  const t2Name = [retiredMatch.team2_player1_id, retiredMatch.team2_player2_id].filter(Boolean).map(gName).join(" & ");
  const today  = new Date().toISOString().split("T")[0];

  const overlay = document.createElement("div");
  overlay.className = "match-card-overlay";
  overlay.id = "complete-match-overlay";
  overlay.innerHTML = `
    <div class="match-card-modal" role="dialog" aria-modal="true">
      <div class="mcm-header">
        <p class="mcm-badge">✅ Complete This Match</p>
        <p class="mcm-score" style="font-size:14px">${escapeHtml(t1Name)} vs ${escapeHtml(t2Name)}</p>
      </div>
      <div class="mcm-body">
        <p style="font-size:13px;color:var(--muted);margin:0 0 12px">${isDoubles ? "Doubles" : "Singles"} · originally logged as incomplete</p>
        <div class="form-group">
          <label style="font-weight:600">Winner</label>
          <select id="cmpl-winner" required style="font-size:15px;padding:10px;margin-top:4px">
            <option value="">Select winner</option>
            <option value="1">${escapeHtml(t1Name)}</option>
            <option value="2">${escapeHtml(t2Name)}</option>
          </select>
        </div>
        <div style="margin-top:12px">
          <p style="font-weight:600;font-size:13px;margin:0 0 6px">Score</p>
          <div class="score-row polished-score-row">
            <div class="form-group score-input-group"><label>Set 1 – ${escapeHtml(t1Name.split(" & ")[0])}</label><input type="number" id="cmpl-s1t1" class="score-input" min="0" max="7" placeholder="0" required></div>
            <div class="score-divider">–</div>
            <div class="form-group score-input-group"><label>${escapeHtml(t2Name.split(" & ")[0])}</label><input type="number" id="cmpl-s1t2" class="score-input" min="0" max="7" placeholder="0" required></div>
          </div>
          <div class="score-row polished-score-row" style="margin-top:8px">
            <div class="form-group score-input-group"><label>Set 2</label><input type="number" id="cmpl-s2t1" class="score-input" min="0" max="7" placeholder="0" required></div>
            <div class="score-divider">–</div>
            <div class="form-group score-input-group"><label>Set 2</label><input type="number" id="cmpl-s2t2" class="score-input" min="0" max="7" placeholder="0" required></div>
          </div>
          <div class="score-row polished-score-row" style="margin-top:8px">
            <div class="form-group score-input-group"><label>Tiebreak (opt.)</label><input type="number" id="cmpl-s3t1" class="score-input" min="0" max="99" placeholder="0"></div>
            <div class="score-divider">–</div>
            <div class="form-group score-input-group"><label>Tiebreak (opt.)</label><input type="number" id="cmpl-s3t2" class="score-input" min="0" max="99" placeholder="0"></div>
          </div>
        </div>
        <div class="form-group" style="margin-top:12px">
          <label style="font-weight:600">Date Played</label>
          <input type="date" id="cmpl-date" value="${today}" required style="font-size:15px;padding:10px;margin-top:4px">
        </div>
        <p id="cmpl-status" style="color:#dc2626;font-size:13px;margin-top:8px;min-height:18px"></p>
      </div>
      <div class="mcm-footer">
        <button class="mcm-btn-copy" id="cmpl-submit-btn">Submit Final Result</button>
        <button class="mcm-btn-close" id="cmpl-cancel-btn">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById("cmpl-cancel-btn").addEventListener("click", () => overlay.remove());
  document.getElementById("cmpl-submit-btn").addEventListener("click", () =>
    handleCompleteMatch(matchId, retiredMatch, overlay, isDoubles));
}

async function handleCompleteMatch(matchId, originalMatch, overlay, isDoubles) {
  const winnerTeam = parseInt(document.getElementById("cmpl-winner")?.value, 10);
  const s1t1 = toNumberOrNull(document.getElementById("cmpl-s1t1")?.value);
  const s1t2 = toNumberOrNull(document.getElementById("cmpl-s1t2")?.value);
  const s2t1 = toNumberOrNull(document.getElementById("cmpl-s2t1")?.value);
  const s2t2 = toNumberOrNull(document.getElementById("cmpl-s2t2")?.value);
  const s3t1 = toNumberOrNull(document.getElementById("cmpl-s3t1")?.value);
  const s3t2 = toNumberOrNull(document.getElementById("cmpl-s3t2")?.value);
  const datePlayed = document.getElementById("cmpl-date")?.value;
  const statusEl  = document.getElementById("cmpl-status");
  const submitBtn = document.getElementById("cmpl-submit-btn");
  const showErr = msg => { if (statusEl) statusEl.textContent = msg; };

  if (!winnerTeam) return showErr("Please select a winner.");
  if (s1t1 == null || s1t2 == null || s2t1 == null || s2t2 == null) return showErr("Please enter set scores.");
  if (!datePlayed) return showErr("Please enter the date played.");

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";
  if (statusEl) statusEl.textContent = "";

  try {
    const allIds = [originalMatch.team1_player1_id, originalMatch.team1_player2_id,
      originalMatch.team2_player1_id, originalMatch.team2_player2_id].filter(Boolean).map(Number);

    const { data: players, error: pErr } = await supabaseClient
      .from("players")
      .select("id, name, sex, display_rating, dynamic_rating, rating, ladder_points, wins, losses, games_won, games_lost, matches_played, incomplete_matches")
      .in("id", allIds);
    if (pErr) throw pErr;

    const byId = {};
    (players || []).forEach(p => { byId[p.id] = p; });

    const t1p1 = byId[originalMatch.team1_player1_id] || null;
    const t1p2 = originalMatch.team1_player2_id ? byId[originalMatch.team1_player2_id] || null : null;
    const t2p1 = byId[originalMatch.team2_player1_id] || null;
    const t2p2 = originalMatch.team2_player2_id ? byId[originalMatch.team2_player2_id] || null : null;

    const matchFmt = isDoubles ? "Doubles" : "Singles";
    const t1Std = (s1t1 ?? 0) + (s2t1 ?? 0);
    const t2Std = (s1t2 ?? 0) + (s2t2 ?? 0);
    const has3Set = s3t1 != null && s3t2 != null;

    const scoringResult = calculateMatchScoring({
      matchType: matchFmt, winnerTeam,
      team1Players: [t1p1, t1p2], team2Players: [t2p1, t2p2],
      team1StandardGames: t1Std, team2StandardGames: t2Std,
      team1TotalGames: t1Std, team2TotalGames: t2Std, has3Set,
    });

    const scoreText = buildScoreText(s1t1, s1t2, s2t1, s2t2, has3Set ? s3t1 : null, has3Set ? s3t2 : null);

    const newMatchPayload = {
      match_type: matchFmt, is_completed: true, winner_team: winnerTeam,
      score_text: scoreText, date_played: datePlayed,
      submitted_by_name: originalMatch.submitted_by_name || null,
      match_notes: originalMatch.match_notes || null,
      season_year: new Date(datePlayed).getFullYear(),
      team1_player1_id: originalMatch.team1_player1_id,
      team1_player2_id: originalMatch.team1_player2_id || null,
      team2_player1_id: originalMatch.team2_player1_id,
      team2_player2_id: originalMatch.team2_player2_id || null,
      set1_team1_games: s1t1, set1_team2_games: s1t2,
      set2_team1_games: s2t1, set2_team2_games: s2t2,
      set3_team1_games: has3Set ? s3t1 : null, set3_team2_games: has3Set ? s3t2 : null,
      team1_total_games: t1Std, team2_total_games: t2Std,
      team1_avg_rating: scoringResult.team1AvgRating, team2_avg_rating: scoringResult.team2AvgRating,
      rating_change_p1: scoringResult.ratingChanges[0],
      rating_change_p2: t1p2 ? scoringResult.ratingChanges[1] : null,
      rating_change_p3: scoringResult.ratingChanges[2],
      rating_change_p4: t2p2 ? scoringResult.ratingChanges[3] : null,
      ladder_points_p1: scoringResult.ladderPoints[0],
      ladder_points_p2: t1p2 ? scoringResult.ladderPoints[1] : null,
      ladder_points_p3: scoringResult.ladderPoints[2],
      ladder_points_p4: t2p2 ? scoringResult.ladderPoints[3] : null,
    };

    // Build player stat updates: subtract 5 participation pts, add full match pts
    const t1Won = winnerTeam === 1, t2Won = winnerTeam === 2;
    const buildUpd = (player, rc, lp, won, ownStd, oppStd) => {
      if (!player) return null;
      const nextRating = roundToTwo(Number(player.display_rating ?? player.dynamic_rating ?? 0) + Number(rc || 0));
      return {
        id: player.id,
        display_rating: nextRating, dynamic_rating: nextRating, rating: Math.round(nextRating * 100),
        ladder_points: Math.max(0, (player.ladder_points || 0) - 5) + Number(lp || 0),
        wins:   (player.wins   || 0) + (won ? 1 : 0),
        losses: (player.losses || 0) + (won ? 0 : 1),
        games_won:  (player.games_won  || 0) + (ownStd || 0),
        games_lost: (player.games_lost || 0) + (oppStd || 0),
        matches_played:    (player.matches_played    || 0) + 1,
        incomplete_matches: Math.max(0, (player.incomplete_matches || 0) - 1),
      };
    };
    const playerUpdates = [
      buildUpd(t1p1, scoringResult.ratingChanges[0], scoringResult.ladderPoints[0], t1Won, t1Std, t2Std),
      buildUpd(t1p2, scoringResult.ratingChanges[1], scoringResult.ladderPoints[1], t1Won, t1Std, t2Std),
      buildUpd(t2p1, scoringResult.ratingChanges[2], scoringResult.ladderPoints[2], t2Won, t2Std, t1Std),
      buildUpd(t2p2, scoringResult.ratingChanges[3], scoringResult.ladderPoints[3], t2Won, t2Std, t1Std),
    ].filter(Boolean);

    // Delete retired match, insert completed match
    const { error: delErr } = await supabaseClient.from("matches").delete().eq("id", matchId);
    if (delErr) throw delErr;
    const { error: insErr } = await supabaseClient.from("matches").insert([newMatchPayload]);
    if (insErr) throw insErr;

    // Update player stats
    for (const upd of playerUpdates) {
      const { id, ...payload } = upd;
      const { error: upErr } = await supabaseClient.from("players").update(payload).eq("id", id);
      if (upErr) throw upErr;
    }

    overlay.remove();
    showShareToast("Match completed! Full points and ratings updated.");
    if (document.getElementById("history-list")) await loadMatchHistory();
    if (document.getElementById("player-match-history")) await loadPlayerMatchHistory();
  } catch (err) {
    console.error("Complete match error:", err);
    showErr(`Error: ${err.message}`);
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Final Result";
  }
}

/* =========================
   SHARE CARDS (mobile image share)
========================= */

function showShareToast(msg) {
  document.querySelector(".share-toast")?.remove();
  const t = document.createElement("div");
  t.className = "share-toast";
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add("visible")));
  setTimeout(() => {
    t.classList.remove("visible");
    setTimeout(() => t.remove(), 300);
  }, 2800);
}

async function captureAndShare(cardEl, shareText, btn) {
  // Mount visibly but out of interaction range so the browser fully paints it
  Object.assign(cardEl.style, {
    position: "fixed", top: "0", left: "0",
    opacity: "0", pointerEvents: "none", zIndex: "-1"
  });
  document.body.appendChild(cardEl);

  // Force a layout reflow so dimensions and styles are resolved
  void cardEl.offsetHeight;

  // Give the browser time to paint fonts, colours, and layout
  await new Promise((resolve) => setTimeout(resolve, 800));

  try {
    const canvas = await html2canvas(cardEl, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#1F4D3A",
      logging: false,
      onclone: (_clonedDoc, clonedEl) => {
        clonedEl.style.opacity = "1";
        clonedEl.style.visibility = "visible";
        clonedEl.style.position = "relative";
        clonedEl.style.left = "0";
        clonedEl.style.top = "0";
        clonedEl.style.zIndex = "1";
      },
    });

    // Remove card before triggering share sheet so it doesn't flash
    cardEl.remove();

    await new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) { showShareToast("Could not generate image"); resolve(); return; }
        try {
          const file = new File([blob], "resto-tennis.png", { type: "image/png" });
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: "Restoration Tennis Ladder", text: shareText });
          } else {
            showShareToast("Open on mobile to share");
          }
        } catch (err) {
          if (err.name !== "AbortError") showShareToast("Open on mobile to share");
        }
        resolve();
      }, "image/png");
    });
  } finally {
    // Guard: remove in case an error occurred before the explicit remove above
    cardEl.parentNode && cardEl.remove();
    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.dataset.origLabel || "📲 Share";
    }
  }
}

function findSignatureMatch(playerId, matches, nameMap) {
  const pid = Number(playerId);

  const wins = matches.filter((m) => {
    if (!m.team1_avg_rating || !m.team2_avg_rating) return false;
    const onT1 = [m.team1_player1_id, m.team1_player2_id].includes(pid);
    return (onT1 && m.winner_team === 1) || (!onT1 && m.winner_team === 2);
  });

  if (!wins.length) return null;

  const scored = wins.map((m) => {
    const onT1 = [m.team1_player1_id, m.team1_player2_id].includes(pid);
    const myAvg  = onT1 ? Number(m.team1_avg_rating) : Number(m.team2_avg_rating);
    const oppAvg = onT1 ? Number(m.team2_avg_rating) : Number(m.team1_avg_rating);
    const prob   = 1 / (1 + Math.pow(10, (oppAvg - myAvg) / 0.45));

    const t1Std = Number(m.set1_team1_games ?? 0) + Number(m.set2_team1_games ?? 0);
    const t2Std = Number(m.set1_team2_games ?? 0) + Number(m.set2_team2_games ?? 0);
    const wStd  = onT1 ? t1Std : t2Std;
    const lStd  = onT1 ? t2Std : t1Std;
    const gap   = Math.min(Math.abs(myAvg - oppAvg), 0.5);
    const exp   = myAvg >= oppAvg ? gap * 16 : -(gap * 16);
    const delta = (wStd - lStd) - exp;

    const oppIds = onT1
      ? [m.team2_player1_id, m.team2_player2_id].filter(Boolean)
      : [m.team1_player1_id, m.team1_player2_id].filter(Boolean);
    const oppNames = oppIds.map((id) => nameMap[id] || "?").join(" / ");

    // Points earned by the player in this match
    let pts = null;
    if (m.team1_player1_id === pid) pts = m.ladder_points_p1;
    else if (m.team1_player2_id === pid) pts = m.ladder_points_p2;
    else if (m.team2_player1_id === pid) pts = m.ladder_points_p3;
    else if (m.team2_player2_id === pid) pts = m.ladder_points_p4;

    return { match: m, prob, delta, pts, oppNames };
  });

  const upsets = scored.filter((w) => w.prob < 0.40);
  if (upsets.length) {
    const best = upsets.reduce((a, b) => a.prob < b.prob ? a : b);
    return { type: "upset", ...best };
  }

  const best = scored.reduce((a, b) => a.delta > b.delta ? a : b);
  return { type: "performance", ...best };
}

function buildPlayerShareCard(player, genderRank, genderLabel, statusText, sigMatch) {
  const statusBg = {
    "Hot": "#b91c1c",
    "On a Slide": "#6b7280",
    "Active": "#166534",
    "New": "#1e40af",
    "Idle": "#4b5563",
  }[statusText] || "#1f4d3a";

  const statusEmoji = statusText === "Hot" ? " 🔥" : statusText === "On a Slide" ? " 📉" : "";

  let sigHTML = "";
  if (sigMatch) {
    const score   = winnerFirstScore(sigMatch.match.score_text || "", sigMatch.match.winner_team);
    const dateStr = sigMatch.match.date_played
      ? new Date(sigMatch.match.date_played).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "";
    const subline = sigMatch.type === "upset"
      ? `${Math.round(sigMatch.prob * 100)}% chance going in`
      : `Outperformed by +${sigMatch.delta.toFixed(1)} games`;
    const label   = sigMatch.type === "upset" ? "⚡ Best Upset" : "🎯 Best Performance";

    sigHTML = `
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.15);">
        <div style="font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px;">${label}</div>
        <div style="font-size:14px;font-weight:700;line-height:1.3;">def. ${escapeHtml(sigMatch.oppNames)}</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.65);margin-top:3px;">${escapeHtml(score)} &nbsp;·&nbsp; ${escapeHtml(dateStr)} &nbsp;·&nbsp; ${sigMatch.pts ?? "—"} pts</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:2px;">${escapeHtml(subline)}</div>
      </div>`;
  } else {
    sigHTML = `
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.15);">
        <div style="font-size:13px;color:rgba(255,255,255,0.4);font-style:italic;">Season in progress…</div>
      </div>`;
  }

  const el = document.createElement("div");
  el.style.cssText = `
    width:390px;height:520px;overflow:hidden;
    background:#1F4D3A;
    font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;
    color:#fff;box-sizing:border-box;
    padding:24px 24px 20px;
    display:flex;flex-direction:column;
    border-radius:16px;
  `;

  el.innerHTML = `
    <div style="text-align:right;font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:.03em;margin-bottom:18px;">
      🎾 Restoration Tennis Ladder
    </div>

    <div style="flex:1;min-height:0;">
      <div style="font-size:28px;font-weight:800;line-height:1.1;letter-spacing:-.5px;">${escapeHtml(player.name || "")}</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-top:4px;">${escapeHtml(player.area || "")}</div>

      <div style="height:1px;background:rgba(255,255,255,0.15);margin:16px 0;"></div>

      <div style="display:flex;flex-wrap:wrap;gap:12px;">
        <div style="flex:1 1 155px;background:rgba(255,255,255,0.09);border-radius:10px;padding:12px 14px;">
          <div style="font-size:11px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px;">Rank</div>
          <div style="font-size:19px;font-weight:700;">#${genderRank || "—"} <span style="font-size:12px;font-weight:400;color:rgba(255,255,255,0.55);">${escapeHtml(genderLabel)}</span></div>
        </div>
        <div style="flex:1 1 155px;background:rgba(255,255,255,0.09);border-radius:10px;padding:12px 14px;">
          <div style="font-size:11px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px;">Rating</div>
          <div style="font-size:19px;font-weight:700;">${formatDisplayRating(player.dynamic_rating)}</div>
        </div>
        <div style="flex:1 1 155px;background:rgba(255,255,255,0.09);border-radius:10px;padding:12px 14px;">
          <div style="font-size:11px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px;">Record</div>
          <div style="font-size:19px;font-weight:700;">${player.wins ?? 0}–${player.losses ?? 0}</div>
        </div>
        <div style="flex:1 1 155px;background:rgba(255,255,255,0.09);border-radius:10px;padding:12px 14px;">
          <div style="font-size:11px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px;">Points</div>
          <div style="font-size:19px;font-weight:700;">${player.ladder_points ?? 0}</div>
        </div>
      </div>

      <div style="margin-top:14px;">
        <span style="display:inline-block;background:${statusBg};color:#fff;font-size:12px;font-weight:600;padding:4px 13px;border-radius:50px;">
          ${escapeHtml(statusText || "Active")}${statusEmoji}
        </span>
      </div>

      ${sigHTML}
    </div>

    <div style="text-align:center;font-size:12px;color:rgba(255,255,255,0.35);padding-top:14px;">
      restotennis.com
    </div>
  `;

  return el;
}

function buildMatchShareCard(data) {
  const { type, winner, loser, score, date,
          winnerTeam, t1Avg, t2Avg,
          winnerPts, loserPts, winnerRc, loserRc } = data;

  const wAvg = Number(t1Avg || 0);
  const lAvgVal = Number(t2Avg || 0);
  let upsetProb = null;
  let isUpset = false;
  if (wAvg && lAvgVal) {
    const winnerAvgN = winnerTeam === 1 ? wAvg : lAvgVal;
    const loserAvgN  = winnerTeam === 1 ? lAvgVal : wAvg;
    upsetProb = Math.round((1 / (1 + Math.pow(10, (loserAvgN - winnerAvgN) / 0.45))) * 100);
    isUpset = upsetProb < 40;
  }

  const upsetLine = (() => {
    if (!isUpset || upsetProb === null) return "";
    const first = (winner || "").split("/")[0].trim().split(" ")[0];
    const lines = [
      `${first} had a ${upsetProb}% chance. Didn't matter.`,
      `The odds said no. ${first} said yes.`,
      `${upsetProb}% — and ${first} took it anyway.`,
      `Nobody expected this. ${first} did.`,
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  })();

  const rcFmt = (v) => { const n = Number(v || 0); return (n >= 0 ? "+" : "") + n.toFixed(2); };
  const dateStr = date
    ? new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  const winnerTrunc = (winner || "—").length > 22 ? (winner || "—").slice(0, 21) + "…" : (winner || "—");
  const loserTrunc  = (loser  || "—").length > 26 ? (loser  || "—").slice(0, 25) + "…" : (loser  || "—");

  const el = document.createElement("div");
  el.style.cssText = `
    width:390px;height:${upsetLine ? 460 : 440}px;overflow:hidden;
    background:#1F4D3A;
    font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;
    color:#fff;box-sizing:border-box;
    padding:24px 24px 20px;
    display:flex;flex-direction:column;
    border-radius:16px;
  `;

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
      <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;">
        <span style="background:rgba(255,255,255,0.15);font-size:11px;font-weight:700;padding:3px 11px;border-radius:50px;text-transform:uppercase;letter-spacing:.07em;">
          ${escapeHtml((type || "Match").toUpperCase())}
        </span>
        ${isUpset ? `<span style="background:#d97706;font-size:11px;font-weight:700;padding:3px 11px;border-radius:50px;">⚡ Upset</span>` : ""}
      </div>
      <div style="font-size:11px;color:rgba(255,255,255,0.45);text-align:right;line-height:1.4;">🎾 Restoration<br>Tennis Ladder</div>
    </div>

    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-size:24px;font-weight:800;line-height:1.15;letter-spacing:-.3px;">${escapeHtml(winnerTrunc)}</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.45);margin:5px 0 6px;">def.</div>
      <div style="font-size:18px;font-weight:600;color:rgba(255,255,255,0.75);">${escapeHtml(loserTrunc)}</div>
      <div style="font-size:30px;font-weight:800;letter-spacing:-.5px;margin:14px 0 4px;">${escapeHtml(score || "")}</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.45);">${escapeHtml(dateStr)}</div>
    </div>

    <div style="height:1px;background:rgba(255,255,255,0.15);margin:14px 0;"></div>

    <div style="display:flex;gap:10px;margin-bottom:${upsetLine ? "10px" : "0"};">
      <div style="flex:1;background:rgba(255,255,255,0.09);border-radius:10px;padding:10px 12px;">
        <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:3px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${escapeHtml((winner || "Winner").split("/")[0].trim())}</div>
        <div style="font-size:17px;font-weight:700;">${winnerPts != null ? winnerPts + " pts" : "—"}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.5);">${rcFmt(winnerRc)} rating</div>
      </div>
      <div style="flex:1;background:rgba(255,255,255,0.06);border-radius:10px;padding:10px 12px;">
        <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:3px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${escapeHtml((loser || "Loser").split("/")[0].trim())}</div>
        <div style="font-size:17px;font-weight:700;">${loserPts != null ? loserPts + " pts" : "—"}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.5);">${rcFmt(loserRc)} rating</div>
      </div>
    </div>

    ${upsetLine ? `<div style="font-size:13px;color:rgba(255,255,255,0.6);font-style:italic;text-align:center;margin-bottom:10px;">"${escapeHtml(upsetLine)}"</div>` : ""}

    <div style="text-align:center;font-size:12px;color:rgba(255,255,255,0.35);margin-top:auto;">
      restotennis.com
    </div>
  `;

  return el;
}

async function sharePlayerProfile(playerId, player, btn) {
  if (btn) {
    btn.dataset.origLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Generating…";
  }

  try {
    const [allPlayersRes, playerMatches, recentMatches] = await Promise.all([
      supabaseClient.from("players").select("id, name, sex, ladder_points, dynamic_rating, wins").order("ladder_points", { ascending: false }),
      fetchMatchesForPlayer(playerId),
      fetchRecentMatchesForStatus(),
    ]);

    const allPlayers = allPlayersRes.data || [];
    const nameMap = {};
    allPlayers.forEach((p) => { nameMap[p.id] = p.name; });

    const genderLabel = player.sex === "Man" ? "Men's" : "Women's";
    const sameSex     = sortPlayersForStandings(allPlayers.filter((p) => p.sex === player.sex));
    const genderRank  = sameSex.findIndex((p) => String(p.id) === String(playerId)) + 1 || null;

    const status    = getPlayerStatus(playerId, recentMatches);
    const sigMatch  = findSignatureMatch(playerId, playerMatches, nameMap);

    const cardEl    = buildPlayerShareCard(player, genderRank, genderLabel, status, sigMatch);
    const shareText = `${player.name} is ranked #${genderRank || "?"} on the Restoration Tennis Ladder — restotennis.com`;
    await captureAndShare(cardEl, shareText, btn);
  } catch (err) {
    console.error("sharePlayerProfile error:", err);
    showShareToast("Something went wrong");
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.origLabel || "📲 Share Profile"; }
  }
}

async function shareMatchResult(matchData, btn) {
  const shareText = matchData.winner && matchData.loser
    ? `${matchData.winner} def. ${matchData.loser}${matchData.score ? " " + matchData.score : ""} — restotennis.com`
    : "restotennis.com";
  const shareUrl = `${location.origin}${location.pathname.replace(/[^/]*$/, "")}history.html`;

  if (btn) { btn.disabled = true; }

  try {
    if (navigator.share) {
      await navigator.share({ title: "Restoration Tennis Ladder", text: shareText, url: shareUrl });
    } else {
      await navigator.clipboard.writeText(shareText);
      showShareToast("Copied to clipboard!");
    }
  } catch (err) {
    if (err.name !== "AbortError") {
      try {
        await navigator.clipboard.writeText(shareText);
        showShareToast("Copied to clipboard!");
      } catch (_) {
        showShareToast("Could not share");
      }
    }
  } finally {
    if (btn) { btn.disabled = false; }
  }
}

const BIWEEKLY_CHECKPOINTS = [
  { label: 'Apr 17', date: '2026-04-17' },
  { label: 'May 01', date: '2026-05-01' },
  { label: 'May 15', date: '2026-05-15' },
  { label: 'May 29', date: '2026-05-29' },
  { label: 'Jun 12', date: '2026-06-12' },
  { label: 'Jun 26', date: '2026-06-26' },
  { label: 'Jul 10', date: '2026-07-10' },
  { label: 'Jul 24', date: '2026-07-24' },
  { label: 'Aug 07', date: '2026-08-07' },
  { label: 'Aug 21', date: '2026-08-21' },
  { label: 'Sep 04', date: '2026-09-04' },
  { label: 'Sep 18', date: '2026-09-18' },
  { label: 'Oct 02', date: '2026-10-02' },
  { label: 'Oct 16', date: '2026-10-16' },
  { label: 'Oct 30', date: '2026-10-30' },
];

// Returns the active checkpoint list ending exactly at today.
// If today is already a biweekly Friday it is used as-is; otherwise today
// is appended as a final point flagged isToday:true.
function buildActiveCheckpoints() {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const active = BIWEEKLY_CHECKPOINTS.filter(cp => cp.date <= today);
  const todayIsCheckpoint = BIWEEKLY_CHECKPOINTS.some(cp => cp.date === today);
  if (!todayIsCheckpoint) {
    const todayLabel = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    active.push({ label: todayLabel, date: today, isToday: true });
  }
  return active;
}

async function renderPlayerRatingTrend(playerId, currentDisplayRating, initialRating) {
  const section = document.getElementById("rating-trend-section");
  const canvas  = document.getElementById("rating-trend-canvas");
  if (!canvas || typeof Chart === "undefined") return;

  try {
    const matches = await fetchMatchesForPlayer(playerId);

    const perspectives = matches
      .filter((match) => match.match_type !== "mini" && match.match_type !== "retired")
      .map((match) => ({
        match,
        perspective: getPlayerMatchPerspective(match, playerId)
      }))
      .filter((item) => item.perspective && item.match.date_played);

    if (perspectives.length < 2) {
      if (section) section.style.display = "none";
      return;
    }

    // Walk forward from initial_rating applying each match's ratingChange
    const baseRating = roundToTwo(Number(initialRating ?? 0));
    let running = baseRating;
    const matchTimeline = [];
    for (const item of perspectives) {
      running = roundToTwo(running + Number(item.perspective.ratingChange || 0));
      matchTimeline.push({ date: item.match.date_played.slice(0, 10), rating: running });
    }

    const activeCheckpoints = buildActiveCheckpoints();
    const liveRating = roundToTwo(Number(currentDisplayRating ?? 0));

    const labels  = activeCheckpoints.map(cp => cp.label);
    const ratings = activeCheckpoints.map(cp => {
      if (cp.isToday) return liveRating;
      let val = baseRating;
      for (const entry of matchTimeline) {
        if (entry.date <= cp.date) val = entry.rating;
        else break;
      }
      return val;
    });

    const minVal = Math.min(...ratings);
    const maxVal = Math.max(...ratings);
    const yMin = Math.floor((minVal - 0.5) / 0.25) * 0.25;
    const yMax = Math.ceil((maxVal + 0.5) / 0.25) * 0.25;

    const isMobile = window.innerWidth < 640;

    const ctx = canvas.getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Rating",
          data: ratings,
          tension: 0,
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: "#1f4d3a",
          borderColor: "#1f4d3a",
          backgroundColor: "rgba(31, 77, 58, 0.08)",
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: () => '',
              label: (item) => `${item.label} — Rating: ${Number(item.raw).toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            ticks: {
              autoSkip: false,
              maxRotation: 0,
              minRotation: 0,
              callback: function(val, index) {
                if (!isMobile) return labels[index];
                const last = labels.length - 1;
                if (index === 0 || index === last) return labels[index];
                return index % 2 === 0 ? labels[index] : null;
              }
            }
          },
          y: {
            min: yMin,
            max: yMax,
            ticks: {
              stepSize: 0.25,
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

async function renderPointsRankingChart(playerId, playerSex) {
  const section = document.getElementById("points-rank-section");
  const canvas  = document.getElementById("points-rank-canvas");
  if (!section || !canvas || typeof Chart === "undefined") return;

  try {
    const pid = Number(playerId);

    const [playersRes, allMatchesRes] = await Promise.all([
      supabaseClient.from("players").select("id, sex"),
      supabaseClient.from("matches")
        .select(`id, date_played, created_at,
          team1_player1_id, team1_player2_id,
          team2_player1_id, team2_player2_id,
          ladder_points_p1, ladder_points_p2,
          ladder_points_p3, ladder_points_p4`)
        .order("date_played", { ascending: true })
        .order("created_at", { ascending: true })
    ]);

    const allPlayers = playersRes.data || [];
    const allMatches = (allMatchesRes.data || []).filter(m => m.date_played);

    const sameSexIds = new Set(
      allPlayers.filter(p => p.sex === playerSex).map(p => p.id)
    );

    // Hide if the player has fewer than 2 total matches
    const playerTotalMatches = allMatches.filter(m =>
      [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id].includes(pid)
    ).length;
    if (playerTotalMatches < 2) {
      section.style.display = "none";
      return;
    }

    const activeCheckpoints = buildActiveCheckpoints();

    const cumPoints = {};
    allPlayers.forEach(p => { cumPoints[p.id] = 0; });
    const hasPlayed = new Set();

    const labels       = activeCheckpoints.map(cp => cp.label);
    const pointsSeries = [];
    const rankSeries   = [];

    let matchIdx = 0;
    for (const cp of activeCheckpoints) {
      // Apply all matches on or before this checkpoint (cursor walk — O(M + C))
      while (matchIdx < allMatches.length && allMatches[matchIdx].date_played.slice(0, 10) <= cp.date) {
        const match = allMatches[matchIdx];
        const slots = [
          { id: match.team1_player1_id, pts: match.ladder_points_p1 },
          { id: match.team1_player2_id, pts: match.ladder_points_p2 },
          { id: match.team2_player1_id, pts: match.ladder_points_p3 },
          { id: match.team2_player2_id, pts: match.ladder_points_p4 },
        ];
        for (const { id, pts } of slots) {
          if (id != null) {
            hasPlayed.add(id);
            if (pts != null) cumPoints[id] = (cumPoints[id] ?? 0) + Number(pts);
          }
        }
        matchIdx++;
      }

      pointsSeries.push(cumPoints[pid] ?? 0);

      if (hasPlayed.has(pid)) {
        const myPts = cumPoints[pid] ?? 0;
        let rank = 1;
        for (const id of sameSexIds) {
          if (id !== pid && hasPlayed.has(id) && (cumPoints[id] ?? 0) > myPts) rank++;
        }
        rankSeries.push(rank);
      } else {
        rankSeries.push(null);
      }
    }

    const validRanks = rankSeries.filter(r => r != null);
    const maxRank = validRanks.length > 0 ? Math.max(...validRanks) : 5;

    const isMobile = window.innerWidth < 640;
    const xTickConfig = {
      autoSkip: false,
      maxRotation: 0,
      minRotation: 0,
      callback: function(val, index) {
        if (!isMobile) return labels[index];
        const last = labels.length - 1;
        if (index === 0 || index === last) return labels[index];
        return index % 2 === 0 ? labels[index] : null;
      }
    };

    const ctx = canvas.getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Points",
            data: pointsSeries,
            yAxisID: "yPoints",
            tension: 0,
            borderWidth: 2.5,
            pointRadius: 4,
            pointBackgroundColor: "#1f4d3a",
            borderColor: "#1f4d3a",
            backgroundColor: "rgba(31, 77, 58, 0.08)",
            fill: true,
          },
          {
            label: "Rank",
            data: rankSeries,
            yAxisID: "yRank",
            tension: 0,
            borderWidth: 2,
            borderDash: [5, 4],
            pointRadius: 4,
            pointBackgroundColor: "#1f3558",
            borderColor: "#1f3558",
            backgroundColor: "transparent",
            fill: false,
            spanGaps: false,
          }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: { boxWidth: 12, font: { size: 12 } }
          },
          tooltip: {
            filter: (item) => item.datasetIndex === 0,
            callbacks: {
              title: () => '',
              label: (ctx) => {
                const label = labels[ctx.dataIndex];
                const pts   = pointsSeries[ctx.dataIndex];
                const rank  = rankSeries[ctx.dataIndex];
                return rank != null
                  ? `${label} — ${pts} pts · Ranked #${rank}`
                  : `${label} — ${pts} pts · Unranked`;
              }
            }
          }
        },
        scales: {
          x: { ticks: xTickConfig },
          yPoints: {
            type: "linear",
            position: "left",
            min: 0,
            ticks: {
              color: "#1f4d3a",
              callback: (v) => v + " pts"
            },
            grid: { color: "rgba(0,0,0,0.06)" }
          },
          yRank: {
            type: "linear",
            position: "right",
            reverse: true,
            min: 1,
            max: maxRank + 1,
            ticks: {
              color: "#1f3558",
              stepSize: 1,
              callback: (v) => Number.isInteger(v) ? `#${v}` : ""
            },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  } catch (err) {
    console.error("Points rank chart error:", err);
    if (section) section.style.display = "none";
  }
}

/* =========================
   MY LADDER — PERSONALIZATION
========================= */

const ML_ID_KEY   = "rml_player_id";
const ML_NAME_KEY = "rml_player_name";

function getMyLadderPlayer() {
  const id   = localStorage.getItem(ML_ID_KEY);
  const name = localStorage.getItem(ML_NAME_KEY);
  if (!id) return null;
  return { id: Number(id), name: name || "" };
}

// Inject the "My Ladder" button into the desktop nav and mobile menu.
// Called on every page load — updates the label if a player is already set.
function initMyLadderNav() {
  const me    = getMyLadderPlayer();
  const label = me ? `👤 ${me.name.split(" ")[0]}` : "👤 My Ladder";

  const nav = document.querySelector("nav");
  if (nav) {
    let btn = nav.querySelector(".my-ladder-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.className = "my-ladder-btn";
      btn.addEventListener("click", openMyLadderModal);
      nav.appendChild(btn);
    }
    btn.textContent = label;
  }

  const mobileMenu = document.querySelector(".mobile-nav-menu");
  if (mobileMenu) {
    let btn = mobileMenu.querySelector(".my-ladder-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.className = "my-ladder-btn my-ladder-mobile";
      btn.addEventListener("click", openMyLadderModal);
      mobileMenu.insertBefore(btn, mobileMenu.firstChild);
    }
    btn.textContent = label;
  }
}

async function openMyLadderModal() {
  document.getElementById("my-ladder-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "my-ladder-overlay";
  overlay.className = "myl-overlay";
  overlay.innerHTML = `
    <div class="myl-modal" role="dialog" aria-modal="true" aria-label="Choose your player">
      <div class="myl-header">
        <div>
          <h2 class="myl-title">Who are you?</h2>
          <p class="myl-subtitle">Select your name to personalize your ladder experience</p>
        </div>
        <button class="myl-close" id="myl-close" aria-label="Close">✕</button>
      </div>
      <div class="myl-body">
        <input type="text" class="myl-search" id="myl-search" placeholder="Search by name…" autocomplete="off">
        <div class="myl-list" id="myl-list"><p class="myl-empty">Loading players…</p></div>
        <div class="myl-footer">
          Not on the ladder yet? <a href="join.html">Join here →</a>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#myl-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  const { data: players } = await supabaseClient
    .from("players")
    .select("id, name, display_rating, area");

  const sorted = (players || []).sort((a, b) =>
    (a.name || "").localeCompare(b.name || "")
  );

  function renderPlayerList(query = "") {
    const list = document.getElementById("myl-list");
    if (!list) return;
    const q = query.toLowerCase();
    const visible = q ? sorted.filter((p) => (p.name || "").toLowerCase().includes(q)) : sorted;
    if (!visible.length) {
      list.innerHTML = `<p class="myl-empty">No players found.</p>`;
      return;
    }
    list.innerHTML = visible.map((p) => `
      <button class="myl-player-btn" data-id="${p.id}" data-name="${escapeHtml(p.name || "")}">
        <span class="myl-player-name">${escapeHtml(p.name || "—")}</span>
        <span class="myl-player-meta">${formatDisplayRating(p.display_rating)} · ${escapeHtml(p.area || "—")}</span>
      </button>
    `).join("");

    list.querySelectorAll(".myl-player-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        localStorage.setItem(ML_ID_KEY, btn.dataset.id);
        localStorage.setItem(ML_NAME_KEY, btn.dataset.name);
        overlay.remove();
        initMyLadderNav();
        applyMyLadderPersonalization();
      });
    });
  }

  renderPlayerList();
  const searchEl = document.getElementById("myl-search");
  searchEl?.addEventListener("input", (e) => renderPlayerList(e.target.value));
  searchEl?.focus();
}

// Runs personalization that responds to a player selection mid-session.
async function applyMyLadderPersonalization() {
  if (document.getElementById("activity-feed")) await loadMyLadderCard();
  if (getLadderBodyEl()) await loadLadder();
  if (document.getElementById("history-list")) {
    addMyMatchesChip();
    await loadMatchHistory();
  }
}

// ── Homepage personalized card ──────────────────────────────────────────────

async function loadMyLadderCard() {
  const me = getMyLadderPlayer();
  const homeStats = document.getElementById("home-stats");
  if (!homeStats) return;

  document.getElementById("my-ladder-card")?.remove();
  if (!me) return;

  const [meRes, allRes] = await Promise.all([
    supabaseClient.from("players")
      .select("id, name, sex, dynamic_rating, display_rating, ladder_points, wins, losses, matches_played, area")
      .eq("id", me.id)
      .maybeSingle(),
    supabaseClient.from("players")
      .select("id, name, sex, dynamic_rating, display_rating, ladder_points, wins, losses, area")
  ]);

  if (meRes.error || !meRes.data) {
    localStorage.removeItem(ML_ID_KEY);
    localStorage.removeItem(ML_NAME_KEY);
    initMyLadderNav();
    return;
  }

  const myPlayer = meRes.data;
  const allPlayers = allRes.data || [];
  const myRating = Number(myPlayer.dynamic_rating ?? myPlayer.display_rating ?? 0);

  // Overall rank
  const sortedAll = sortPlayersForStandings(allPlayers);
  const overallRank = sortedAll.findIndex((p) => p.id === myPlayer.id) + 1;

  // Gender rank
  const genderPlayers = allPlayers.filter((p) => p.sex === myPlayer.sex);
  const sortedGender = sortPlayersForStandings(genderPlayers);
  const genderRank = sortedGender.findIndex((p) => p.id === myPlayer.id) + 1;
  const genderLabel = myPlayer.sex === "Man" ? "Men's" : "Women's";

  // Same-gender opponents sorted by closeness to my rating
  const sameGender = allPlayers
    .filter((p) => p.id !== myPlayer.id && p.sex === myPlayer.sex)
    .map((p) => ({ ...p, diff: Math.abs(Number(p.dynamic_rating ?? 0) - myRating) }))
    .sort((a, b) => a.diff - b.diff);

  // Up to 2 near-level opponents (within 0.3, or 2 closest if not enough)
  const close = sameGender.filter((p) => p.diff <= 0.3);
  const suggestions = close.length >= 2 ? close.slice(0, 2) : sameGender.slice(0, 2);

  // Stretch opponent: closest same-gender player rated 0.5+ above me
  const stretch = sameGender
    .filter((p) => Number(p.dynamic_rating ?? 0) - myRating >= 0.5)
    .sort((a, b) => Number(a.dynamic_rating ?? 0) - Number(b.dynamic_rating ?? 0))[0] ?? null;

  // Same-gender matches: gender adjustment cancels out, use raw ratings
  function suggestionWinPct(opp) {
    return Math.round((1 / (1 + Math.pow(10, (Number(opp.dynamic_rating ?? 0) - myRating) / 0.45))) * 100);
  }

  const card = document.createElement("div");
  card.id = "my-ladder-card";
  card.className = "my-ladder-card";
  card.innerHTML = `
    <div class="my-ladder-card-header">
      <h3>👤 ${escapeHtml(myPlayer.name)}</h3>
      <a href="player.html?id=${myPlayer.id}" class="my-profile-link-header">View Profile →</a>
    </div>
    <div class="my-ladder-card-body">
      <div class="my-ladder-stats">
        <div class="my-stat-row"><span class="my-stat-label">Overall Rank</span><span class="my-stat-value">#${overallRank || "—"}</span></div>
        <div class="my-stat-row"><span class="my-stat-label">${genderLabel} Rank</span><span class="my-stat-value">#${genderRank || "—"}</span></div>
        <div class="my-stat-row"><span class="my-stat-label">Record</span><span class="my-stat-value">${myPlayer.wins ?? 0}W – ${myPlayer.losses ?? 0}L</span></div>
        <div class="my-stat-row"><span class="my-stat-label">Ladder Points</span><span class="my-stat-value">${myPlayer.ladder_points ?? 0}</span></div>
        <div class="my-stat-row"><span class="my-stat-label">Rating</span><span class="my-stat-value">${formatDisplayRating(myPlayer.dynamic_rating)}</span></div>
      </div>
      <div class="my-ladder-opponents">
        <p class="my-opponents-label">Players Near Your Level</p>
        ${suggestions.length ? suggestions.map((opp) => `
          <div class="my-opponent-row">
            <a href="player.html?id=${opp.id}" class="my-opponent-name">${escapeHtml(opp.name)}</a>
            <span class="my-opponent-meta">${formatDisplayRating(opp.dynamic_rating)} · ${escapeHtml(opp.area || "—")}<br>${suggestionWinPct(opp)}% chance to win</span>
          </div>
        `).join("") : `<p class="myl-empty">No same-gender players found yet.</p>`}
        ${stretch ? `
          <p class="my-opponents-label my-stretch-label">Stretch Challenge 💪</p>
          <div class="my-opponent-row">
            <a href="player.html?id=${stretch.id}" class="my-opponent-name">${escapeHtml(stretch.name)}</a>
            <span class="my-opponent-meta">${formatDisplayRating(stretch.dynamic_rating)} · ${escapeHtml(stretch.area || "—")}<br>${suggestionWinPct(stretch)}% chance to win</span>
          </div>
        ` : ""}
      </div>
    </div>
  `;

  homeStats.parentNode.insertBefore(card, homeStats);
}

// ── My Matches filter chip on history page ─────────────────────────────────

function addMyMatchesChip() {
  const me = getMyLadderPlayer();
  const filters = document.querySelector(".history-filters");
  if (!filters) return;

  const existing = document.getElementById("my-matches-chip");
  if (!me) {
    existing?.remove();
    state.history.myMatchesOnly = false;
    return;
  }
  if (existing) return;

  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "filter-chip my-matches-chip";
  chip.id = "my-matches-chip";
  chip.textContent = "My Matches";
  chip.addEventListener("click", () => {
    state.history.myMatchesOnly = !state.history.myMatchesOnly;
    loadMatchHistory();
  });
  filters.appendChild(chip);
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
          if (document.getElementById("player-doubles-section")) await loadDoublesPartners();
        }
      )
      .subscribe();
  } catch (error) {
    console.error("Realtime setup error:", error);
  }
}