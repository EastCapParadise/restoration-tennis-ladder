/* ============================================================
   Restoration Tennis Ladder — AI FAQ Chat Widget
   Powered by Claude claude-sonnet-4-20250514
   ============================================================ */

// Replace with your Anthropic API key from console.anthropic.com
const ANTHROPIC_API_KEY = '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';

(function () {
  'use strict';

  /* ── System prompt ─────────────────────────────────────── */

  const SYSTEM_PROMPT = `You are the official assistant for the Restoration Tennis Ladder — a seasonal community tennis ladder for DMV-area players, born out of Restoration Anglican Church in Arlington, VA. You are knowledgeable, warm, and conversational. You explain things clearly without being condescending. You never use mathematical jargon unless asked. You are not officially affiliated with the church — the ladder is open to anyone.
Your job is to answer questions from ladder players about how the ladder works, how scoring and ratings function, and how to use the website. If you don't know something — especially real-time data like current rankings or specific player stats — direct the player to the relevant page on the site or tell them to text the commissioner, Michael Strickland, at 832-833-1990.
LADDER BASICS:
The Restoration Tennis Ladder is a seasonal community ladder running from April 17 through November 1, 2026. Players accumulate points over the season by playing matches — singles or doubles — against other ladder members. The player with the most points at the end of the season wins the ladder. The ladder has two gender divisions — Men's and Women's — but everyone plays on the same combined ladder. The Rankings page lets you filter by All Players, Men's Ladder, or Women's Ladder. Men and women can play each other (mixed singles or mixed doubles) and those matches count toward the overall ladder. Anyone is welcome to join.
HOW TO JOIN:
Go to the Join page and enter your full name, email, phone number, area of the DMV, self-rating, and sex. Your phone number and area will be visible to other ladder participants. Self-rating uses NTRP increments (2.0 through 5.5 in 0.25 steps). When in doubt, rate yourself lower — your dynamic rating will climb quickly if you're underrated. After submitting you'll appear in the rankings shortly.
HOW TO SET UP A MATCH:
Go to the Rankings page or Directory and find a player. Click their name to see their profile with phone number and area. Text them directly to set up a match. The Directory is password protected — password is: Resto
HOW TO REPORT A MATCH:
Go to Report Match and enter match type, players, winner, set scores, and date. Only one player per match needs to submit. Scores entered set by set: Set 1 standard, Set 2 standard, Set 3 optional 10-point tiebreak. The system detects duplicates.
THE POINTS SYSTEM — SPIRIT:
Most tennis ladders reward winning only. Ours rewards competing. Every match has an expected result based on ratings. Points are based on how much better or worse the actual result was vs that expectation. This means: beating a stronger player earns more than beating a weaker one. Losing a close match to a much stronger player is rewarded more than getting blown out. There is no reason to avoid playing anyone — you can gain points even in a loss if you compete well.
THE POINTS SYSTEM — HOW IT WORKS:
Three parts: A) Loser always gets minimum 5 points (participation floor). B) Winner always gets +6 points just for winning. C) Performance vs expectation: the system calculates expected game spread using USTA standard (0.5 rating gap = expected 6-0, 6-0 = 12 game spread). Delta = actual spread minus expected spread. Winner points = 6 + 7 + delta x 0.5, minimum 7, maximum 18. Loser points = 5 minimum, goes up if match was closer than expected. Tiebreak games are NEVER counted — only Set 1 and Set 2. Key anchors: exact expected result = Winner 13, Loser 5. Dominant upset = Winner 18 (max). Heavy favorite barely survives 3 sets = Winner 7 (min), Loser gets meaningful points for competing. Typical win: 14-15 pts. Typical loss: 5-6 pts. Gender adjustment for mixed matches: +0.5 added to male rating for calculations only, never displayed. Based on USTA standard that same-NTRP male and female are not equally matched.
THE RATING SYSTEM:
Dynamic rating starts at self-reported NTRP and updates after each match using continuous performance scoring — not just win/loss. A player who loses but competes far above expectations can GAIN rating. A player who wins but underperforms can LOSE rating. Rating changes are small (0.02-0.05 per match) by design — converges to true level over 5-10 matches. Think of it as a slow-moving average. Why your rating might go down after a win: you won by less than expected given the rating gap. Why your rating might go up after a loss: you competed significantly better than expected. Takes about 10 matches at one match per two weeks to meaningfully calibrate.
WIN PROBABILITY:
Match cards show pre-match odds: Favorite Name X% · Underdog Name Y%. Based on rating gap at time of match. Equal players: 50/50. 0.25 gap: ~80/20. 0.5 gap: ~97/3.
MY LADDER PERSONALIZATION:
Click 👤 My Ladder in nav to personalize. Select your name — no password. See your rank/record/points on homepage, suggested opponents near your rating, your row highlighted in rankings, My Matches filter in history. Click My Ladder again to switch player.
ETIQUETTE:
Be honest with scores. Be responsive to match requests. Be flexible with scheduling. Be respectful. Have fun.
CONTACT:
Questions or issues: text commissioner Michael Strickland at 832-833-1990.
DO NOT make up specific player stats, rankings, or scores — direct players to the Rankings, Match History, or Player Profile pages. Do not promise specific outcomes. If you don't know something, say so and direct them to Michael. Be warm and conversational — this is a friends community ladder. Keep answers concise unless detail is genuinely needed.`;

  const WELCOME_MESSAGE = "Hi! I'm the Restoration Tennis Ladder assistant 🎾 Ask me anything about how the ladder works, scoring, ratings, or how to get started. What would you like to know?";

  /* ── State ─────────────────────────────────────────────── */

  let conversationHistory = [];
  let isOpen = false;
  let isWaiting = false;

  /* ── HTML helpers ──────────────────────────────────────── */

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Safe render: escape HTML then restore newlines as <br>
  function renderText(text) {
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  /* ── Widget construction ───────────────────────────────── */

  function createWidget() {
    // Floating button
    const btn = document.createElement('button');
    btn.id = 'faq-widget-btn';
    btn.className = 'faq-btn';
    btn.setAttribute('aria-label', 'Open ladder assistant');
    btn.textContent = '💬';

    // Chat panel
    const panel = document.createElement('div');
    panel.id = 'faq-widget-panel';
    panel.className = 'faq-panel';
    panel.setAttribute('aria-hidden', 'true');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Ladder assistant');
    panel.innerHTML = `
      <div class="faq-header">
        <div class="faq-header-text">
          <span class="faq-title">🎾 Ladder Assistant</span>
          <span class="faq-subtitle">Ask me anything about the ladder</span>
        </div>
        <button class="faq-close-btn" id="faq-close-btn" aria-label="Close">✕</button>
      </div>
      <div class="faq-messages" id="faq-messages"></div>
      <div class="faq-input-area">
        <input
          type="text"
          id="faq-input"
          class="faq-input"
          placeholder="Ask about scoring, ratings, how to join…"
          autocomplete="off"
          maxlength="500"
        />
        <button id="faq-send-btn" class="faq-send-btn" aria-label="Send message">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    btn.addEventListener('click', togglePanel);
    document.getElementById('faq-close-btn').addEventListener('click', closePanel);
    document.getElementById('faq-send-btn').addEventListener('click', sendMessage);
    document.getElementById('faq-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  /* ── Open / close ──────────────────────────────────────── */

  function togglePanel() {
    isOpen ? closePanel() : openPanel();
  }

  function openPanel() {
    isOpen = true;
    const panel = document.getElementById('faq-widget-panel');
    const btn   = document.getElementById('faq-widget-btn');
    panel.classList.add('faq-panel--open');
    panel.setAttribute('aria-hidden', 'false');
    btn.textContent = '✕';
    btn.setAttribute('aria-label', 'Close ladder assistant');

    // Show welcome message only once per session
    const messages = document.getElementById('faq-messages');
    if (!messages.hasChildNodes()) {
      addMessage('assistant', WELCOME_MESSAGE);
    }

    setTimeout(() => document.getElementById('faq-input')?.focus(), 280);
  }

  function closePanel() {
    isOpen = false;
    const panel = document.getElementById('faq-widget-panel');
    const btn   = document.getElementById('faq-widget-btn');
    panel.classList.remove('faq-panel--open');
    panel.setAttribute('aria-hidden', 'true');
    btn.textContent = '💬';
    btn.setAttribute('aria-label', 'Open ladder assistant');
  }

  /* ── Message rendering ─────────────────────────────────── */

  function addMessage(role, content) {
    const container = document.getElementById('faq-messages');
    const bubble = document.createElement('div');
    bubble.className = `faq-bubble faq-bubble--${role}`;
    bubble.innerHTML = renderText(content);
    container.appendChild(bubble);
    scrollToBottom();
    return bubble;
  }

  function scrollToBottom() {
    const container = document.getElementById('faq-messages');
    if (container) container.scrollTop = container.scrollHeight;
  }

  function showLoading() {
    const container = document.getElementById('faq-messages');
    const el = document.createElement('div');
    el.className = 'faq-bubble faq-bubble--assistant faq-loading';
    el.id = 'faq-loading-indicator';
    el.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(el);
    scrollToBottom();
  }

  function hideLoading() {
    document.getElementById('faq-loading-indicator')?.remove();
  }

  function setInputEnabled(enabled) {
    const input   = document.getElementById('faq-input');
    const sendBtn = document.getElementById('faq-send-btn');
    if (input)   input.disabled   = !enabled;
    if (sendBtn) sendBtn.disabled = !enabled;
    isWaiting = !enabled;
  }

  /* ── API call ──────────────────────────────────────────── */

  async function sendMessage() {
    if (isWaiting) return;

    const input = document.getElementById('faq-input');
    const text  = input?.value.trim();
    if (!text) return;

    input.value = '';
    addMessage('user', text);
    conversationHistory.push({ role: 'user', content: text });

    setInputEnabled(false);
    showLoading();

    // Guard: check API key is configured
    if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === 'YOUR_API_KEY_HERE') {
      hideLoading();
      addMessage('assistant', 'The assistant isn\'t configured yet. Text Michael at 832-833-1990 for help!');
      setInputEnabled(true);
      return;
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: conversationHistory
        })
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`API ${response.status}: ${errBody}`);
      }

      const data  = await response.json();
      const reply = data.content?.[0]?.text;

      if (!reply) throw new Error('Empty response from API');

      hideLoading();
      addMessage('assistant', reply);
      conversationHistory.push({ role: 'assistant', content: reply });

    } catch (err) {
      console.error('FAQ widget error:', err);
      hideLoading();
      addMessage('assistant', 'Something went wrong. Text Michael at 832-833-1990 for help!');
    } finally {
      setInputEnabled(true);
      document.getElementById('faq-input')?.focus();
    }
  }

  /* ── Boot ──────────────────────────────────────────────── */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }

})();
