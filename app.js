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
      setupStickyScrollbar(document.querySelector(".ladder-table")?.closest(".table-wrap"), "top");
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

    const bySOS = compareValues(a.sos ?? 0, b.sos ?? 0, "desc");
    if (bySOS !== 0) return bySOS;

    return compareValues(a.name || "", b.name || "", "asc");
  });
}

// Adds a thin duplicate scrollbar just below a table-wrap so users can
// scroll horizontally without travelling to the bottom of a tall table.
// Call once per table-wrap; safe to call multiple times (guarded).
// position = "top"    → inserts mirror ABOVE table-wrap, sticky below the site header
// position = "bottom" → inserts mirror BELOW table-wrap (default, used for Directory)
function setupStickyScrollbar(tableWrap, position = "bottom") {
  if (!tableWrap) return;

  // Guard: prevent double-initialisation
  if (position === "top") {
    if (tableWrap.previousElementSibling?.classList.contains("scroll-mirror-top")) return;
  } else {
    if (tableWrap.nextElementSibling?.classList.contains("scroll-mirror-wrap")) return;
  }

  const mirror = document.createElement("div");
  mirror.className = position === "top"
    ? "scroll-mirror-wrap scroll-mirror-top"
    : "scroll-mirror-wrap";
  const inner = document.createElement("div");
  inner.className = "scroll-mirror-inner";
  mirror.appendChild(inner);

  if (position === "top") {
    // Offset sticky top by the actual header height so the mirror sits flush below it
    const header = document.querySelector(".site-header");
    mirror.style.top = (header ? header.offsetHeight : 0) + "px";
    tableWrap.parentNode.insertBefore(mirror, tableWrap);
  } else {
    tableWrap.parentNode.insertBefore(mirror, tableWrap.nextSibling);
  }

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

  if (window.IntersectionObserver) {
    new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) syncWidth();
      else mirror.style.display = "none";
    }, { threshold: 0.01 }).observe(tableWrap);
  }
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
  return state.ladder.showMoreStats ? 13 : 9;
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
      previous_rank
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
      </tr>
    `;
  }).join("");

  if (mePlayer) {
    requestAnimationFrame(() => {
      const meRow = ladderBody.querySelector(".rank-me");
      if (meRow) meRow.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
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

    // Determine tennis condition message and accent color
    let message, accent;
    if (code <= 1) {
      if (wind < 15)      { message = "⛅ Good conditions for tennis today";            accent = "green"; }
      else if (wind <= 25){ message = "🌬️ Windy but playable — factor in the wind";     accent = "amber"; }
      else                { message = "💨 Very windy — tough conditions today";          accent = "amber"; }
    } else if (code <= 3) { message = "☁️ Overcast — playable, bring layers";            accent = "amber"; }
    else if (code <= 48)  { message = "🌫️ Foggy — check conditions before heading out"; accent = "amber"; }
    else if (code <= 67)  { message = "🌧️ Rain today — courts likely wet";              accent = "red";   }
    else if (code <= 77)  { message = "❄️ Snow — courts closed";                        accent = "red";   }
    else if (code <= 82)  { message = "🌦️ Showers expected — check before you go";     accent = "red";   }
    else                  { message = "⛈️ Thunderstorms — do not play";                 accent = "red";   }

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

      const winnerLinks = winnerIds.filter(Boolean)
        .map(id => `<a href="player.html?id=${id}" class="player-link">${escapeHtml(abbreviateName(playerMap[id]))}</a>`)
        .join(" &amp; ");
      const loserLinks = loserIds.filter(Boolean)
        .map(id => `<a href="player.html?id=${id}" class="player-link">${escapeHtml(abbreviateName(playerMap[id]))}</a>`)
        .join(" &amp; ");
      const timeAgo = relativeTime(match.date_played || match.created_at);
      const score = match.score_text ? ` · ${escapeHtml(winnerFirstScore(match.score_text, match.winner_team))}` : "";
      const type  = match.match_type || "Match";

      return `<li class="activity-feed-item${i === 0 ? " activity-new" : ""}">
        <strong>${winnerLinks}</strong> defeated <strong>${loserLinks}</strong>${score} · ${escapeHtml(type)} · ${escapeHtml(timeAgo)}
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
   SEASON STORY SO FAR
========================= */

