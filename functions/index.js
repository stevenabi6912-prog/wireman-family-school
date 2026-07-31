import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import admin from 'firebase-admin';

admin.initializeApp();

// The Anthropic API key lives only here, as a Firebase secret — never in
// frontend code or env vars bundled into the static site. Set it with:
//   firebase functions:secrets:set ANTHROPIC_API_KEY
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// Simple deploy/connectivity check — confirms the Functions pipeline (region,
// project, secrets binding) is wired up correctly before the real grading
// logic is built out.
export const health = onRequest((req, res) => {
  res.json({ ok: true });
});

// Fires when a submission flips from draft to submitted. Full grading logic
// (fetch answer key from Storage, call Claude, parse per-question feedback,
// write to /grades, flag low-confidence results) is built out separately —
// this is the trigger wiring only.
export const gradeSubmission = onDocumentUpdated(
  { document: 'submissions/{submissionId}', secrets: [ANTHROPIC_API_KEY] },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (before.isDraft === false || after.isDraft !== false) return; // only act on the draft->submitted transition

    // TODO: look up the assignment's subject (gradable?) and keyPath,
    // fetch the answer key PDF from Storage, call the Anthropic API with
    // ANTHROPIC_API_KEY.value(), and write the result to /grades/{assignmentId}.
    console.log(`Submission ${event.params.submissionId} submitted; grading not yet implemented.`);
  }
);
