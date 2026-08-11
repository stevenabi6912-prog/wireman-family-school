// Abi's day-1 math corrections.
//   1. Logan and Lazarus need the Demme LOGIN page, not the student dashboard.
//   2. Luke and Layla are not in Math-U-See Algebra 1 — their course is
//      "Legacy". We don't have the Legacy materials yet, so the wrong
//      workbook pages come off the cards rather than sending them to the
//      wrong book every day. (Re-attach once the file arrives.)
// Idempotent. Run: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/fix-math-abi-day1.js

import admin from 'firebase-admin';

admin.initializeApp({ projectId: 'wireman-homeschool' });
const db = admin.firestore();

const LOGIN_URL = 'https://login.demmelearning.com';

async function main() {
  const snap = await db.collection('assignments').where('subjectId', '==', 'math').get();
  let batch = db.batch();
  let n = 0;
  let relinked = 0;
  let relabelled = 0;
  let unlinked = 0;

  for (const d of snap.docs) {
    const a = d.data();
    const patch = {};

    // --- 1. the younger two get the login page ---
    if ((a.studentId === 'logan' || a.studentId === 'lazarus') && a.externalUrl) {
      patch.externalUrl = LOGIN_URL;
      relinked++;
    }

    // --- 2. Luke & Layla: Algebra 1 -> Legacy, drop the wrong workbook.
    //        Two separate checks: the wording, and the attached pages. Their
    //        "Practice B" items never say Algebra 1 but still linked the book. ---
    if (a.studentId === 'luke' || a.studentId === 'layla') {
      if (/Algebra 1/.test(`${a.title} ${a.instructions ?? ''}`)) {
        patch.title = a.title.replace(/Algebra 1/g, 'Legacy');
        patch.instructions = (a.instructions ?? '')
          .replace(/Algebra 1/g, 'Legacy')
          .replace(/in your workbook/g, 'in your Legacy book');
        relabelled++;
      }
      if (a.contentPath && a.contentPath.includes('algebra1')) {
        patch.contentPath = null; // wrong course's pages — better none than wrong
        patch.instructions = (patch.instructions ?? a.instructions ?? '')
          .replace(/in your workbook/g, 'in your Legacy book');
        unlinked++;
      }
    }

    if (Object.keys(patch).length === 0) continue;
    patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    batch.update(d.ref, patch);
    if (++n === 400) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n) await batch.commit();

  console.log(`math links pointed at ${LOGIN_URL} for Logan + Lazarus: ${relinked}`);
  console.log(`Luke + Layla items relabelled Algebra 1 -> Legacy: ${relabelled}`);
  console.log(`wrong-workbook pages detached: ${unlinked}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
