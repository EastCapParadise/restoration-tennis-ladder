/* =============================================================================
   TOURNAMENT DATA — End of Season Tournament 2026
   -----------------------------------------------------------------------------
   This is the ONE file you hand-edit for the tournament. tournament.html reads
   it; nothing here touches the live ladder, the rating model, or Supabase.

   Three things live in here:

     1. snapshot  — the frozen Oct 12 standings used for seeding. Captured once,
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
   ladder and says so. Once `snapshot.players` is non-empty, seeding and men's
   backfill read from it and only from it. The Club 4 are the fixed
   `clubRoster` list below, seeded by `seedOverrides.club`.

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
     club-sf-1 (#1 v #4), club-sf-2 (#2 v #3), club-f

   Entry fields (all optional except `winner` once it's played):

     winner   Winner's name as it appears on the ladder, OR their seed number.
              For club matches the seed number is their club seed (1-4).
     score    WINNER-FIRST, e.g. "6-3" or "7-6" or "6-4, 3-6, 10-7".
     date     "YYYY-MM-DD". Set it before a match is played to publish the
              agreed date; it shows on the bracket card.
     walkover true if nobody played it — a default, a no-show, or a withdrawal.
              Leave `score` off. The bracket marks it W.O.
     note     Short free text shown under the card, e.g. "moved to Marcey".

   Examples:

     "women-r16-3": { date: "2026-10-18" },
     "women-r16-1": { winner: "Jane Doe", score: "6-2", date: "2026-10-14" },
     "men-r16-5":   { winner: 5, walkover: true, note: "opponent no-show" },
     "club-sf-2":   { winner: "Jed Royal", score: "6-4" },

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
    snapshotDate: "2026-10-12",

    deadlines: {
      drawsPublished: "2026-10-12",
      optOut: "2026-10-13",
      backfill: "2026-10-13",
      groupPlay: "2026-10-25",      // R16 + QF must be done
      semifinals: "2026-11-05",     // Open and Club semifinals
      finalsConfirm: "2026-11-04"   // semifinalists confirm Nov 6 availability
    },

    finalsNight: {
      date: "2026-11-06",
      dayLabel: "Friday, Nov 6",
      time: "7:00–10:00 PM",
      venue: "Fitzgerald Stadium Court",
      address: "4850 Colorado Ave NW, Washington, DC 20011",
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
     SNAPSHOT — frozen standings, captured Oct 12, 2026 after the duplicate
     match-row cleanup and the Travis Hubbs / Chris Donahoe rating corrections.
     Seeding reads ONLY this; it never refreshes from the live ladder. Do not
     hand-edit or re-capture.
     ------------------------------------------------------------------------ */
  snapshot: {
    asOf: "2026-10-12",
    capturedAt: "2026-10-12T14:46:17.584Z",
    players: [
      { id: 5, name: "Michael Strickland", sex: "Man", ladder_points: 294, sos: 3.19, display_rating: 3.35, matches_played: 23 },
      { id: 20, name: "Marisa Swab", sex: "Woman", ladder_points: 287, sos: 2.8, display_rating: 2.86, matches_played: 20 },
      { id: 9, name: "Matt Farrell", sex: "Man", ladder_points: 204, sos: 2.94, display_rating: 2.53, matches_played: 19 },
      { id: 36, name: "Kenny Swab", sex: "Man", ladder_points: 192, sos: 3.05, display_rating: 2.75, matches_played: 14 },
      { id: 24, name: "Mallory Kuchem", sex: "Woman", ladder_points: 173, sos: 2.72, display_rating: 2.94, matches_played: 11 },
      { id: 33, name: "Katie Farrell", sex: "Woman", ladder_points: 167, sos: 2.79, display_rating: 3.1, matches_played: 13 },
      { id: 6, name: "Brett Wierenga", sex: "Man", ladder_points: 136, sos: 2.85, display_rating: 2.96, matches_played: 13 },
      { id: 7, name: "Chad Kuchem", sex: "Man", ladder_points: 136, sos: 2.87, display_rating: 2.53, matches_played: 12 },
      { id: 11, name: "Hannah Royal", sex: "Woman", ladder_points: 135, sos: 2.97, display_rating: 2.38, matches_played: 11 },
      { id: 38, name: "Endel Liias", sex: "Man", ladder_points: 131, sos: 4.32, display_rating: 4.66, matches_played: 9 },
      { id: 21, name: "Amy Layman", sex: "Woman", ladder_points: 124, sos: 2.74, display_rating: 2.27, matches_played: 10 },
      { id: 15, name: "Maria Strickland", sex: "Woman", ladder_points: 122, sos: 2.74, display_rating: 2.82, matches_played: 6 },
      { id: 10, name: "Jed Royal", sex: "Man", ladder_points: 112, sos: 4.44, display_rating: 4.41, matches_played: 10 },
      { id: 32, name: "Rachel Penney", sex: "Woman", ladder_points: 104, sos: 2.88, display_rating: 2.91, matches_played: 7 },
      { id: 23, name: "Avery Phillips", sex: "Woman", ladder_points: 87, sos: 2.91, display_rating: 3.47, matches_played: 8 },
      { id: 25, name: "James Janis", sex: "Man", ladder_points: 81, sos: 4.17, display_rating: 4.49, matches_played: 5 },
      { id: 34, name: "Kate Liias", sex: "Woman", ladder_points: 73, sos: 2.75, display_rating: 3.5, matches_played: 4 },
      { id: 27, name: "Bryan Layman", sex: "Man", ladder_points: 64, sos: 2.71, display_rating: 2.78, matches_played: 6 },
      { id: 37, name: "Carter Phillips", sex: "Man", ladder_points: 61, sos: 3.2, display_rating: 2.94, matches_played: 5 },
      { id: 14, name: "Beth Tipps", sex: "Woman", ladder_points: 48, sos: 2.62, display_rating: 4.02, matches_played: 2 },
      { id: 46, name: "Tommy Downs", sex: "Man", ladder_points: 47, sos: 2.7, display_rating: 3.05, matches_played: 3 },
      { id: 49, name: "Israel Ortega", sex: "Man", ladder_points: 41, sos: 3.39, display_rating: 2.06, matches_played: 4 },
      { id: 4, name: "Michael C Harper", sex: "Man", ladder_points: 40, sos: 2.82, display_rating: 2.88, matches_played: 3 },
      { id: 26, name: "Irby Thompson", sex: "Man", ladder_points: 40, sos: 2.92, display_rating: 2.96, matches_played: 4 },
      { id: 8, name: "Danny Crouch", sex: "Man", ladder_points: 35, sos: 2.74, display_rating: 3.38, matches_played: 4 },
      { id: 50, name: "Bala Chandran", sex: "Man", ladder_points: 32, sos: 2.93, display_rating: 2.98, matches_played: 3 },
      { id: 19, name: "Katie Thompson", sex: "Woman", ladder_points: 32, sos: 3.07, display_rating: 3.05, matches_played: 3 },
      { id: 41, name: "Chris Donahoe", sex: "Man", ladder_points: 29, sos: 3.33, display_rating: 3.5, matches_played: 1 },
      { id: 17, name: "Kendall Twining", sex: "Woman", ladder_points: 23, sos: 2.55, display_rating: 3.68, matches_played: 2 },
      { id: 54, name: "Sarah Crouch", sex: "Woman", ladder_points: 22, sos: 2.9, display_rating: 2.64, matches_played: 3 },
      { id: 13, name: "Steven Feldstein", sex: "Man", ladder_points: 21, sos: 3.21, display_rating: 3.44, matches_played: 2 },
      { id: 18, name: "Becky Corby", sex: "Woman", ladder_points: 20, sos: 2.79, display_rating: 1.95, matches_played: 2 },
      { id: 12, name: "Wray Fitch", sex: "Man", ladder_points: 17, sos: 2.95, display_rating: 3.51, matches_played: 1 },
      { id: 28, name: "Parker Schmidt", sex: "Man", ladder_points: 17, sos: 3, display_rating: 2.74, matches_played: 2 },
      { id: 42, name: "Brendan Sorem", sex: "Man", ladder_points: 15, sos: 1.98, display_rating: 2.38, matches_played: 1 },
      { id: 56, name: "Evan Neuwirth", sex: "Man", ladder_points: 13, sos: 2.97, display_rating: 3.03, matches_played: 1 },
      { id: 29, name: "Dan Vogel", sex: "Man", ladder_points: 12, sos: 2.98, display_rating: 3.65, matches_played: 2 },
      { id: 60, name: "Travis Hubbs", sex: "Man", ladder_points: 12, sos: 2.1, display_rating: 4, matches_played: 1 },
      { id: 53, name: "Tennyson Crouch", sex: "Man", ladder_points: 9, sos: 3.52, display_rating: 3.04, matches_played: 1 },
      { id: 57, name: "Corie Dean", sex: "Woman", ladder_points: 8, sos: null, display_rating: 2.75, matches_played: 0 },
      { id: 58, name: "Daniel Liberto", sex: "Man", ladder_points: 7, sos: null, display_rating: 3.5, matches_played: 0 },
      { id: 59, name: "Anna Wade", sex: "Woman", ladder_points: 7, sos: null, display_rating: 3, matches_played: 0 },
      { id: 35, name: "Gibby Preston", sex: "Man", ladder_points: 5, sos: null, display_rating: 3, matches_played: 0 },
      { id: 22, name: "Marcus Cave", sex: "Man", ladder_points: 5, sos: 3, display_rating: 3.4, matches_played: 1 },
      { id: 31, name: "Mac McCullough", sex: "Man", ladder_points: 5, sos: 4.61, display_rating: 4.46, matches_played: 1 },
      { id: 62, name: "Colt Harper", sex: "Man", ladder_points: 5, sos: 2.83, display_rating: 2.45, matches_played: 1 },
      { id: 16, name: "Maggie Dean", sex: "Woman", ladder_points: 0, sos: null, display_rating: 2, matches_played: 0 },
      { id: 39, name: "Kristen Zarkowsky", sex: "Woman", ladder_points: 0, sos: null, display_rating: 3.5, matches_played: 0 },
      { id: 61, name: "Anna Isbell", sex: "Woman", ladder_points: 0, sos: null, display_rating: 2.5, matches_played: 0 },
      { id: 30, name: "Hannah Howe", sex: "Woman", ladder_points: 0, sos: null, display_rating: 3, matches_played: 0 },
      { id: 40, name: "Priya B Madrecki", sex: "Woman", ladder_points: 0, sos: null, display_rating: 3.25, matches_played: 0 },
      { id: 51, name: "Kelly Sheppard", sex: "Woman", ladder_points: 0, sos: null, display_rating: 5, matches_played: 0 },
      { id: 55, name: "Jeff Pickering", sex: "Man", ladder_points: 0, sos: null, display_rating: 3.75, matches_played: 0 },
      { id: 52, name: "Jack Bryson", sex: "Man", ladder_points: 0, sos: null, display_rating: 3, matches_played: 0 },
      { id: 48, name: "Claudius Modesti", sex: "Man", ladder_points: 0, sos: null, display_rating: 3.75, matches_played: 0 },
      { id: 64, name: "Liz Shipley", sex: "Woman", ladder_points: 0, sos: null, display_rating: 3, matches_played: 0 },
      { id: 63, name: "Hans Liu", sex: "Man", ladder_points: 0, sos: null, display_rating: 3.5, matches_played: 0 },
      { id: 43, name: "Scott Jacob", sex: "Man", ladder_points: 0, sos: null, display_rating: 4.25, matches_played: 0 },
      { id: 45, name: "Brendon Smith", sex: "Man", ladder_points: 0, sos: null, display_rating: 4, matches_played: 0 },
      { id: 44, name: "Andrew Hicks", sex: "Man", ladder_points: 0, sos: null, display_rating: 3.25, matches_played: 0 }
    ]
  },

  /* ---------------------------------------------------------------------------
     MEN'S CLUB ROSTER — the four Club players, by name as on the ladder.
     Fixed list, not picked by rating or points. These four are left out of
     the Men's Open; every other man is an Open candidate on ladder points.
     They play a four-player single-elimination draw: semifinals #1 v #4 and
     #2 v #3, then a final. Seeds are fixed in seedOverrides.club.
     ------------------------------------------------------------------------ */
  clubRoster: ["Endel Liias", "James Janis", "Jed Royal", "Mac McCullough"],

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
    // Club seeds as published Oct 29 for the switch to single elimination.
    // Set by the tournament director, not strictly by rating (James 4.49 and
    // Mac 4.46 sit below Jed 4.41 here).
    club: ["Endel Liias", "Jed Royal", "James Janis", "Mac McCullough"]
  },

  /* ---------------------------------------------------------------------------
     MATCHES — results and dates. See the header for ids and field meanings.
     ------------------------------------------------------------------------ */
  matches: {
    // "women-r16-1": { winner: "Jane Doe", score: "6-2", date: "2026-10-14" },
  }
};
