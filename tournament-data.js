/* =============================================================================
   TOURNAMENT DATA — End of Season Tournament 2026
   -----------------------------------------------------------------------------
   This is the ONE file you hand-edit for the tournament. tournament.html reads
   it; nothing here touches the live ladder, the rating model, or Supabase.

   Three things live in here:

     1. snapshot  — the frozen Oct 11 standings used for seeding. Captured once,
                    then never edited. The live ladder keeps running after this;
                    the tournament stops looking at it.
     2. withdrawals — people who opted out by Oct 13.
     3. matches   — legacy/fallback results. Results are normally entered in
                    the admin panel (Tournament Match Results), which saves
                    them to the Supabase tournament_results table; a row
                    there wins over an entry here for the same match id.

   ---------------------------------------------------------------------------
   HOW TO CAPTURE THE Oct 11 SNAPSHOT
   ---------------------------------------------------------------------------
   On Oct 11, open restotennis.com/tournament.html?snapshot=1 and click
   "Capture seeding snapshot". It copies a finished `snapshot: { … },` block to
   your clipboard and shows it in a box on the page. Paste it over the block
   below, replacing it wholesale, and commit. That's the freeze.

   (Equivalent from the browser console on tournament.html:
      await captureTournamentSnapshot()
    which prints the same block and copies it to the clipboard. Run it on
    tournament.html specifically — that's the page that loads this file, so
    it's the only one that knows the snapshot date.)

   Until the snapshot is captured, the page shows PROVISIONAL seeds off the live
   ladder and says so. Once `snapshot.players` is non-empty, seeding, men's
   backfill, and the Club 4 all read from it and only from it.

   ---------------------------------------------------------------------------
   HOW TO ENTER A RESULT
   ---------------------------------------------------------------------------
   Use admin.html → Tournament Match Results. It writes the same fields
   described below to the tournament_results table (winner saved by name).

   Hand-editing still works as a fallback: add an entry to `matches` keyed by
   match id. Match ids are stable:

     women-r16-1 … women-r16-8   men-r16-1 … men-r16-8
     women-qf-1  … women-qf-4    men-qf-1  … men-qf-4
     women-sf-1, women-sf-2      men-sf-1, men-sf-2
     women-f                     men-f
     club-r1-1, club-r1-2, club-r2-1, club-r2-2, club-r3-1, club-r3-2, club-f

   Entry fields (all optional except `winner` once it's played):

     winner   Winner's name as it appears on the ladder, OR their seed number.
              For club matches the seed number is their club seed (1-4).
     score    WINNER-FIRST, e.g. "6-3" or "8-6" or "6-4, 3-6, 10-7".
              Games here feed the club round-robin "games lost" tiebreak, so
              keep club scores accurate.
     date     "YYYY-MM-DD". Set it before a match is played to publish the
              agreed date; it shows on the bracket card.
     walkover true if nobody played it — a default, a no-show, or a withdrawal.
              Leave `score` off. The bracket marks it W.O.
     note     Short free text shown under the card, e.g. "moved to Marcey".

   Examples:

     "women-r16-3": { date: "2026-10-18" },
     "women-r16-1": { winner: "Jane Doe", score: "6-2", date: "2026-10-14" },
     "men-r16-5":   { winner: 5, walkover: true, note: "opponent no-show" },
     "club-r1-1":   { winner: "Jed Royal", score: "6-4" },

   A match with only a `date` is "scheduled". A match with a `winner` is final
   and the winner propagates to the next round automatically.
   ========================================================================== */

