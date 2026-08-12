# Firestore Data Model

Reference for the collections used across the app, security rules, and Cloud Functions.
Firestore holds metadata only — PDF bytes live in Firebase Storage.

## `families/{familyId}` (single doc, id: `wireman`)

Top-level config, one document for the whole family.

```
{
  schoolYearStart: "2026-08-17",
  schoolYearEnd:   "2027-06-03",
  schoolDays:      [1,2,3,4],      // ISO weekday ints, Mon=1..Sun=7. Default Mon-Thu.
  dailySubjectOrder: [
    "bible", "math", "ela", "history", "science", "writing"
  ],                                // default order, same for all 4 kids per parent decision
  holidays: [
    { start: "2026-09-07", end: "2026-09-07", label: "Labor Day" },
    { start: "2026-11-23", end: "2026-11-27", label: "Thanksgiving" },
    { start: "2026-12-21", end: "2027-01-02", label: "Christmas" },
    { start: "2027-02-15", end: "2027-02-15", label: "Presidents' Day" },
    { start: "2027-03-29", end: "2027-04-02", label: "Easter/Spring" }
  ],
  blockouts: [
    { id: "auto-id", start: "2026-10-12", end: "2026-10-16", label: "Family trip", createdAt, createdBy }
  ]
}
```

Blockouts and holidays are both "non-school day" ranges; blockouts are parent-added,
holidays are seeded from the standard calendar. Both are used the same way by the
scheduler: reflow, don't delete.

Also merged onto this doc: `emailPrefs`, `pause`, `scoreboard`, the family quest,
and `parentThemes: { abi: {...}, steven: {...} }` — each parent's own dashboard
palette and avatar. (The older single `parentTheme` field is Abi's pre-Steven pick
and is still read as her fallback.)

## `students/{studentId}`  (studentId = "luke" | "layla" | "logan" | "lazarus")

```
{
  name: "Luke",
  grade: 8,
  dailyHoursBudget: 6,
  uiDensity: "standard",       // "standard" | "large-low-word" for Lazarus
  subjectOrder: null,          // per-student override; null = use family default
  mathRemediation: {
    active: true,
    approach: "slower-pace",   // "slower-pace" | "catchup-track"
    notes: "Math-U-See, current level TBD — placeholder until video links added"
  },
  active: true
}
```

## `subjects/{subjectId}`

```
{ id: "bible", name: "Bible", contentSource: "physical-book", gradable: false }
{ id: "math", name: "Math", contentSource: "video-link-placeholder", gradable: true, platformUrl: "https://digital.demmelearning.com/" }
{ id: "ela", name: "Grammar & Writing", contentSource: "storage-pdf", gradable: true }
{ id: "history", name: "History", contentSource: "storage-pdf", gradable: false }
{ id: "science", name: "Science", contentSource: "storage-pdf", gradable: false }
```

## `assignments/{assignmentId}`

The unit of "one thing to do." One per student per subject per scheduled day (usually).

```
{
  studentId: "logan",
  subjectId: "ela",
  scheduledDate: "2026-08-17",
  originalDate:  "2026-08-17",   // set once, never changes even if rescheduled
  sequence: 3,                    // position within that day's list (1-based, matches subjectOrder)
  title: "Grammar and Writing 5 — Lesson 1",
  itemType: "worksheet",          // "reading" | "worksheet" | "test" | "memorization" | "bible" | "project" | "video"
  estimatedMinutes: 30,
  contentPath: "curriculum/ela/5/grammar-writing-5-textbook.pdf#page=12",  // Storage path (+ optional page anchor)
  keyPath: "keys/ela/5/grammar-writing-5-teacher-guide.pdf#page=118",       // Storage path, NEVER exposed to student reads
  externalUrl: null,              // used for itemType "video" (Math-U-See link) instead of contentPath
  status: "not_started",          // "not_started" | "in_progress" | "submitted" | "graded" | "waived" | "rescheduled"
  waivedReason: null,
  createdAt, updatedAt
}
```

- `itemType: "bible"` and `itemType: "memorization"` never get a `contentPath`/`keyPath` —
  they render as a plain checklist row with a "recited/completed to parent" checkbox,
  no submission form, no grading. Bible references the physical AiG book by title only.
- `itemType: "video"` is the Math-U-See placeholder: an `externalUrl` field renders as a
  link/embed once the family supplies it. Until then the UI shows "link coming soon" and
  the item still requires a manual "done" checkoff so the day isn't blocked.

## `submissions/{submissionId}`  (one per assignment, keyed by assignmentId)

```
{
  assignmentId,
  studentId,
  responseType: "text" | "multipleChoice" | "file",
  answers: [ { questionNumber, response } ],   // for text/MC
  fileUrls: [ "submissions/logan/2026-08-17/ela-lesson1-page1.jpg" ],  // for file/photo uploads
  isDraft: true,
  submittedAt: null,
  updatedAt
}
```

Autosaved continuously while `isDraft: true`; flips to `submittedAt` set + `isDraft: false`
on submit, which triggers the grading Cloud Function for gradable subjects.

## `grades/{gradeId}`  (one per graded assignment, keyed by assignmentId)

```
{
  assignmentId, studentId, subjectId,
  score: 8, maxScore: 10,
  perQuestion: [ { questionNumber, correct: true, note: "" }, { questionNumber, correct: false, note: "Subtracted numerators without a common denominator" } ],
  misunderstandingSummary: "Struggled with unlike-denominator subtraction (Q4, Q7).",
  confidence: "high" | "low",
  needsManualReview: false,
  gradedBy: "claude-sonnet-5" | "abi",
  overriddenScore: null,           // set if Abi manually overrides
  gradedAt
}
```

Items with no answer key are written with `score: null, maxScore: null` and go
to Abi's review queue instead of being auto-graded. When she scores one there,
the review form asks for the "out of" too and writes `maxScore` alongside
`overriddenScore` — without it the grade has no denominator, so it can't count
toward an average and reads as a bare score everywhere. Anything rendering a
grade should go through `scoreLabel()` (app: `src/lib/grades.js`, functions:
`index.js`) rather than interpolating `score`/`maxScore` directly.

## `users/{uid}`  (Firebase Auth uid → role mapping)

```
{ role: "student", studentId: "luke" }
{ role: "student", studentId: "layla" }
{ role: "student", studentId: "logan" }
{ role: "student", studentId: "lazarus" }
{ role: "parent" }                 // Abi and Steven — identical claims
```

Both parents have the same `parent` role and the same access. A parent carries no
`studentId` claim, so the app derives which parent is signed in from the login
address (`abi@wireman.local` → `abi`); that id is what the versus games use as a
player and what keys their dashboard theme.

Auth uses synthetic emails (`luke@wireman.local`, etc.) with 6-digit PIN passwords;
the synthetic email is never rendered in the UI, only used internally by Firebase Auth.

## Storage layout

```
/curriculum/{subject}/{grade}/...             — readable by any authenticated family member
/keys/{subject}/{grade}/...                   — readable by parent only, denied to all students
/submissions/{studentId}/{date}/...           — writable by that student only, readable by that student + parent
```
