/* =============================================================================
   SEASON FEEDBACK — shared options
   -----------------------------------------------------------------------------
   The checklist options for "What worked well?" and "What should change?",
   shared by feedback.html (via app.js) and the admin page (via admin.js).
   The keys are what's stored; they must match the check constraint in
   supabase/season_feedback.sql. Labels can be reworded freely.
   ========================================================================== */

const FEEDBACK_TABLE = "season_feedback";

const FEEDBACK_ASPECTS = [
  { key: "format", label: "Ladder format & scheduling flexibility" },
  { key: "rating", label: "Rating/skill matching" },
  { key: "communication", label: "Communication (recaps, texts, reminders)" },
  { key: "tournament", label: "End-of-season tournament" },
  { key: "community", label: "Community & social side" },
  { key: "website", label: "Website/app experience" },
  { key: "other", label: "Other" }
];

const FEEDBACK_ONE_CHANGE_MAX = 200;
const FEEDBACK_OTHER_MAX = 2000;