window.TOURNAMENT_DATA = {

  /* ---------------------------------------------------------------------------
     CONFIG — dates the bracket logic needs, plus the rule switches.
     The prose timeline lives in tournament.html; these are the dates that
     actually drive behaviour (deadline hints, walkover windows).
     ------------------------------------------------------------------------ */
  config: {
    seasonLabel: "2026 End of Season Tournament",

    // Seeding snapshot date. The live ladder keeps accruing after this.
    snapshotDate: "2026-10-11",

    deadlines: {
      drawsPublished: "2026-10-12",
      optOut: "2026-10-13",
      backfill: "2026-10-13",
      groupPlay: "2026-10-25",      // R16 + QF must be done
      clubRoundRobin: "2026-11-04", // all 6 club matches done — hard deadline
      semifinals: "2026-11-05",
      finalsConfirm: "2026-11-04"   // semifinalists confirm Nov 6 availability
    },

    finalsNight: {
      date: "2026-11-06",
      dayLabel: "Friday, Nov 6",
      openFinalsTime: "8:00 PM",
      clubFinalTime: "9:15 PM",
      venue: "Stratford Park, Arlington",
      rainDate: "2026-11-07",
      rainDateLabel: "Saturday, Nov 7"
    },

    rules: {
      // R16 pairing inside each quarter of the draw.
      //   "standard" — top seed of the quarter meets the weakest, #2 meets #3.
      //                Group 1 (1,8,9,16) plays 1v16 and 8v9. This is normal
      //                single-elim seed protection and what the site has always
      //                used.
      //   "ordered"  — the group's 1st seed meets its 2nd, 3rd meets its 4th.
      //                Group 1 plays 1v8 and 9v16.
      r16Pairing: "standard",

      // Do the Club 4 also appear in the Men's Open 16?
      //   false — Club is a separate elite division; those four are pulled out
      //           of the Open draw and seeds 1-16 come from the men below them.
      //           (Existing site behaviour, and it keeps anyone off two finals
      //           on the same night.)
      //   true  — Club 4 play both draws.
      clubPlayersInOpenDraw: false,

      // How the men's draw absorbs an Oct 13 dropout.
      //   "reseed"  — drop them from the pool and re-seed 1-16 from the
      //               snapshot order, so the next player in line (17, 18, …)
      //               joins at the bottom.
      //   "slot-in" — keep everyone's seed number and drop the next unused
      //               player straight into the vacated slot.
      menBackfillMode: "reseed",

      // The women's draw has no alternates: a dropout keeps her seed slot,
      // marked "withdrew", and her opponent takes a walkover. Not configurable
      // — it's the published rule.

      // Auto-apply the "higher seed advances" default once a round's deadline
      // has passed and no result has been entered?
      //   false — the card shows a reminder that the default applies, but the
      //           bracket waits for you to record it (walkover: true). Safer:
      //           a match played on the last day but not yet entered won't be
      //           published as a walkover against the person who won it.
      //   true  — the bracket advances the higher seed on its own.
      autoAdvanceAfterDeadline: false,

      // Tournament eligibility, measured against the snapshot. Ladder points
      // are the real participation signal — they include drop-in game points,
      // so a player can sit on 0 recorded matches and still be in the season.
      // At 1 point, this picks out exactly the 16 women and 30 men who were
      // active when the snapshot was taken.
      minLadderPoints: 1,
      minMatchesPlayed: 0
    }
  },

  /* ---------------------------------------------------------------------------
     SNAPSHOT — frozen standings as of Oct 11, 2026. Seeding reads ONLY this.
     Leave `players` empty until Oct 11; the page falls back to provisional
     live seeds and labels them as such. Do not hand-edit once captured.
     ------------------------------------------------------------------------ */
  snapshot: {
    asOf: "2026-10-11",
    capturedAt: null,  // ISO timestamp, filled in by the capture tool
    // { id, name, sex, ladder_points, sos, display_rating, matches_played }
    players: []
  },

  /* ---------------------------------------------------------------------------
     WITHDRAWALS — names (as on the ladder) of players who opted out by Oct 13.
     Men: the draw backfills per config.rules.menBackfillMode.
     Women: no alternates — she keeps her slot, opponent advances by walkover.
     e.g. withdrawals: ["Jane Doe", "John Smith"]
     ------------------------------------------------------------------------ */
  withdrawals: [],

  /* ---------------------------------------------------------------------------
     SEED OVERRIDES — escape hatch. Normally null: seeds come from the snapshot.
     Set one to an ordered array of 16 names (4 for club) to publish a hand-made
     draw; the array order IS the seed order.
     ------------------------------------------------------------------------ */
  seedOverrides: {
    women: null,
    men: null,
    club: null
  },

  /* ---------------------------------------------------------------------------
     MATCHES — results and dates. See the header for ids and field meanings.
     ------------------------------------------------------------------------ */
  matches: {
    // "women-r16-1": { winner: "Jane Doe", score: "6-2", date: "2026-10-14" },
  }
};