async function loadSeasonStory() {
  const container = document.getElementById("season-story");
  if (!container) return;

  try {
    const [playersRes, matchesRes] = await Promise.all([
      supabaseClient.from("players").select(
        "id, name, sex, dynamic_rating, initial_rating, ladder_points, wins, losses, matches_played"
      ),
      supabaseClient.from("matches").select(
        "id, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, team1_avg_rating, team2_avg_rating, winner_team, date_played"
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

    const totalMatches   = matches.length;
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

    // Biggest upset: match where winner had lowest pre-match win probability
    let biggestUpsetMatch   = null;
    let biggestUpsetWinner  = "";
    let biggestUpsetLoser   = "";
    let biggestUpsetProb    = 1;

    for (const match of matches) {
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

    // Build narrative
    const matchWord = totalMatches === 1 ? "match" : "matches";
    const upsetPct  = Math.round(biggestUpsetProb * 100);

    let parts = [];

    // Opener + overall leader
    const gapPhrase = (overallSecond && pointsGap > 0)
      ? `, just ${pointsGap} point${pointsGap === 1 ? "" : "s"} ahead of ${escapeHtml(overallSecond.name)}`
      : "";
    if (overallLeader) {
      parts.push(`${totalMatches} ${matchWord} into the 2026 season and ${escapeHtml(overallLeader.name)} leads the overall standings with ${overallLeader.ladder_points ?? 0} points${gapPhrase}.`);
    } else {
      parts.push(`${totalMatches} ${matchWord} into the 2026 season and the race is wide open.`);
    }

    // Men's and Women's leaders
    if (mensLeader && womensLeader && mensLeader.id !== womensLeader.id) {
      parts.push(`${escapeHtml(mensLeader.name)} sits atop the Men's ladder while ${escapeHtml(womensLeader.name)} leads the Women's side.`);
    } else if (mensLeader) {
      parts.push(`${escapeHtml(mensLeader.name)} holds down the top spot on the Men's ladder.`);
    } else if (womensLeader) {
      parts.push(`${escapeHtml(womensLeader.name)} leads the Women's ladder.`);
    }

    // Biggest upset
    if (biggestUpsetMatch && biggestUpsetWinner) {
      if (upsetPct <= 35) {
        parts.push(`The biggest shock so far: ${escapeHtml(biggestUpsetWinner)} came in with just a ${upsetPct}% chance of winning and pulled it off against ${escapeHtml(biggestUpsetLoser)} — the kind of result that keeps everyone on their toes.`);
      } else {
        parts.push(`${escapeHtml(biggestUpsetWinner)}'s win over ${escapeHtml(biggestUpsetLoser)} stands as the most surprising result of the season.`);
      }
    }

    // Most improved
    if (mostImproved && mostImprovedGain > 0) {
      parts.push(`${escapeHtml(mostImproved.name)} has been the most improved player, up ${mostImprovedGain} rating points from their starting mark.`);
    }

    // Highest SOS
    if (topSOSPlayer && topSOSValue > 0) {
      parts.push(`${escapeHtml(topSOSPlayer.name)} has drawn the toughest competition this season, facing opponents rated ${topSOSValue} on average — a sign they're playing up.`);
    }

    // Inactive players
    if (inactivePlayers > 0) {
      parts.push(`${inactivePlayers} of our ${totalPlayers} player${totalPlayers === 1 ? "" : "s"} ${inactivePlayers === 1 ? "is" : "are"} still looking for their first match — every week someone new steps on court, the ladder gets a little more interesting.`);
    }

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
    const statText = isUpset ? "" : `${mostGamesTotal} total games played`;

    const playerMap = await fetchPlayerNamesForMatches([featured]);
    const dateStr = featured.date_played
      ? new Date(featured.date_played).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "";

    // Build linked team names for winner and loser
    const linkedTeam = (ids) => ids.filter(Boolean)
      .map(id => `<a href="player.html?id=${id}" class="player-link">${escapeHtml(playerMap[id] || "?")}</a>`)
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
            <button class="btn-share-match" id="confirm-share-btn">⬆ Share Result</button>
          </div>
        </div>
      `;

      document.getElementById("confirm-share-btn")?.addEventListener("click", () => {
        showMatchCardModal(confirmMatchData);
      });

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

  // Enforce minimum 3-point gap between winner and loser.
  loserPoints = Math.min(loserPoints, winnerPoints - 3);
  loserPoints = Math.max(5, loserPoints);
  if (winnerPoints - loserPoints < 3) winnerPoints = loserPoints + 3;

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
    // Re-enforce 3-point minimum spread after bonuses
    if (winnerPoints - loserPoints < 3) winnerPoints = loserPoints + 3;
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


// selfId: when viewing a player profile, pass their ID so their own name renders as plain text.
function renderMatchExtras(match, playerMap, sexMap = {}, selfId = null) {
  const rows = [];
  const isDoubles = match.match_type === "Doubles";
  const isMixed = matchIsMixedGender(match, sexMap);
  const t1Display = unadjustedTeamRating(match.team1_avg_rating, [match.team1_player1_id, match.team1_player2_id], sexMap, isMixed);
  const t2Display = unadjustedTeamRating(match.team2_avg_rating, [match.team2_player1_id, match.team2_player2_id], sexMap, isMixed);

  function addRow(playerId, ratingChange, ladderPoints, ratingAtMatch) {
    if (!playerId) return;
    const ratingLine = ratingAtMatch != null
      ? `<span class="match-extra-rating">${isDoubles
          ? `Team rating: ${Number(ratingAtMatch).toFixed(2)} (avg)`
          : `Rating at match: ${Number(ratingAtMatch).toFixed(2)}`
        }</span>`
      : "";
    const escapedName = escapeHtml(playerMap[playerId] || "Player");
    const isSelf = selfId && Number(playerId) === Number(selfId);
    const nameHtml = isSelf
      ? escapedName
      : `<a href="player.html?id=${playerId}" class="player-link">${escapedName}</a>`;
    rows.push(`
      <div class="match-extra-row">
        <span class="match-extra-name">${nameHtml}${ratingLine}</span>
        <span class="match-extra-stat">Rating: ${escapeHtml(formatSignedNumber(ratingChange))}</span>
        <span class="match-extra-stat">Points: ${escapeHtml(String(ladderPoints ?? "—"))}</span>
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
// Favorite (higher probability) always appears on the left.
function buildOddsLine(match, display) {
  const t1avg = Number(match.team1_avg_rating);
  const t2avg = Number(match.team2_avg_rating);
  if (!match.team1_avg_rating || !match.team2_avg_rating) return "";

  const prob1 = 1 / (1 + Math.pow(10, (t2avg - t1avg) / 0.45));
  const prob2 = 1 - prob1;
  const pct1 = Math.round(prob1 * 100);
  const pct2 = 100 - pct1;

  const [favName, favPct, undName, undPct] = pct1 >= pct2
    ? [display.team1Text, pct1, display.team2Text, pct2]
    : [display.team2Text, pct2, display.team1Text, pct1];

  return `<div class="history-meta">Odds: ${escapeHtml(favName)} ${favPct}% · ${escapeHtml(undName)} ${undPct}%</div>`;
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


async function loadMatchHistory() { 
  const container = document.getElementById("history-list");
  if (!container) return;

  container.innerHTML = "<p>Loading match history...</p>";
  setActiveFilterButton(".history-filters", state.history.filterType);
  const myChip = document.getElementById("my-matches-chip");
  if (myChip) myChip.classList.toggle("active", !!state.history.myMatchesOnly);

  try {
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
          return display.playersText.toLowerCase().includes(playerFilterValue);
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

      const upset = isMatchUpset(match);

      return `
        <div class="history-item fade-in-card premium-match-card${upset ? " upset-match" : ""}">
          <div class="history-top-row">
            <div class="history-title-group">
              <h3>${escapeHtml(match.match_type || "Match")}</h3>
              ${upset ? '<span class="match-badge upset-badge">⚡ Upset</span>' : ""}
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

          <div>
            <button class="btn-share-match history-share-btn" data-match="${escapeHtml(cardData)}">⬆ Share</button>
          </div>
        </div>
      `;
    }).join("");

    // Set up share-button delegation once (guard prevents duplicate listeners)
    if (!container.dataset.shareListenerAttached) {
      container.dataset.shareListenerAttached = "1";
      container.addEventListener("click", (e) => {
        const btn = e.target.closest(".history-share-btn");
        if (!btn) return;
        try {
          const matchData = JSON.parse(btn.getAttribute("data-match") || "{}");
          shareMatchResult(matchData, btn);
        } catch (_) {}
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
      ladder_points_p4,
      team1_avg_rating,
      team2_avg_rating,
      set1_team1_games,
      set1_team2_games,
      set2_team1_games,
      set2_team2_games,
      match_notes
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
      </div>

      <div class="profile-actions">
        <a href="report.html?opponentId=${player.id}" class="button">Report a Match Against ${escapeHtml(player.name || "Player")}</a>
      </div>

      <button class="btn-share-mobile" id="share-profile-image-btn">📲 Share Profile</button>
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
  const rank   = rankMap[player.id] ? `Rank #${rankMap[player.id]}` : "Unranked";
  const rating = Number(player.dynamic_rating || player.display_rating || 0).toFixed(2);
  const pts    = player.ladder_points ?? 0;
  return `<option value="${player.id}">${escapeHtml(player.name)} — ${rank} — Rating ${rating} — ${pts} pts</option>`;
}

function mpFillSelect(sel, players) {
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = players.map(p => mpPlayerOption(p, mpState.rankMap)).join("");
  if (prev && players.some(p => String(p.id) === prev)) sel.value = prev;
}

function mpFillSinglesDropdown() {
  const pid = mpState.playerId;
  const opp1 = document.getElementById("mp-opp1");
  mpFillSelect(opp1, mpState.genderPlayers.filter(p => p.id !== pid));
}

function mpFillDoublesDropdowns() {
  const pid      = mpState.playerId;
  const partner  = document.getElementById("mp-partner");
  const dopp1    = document.getElementById("mp-dopp1");
  const dopp2    = document.getElementById("mp-dopp2");

  const partnerId = partner ? Number(partner.value) || null : null;
  const dopp1Id   = dopp1   ? Number(dopp1.value)   || null : null;

  mpFillSelect(partner, mpState.genderPlayers.filter(p => p.id !== pid));

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

function renderGauntletStep({ stepNum, label, player, winProbPct, lowPts, highPts, isChaser }) {
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
          <a class="gauntlet-name player-link" href="player.html?id=${player.id}">${escapeHtml(player.name || "")}</a>
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
          isChaser: true
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
      <p class="small-text gauntlet-subtitle">You're ${pointsGap} point${pointsGap === 1 ? "" : "s"} behind ${escapeHtml(leader.name)}. Here's your path.</p>
      ${showUpsetNote ? `<p class="gauntlet-upset-warning">These won't be easy — but every upset starts somewhere.</p>` : ""}
      <div class="gauntlet-list">`;

    topPicks.forEach((c, i) => {
      html += renderGauntletStep({
        stepNum:    i + 1,
        label:      stepLabels[i] || "The stretch",
        player:     c.opp,
        winProbPct: c.probPct,
        lowPts:     c.lowPts,
        highPts:    c.highPts,
        isChaser:   false
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
      const perspective = getPlayerMatchPerspective(match, playerId, sexMap);
      const resultClass = perspective?.won ? "win" : "loss";
      const resultText = perspective?.won ? "Win" : "Loss";
      const upset = isMatchUpset(match);

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

      return `
        <div class="history-item fade-in-card premium-match-card${upset ? " upset-match" : ""}">
          <div class="history-top-row">
            <div class="history-title-group">
              <h3>${escapeHtml(match.match_type || "Match")}</h3>
              ${upset ? '<span class="match-badge upset-badge">⚡ Upset</span>' : ""}
            </div>
            <span class="winner-pill ${resultClass}">${resultText}</span>
          </div>

          <div class="history-meta">
            <strong>Date:</strong> ${escapeHtml(safeDateText(match.date_played))}
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

          ${renderMatchExtras(match, playerMap, sexMap, playerId)}

          <div>
            <button class="btn-share-match history-share-btn" data-match="${escapeHtml(playerMatchCardData)}">⬆ Share</button>
          </div>
        </div>
      `;
    }).join("");

    if (!container.dataset.shareListenerAttached) {
      container.dataset.shareListenerAttached = "1";
      container.addEventListener("click", (e) => {
        const btn = e.target.closest(".history-share-btn");
        if (!btn) return;
        try {
          const matchData = JSON.parse(btn.getAttribute("data-match") || "{}");
          shareMatchResult(matchData, btn);
        } catch (_) {}
      });
    }
  } catch (error) {
    console.error("Load player history error:", error);
    container.innerHTML = "<p>Error loading player history.</p>";
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
  if (btn) {
    btn.dataset.origLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Generating…";
  }

  try {
    const cardEl    = buildMatchShareCard(matchData);
    const shareText = `${matchData.winner} def. ${matchData.loser} ${matchData.score} — restotennis.com`;
    await captureAndShare(cardEl, shareText, btn);
  } catch (err) {
    console.error("shareMatchResult error:", err);
    showShareToast("Something went wrong");
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.origLabel || "⬆ Share"; }
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

async function renderPlayerRatingTrend(playerId, currentDisplayRating, initialRating) {
  const section = document.getElementById("rating-trend-section");
  const canvas  = document.getElementById("rating-trend-canvas");
  if (!canvas || typeof Chart === "undefined") return;

  try {
    const matches = await fetchMatchesForPlayer(playerId);

    const perspectives = matches
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

    const today = new Date().toISOString().split('T')[0];
    const activeCheckpoints = BIWEEKLY_CHECKPOINTS.filter(cp => cp.date <= today);

    const labels  = activeCheckpoints.map(cp => cp.label);
    const ratings = activeCheckpoints.map(cp => {
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
                if (isMobile && index % 2 !== 0) return null;
                return labels[index];
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

    const today = new Date().toISOString().split('T')[0];
    const activeCheckpoints = BIWEEKLY_CHECKPOINTS.filter(cp => cp.date <= today);

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
        if (isMobile && index % 2 !== 0) return null;
        return labels[index];
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

  const photoSection = document.getElementById("community-photo");
  homeStats.parentNode.insertBefore(card, photoSection || homeStats);
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
        }
      )
      .subscribe();
  } catch (error) {
    console.error("Realtime setup error:", error);
  }
}