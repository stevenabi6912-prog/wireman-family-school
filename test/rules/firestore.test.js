import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'homeschool-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  // Seed as admin (bypasses rules) so every test starts from the same fixtures.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/luke-uid'), { role: 'student', studentId: 'luke' });
    await setDoc(doc(db, 'users/layla-uid'), { role: 'student', studentId: 'layla' });
    await setDoc(doc(db, 'users/abi-uid'), { role: 'parent' });

    await setDoc(doc(db, 'students/luke'), { name: 'Luke', grade: 8 });
    await setDoc(doc(db, 'students/layla'), { name: 'Layla', grade: 8 });

    await setDoc(doc(db, 'assignments/luke-1'), {
      studentId: 'luke',
      subjectId: 'ela',
      scheduledDate: '2026-08-17',
      keyPath: 'keys/ela/8/answers.pdf',
      status: 'not_started',
    });
    await setDoc(doc(db, 'assignments/layla-1'), {
      studentId: 'layla',
      subjectId: 'ela',
      scheduledDate: '2026-08-17',
      keyPath: 'keys/ela/8/answers.pdf',
      status: 'not_started',
    });

    await setDoc(doc(db, 'grades/luke-1'), {
      assignmentId: 'luke-1',
      studentId: 'luke',
      score: 9,
      maxScore: 10,
    });
  });
});

// Role/studentId come from Auth custom claims (second arg), matching how the
// real app provisions accounts — see scripts/seed-users.js.
function asLuke() {
  return testEnv.authenticatedContext('luke-uid', { role: 'student', studentId: 'luke' }).firestore();
}
function asLayla() {
  return testEnv.authenticatedContext('layla-uid', { role: 'student', studentId: 'layla' }).firestore();
}
function asAbi() {
  return testEnv.authenticatedContext('abi-uid', { role: 'parent' }).firestore();
}
function asAnon() {
  return testEnv.unauthenticatedContext().firestore();
}

describe('users', () => {
  it('a student can read their own user doc', async () => {
    await assertSucceeds(getDoc(doc(asLuke(), 'users/luke-uid')));
  });

  it('a student cannot read a sibling\'s user doc', async () => {
    await assertFails(getDoc(doc(asLuke(), 'users/layla-uid')));
  });

  it('a student cannot write any user doc', async () => {
    await assertFails(updateDoc(doc(asLuke(), 'users/luke-uid'), { role: 'parent' }));
  });
});

describe('students', () => {
  it('a student can read their own student doc', async () => {
    await assertSucceeds(getDoc(doc(asLuke(), 'students/luke')));
  });

  it('a student cannot read a sibling\'s student doc', async () => {
    await assertFails(getDoc(doc(asLuke(), 'students/layla')));
  });

  it('a student cannot write to any student doc', async () => {
    await assertFails(updateDoc(doc(asLuke(), 'students/luke'), { grade: 9 }));
  });

  it('a student CAN update their own cosmetic theme, and only that', async () => {
    await assertSucceeds(
      updateDoc(doc(asLuke(), 'students/luke'), { theme: { palette: 'space', avatar: '🦖' } })
    );
    await assertFails(
      updateDoc(doc(asLuke(), 'students/luke'), { theme: { palette: 'space' }, grade: 12 })
    );
    await assertFails(
      updateDoc(doc(asLayla(), 'students/luke'), { theme: { palette: 'space' } })
    );
  });

  it('the parent can read and write any student doc', async () => {
    await assertSucceeds(getDoc(doc(asAbi(), 'students/layla')));
    await assertSucceeds(updateDoc(doc(asAbi(), 'students/layla'), { grade: 9 }));
  });

  it('an unauthenticated request is denied', async () => {
    await assertFails(getDoc(doc(asAnon(), 'students/luke')));
  });
});

describe('assignments', () => {
  it('a student can read their own assignment', async () => {
    await assertSucceeds(getDoc(doc(asLuke(), 'assignments/luke-1')));
  });

  it('a student cannot read a sibling\'s assignment', async () => {
    await assertFails(getDoc(doc(asLuke(), 'assignments/layla-1')));
  });

  it('a student can flip their own assignment status to in_progress', async () => {
    await assertSucceeds(
      updateDoc(doc(asLuke(), 'assignments/luke-1'), {
        status: 'in_progress',
        updatedAt: 'now',
      })
    );
  });

  it('a student can record time-tracking fields on their own assignment', async () => {
    await assertSucceeds(
      updateDoc(doc(asLuke(), 'assignments/luke-1'), {
        status: 'in_progress',
        startedAt: 'now',
        updatedAt: 'now',
      })
    );
    await assertSucceeds(
      updateDoc(doc(asLuke(), 'assignments/luke-1'), {
        status: 'submitted',
        actualMinutes: 37,
        updatedAt: 'now',
      })
    );
  });

  it('a student cannot change the scheduledDate on their own assignment', async () => {
    await assertFails(
      updateDoc(doc(asLuke(), 'assignments/luke-1'), { scheduledDate: '2026-08-18' })
    );
  });

  it('a student cannot read or change the keyPath field', async () => {
    await assertFails(
      updateDoc(doc(asLuke(), 'assignments/luke-1'), {
        status: 'in_progress',
        keyPath: 'keys/hacked.pdf',
      })
    );
  });

  it('a student cannot set an arbitrary/invalid status', async () => {
    await assertFails(
      updateDoc(doc(asLuke(), 'assignments/luke-1'), { status: 'graded' })
    );
  });

  it('a student cannot create a new assignment for themselves', async () => {
    await assertFails(
      setDoc(doc(asLuke(), 'assignments/luke-2'), {
        studentId: 'luke',
        subjectId: 'ela',
        scheduledDate: '2026-08-18',
        status: 'not_started',
      })
    );
  });

  it('the parent can reschedule any assignment', async () => {
    await assertSucceeds(
      updateDoc(doc(asAbi(), 'assignments/luke-1'), { scheduledDate: '2026-08-19' })
    );
  });
});

describe('reports and mail', () => {
  it('the parent can read a nightly report; a student cannot', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'reports/2026-08-17'), { summary: 'x' });
    });
    await assertSucceeds(getDoc(doc(asAbi(), 'reports/2026-08-17')));
    await assertFails(getDoc(doc(asLuke(), 'reports/2026-08-17')));
  });

  it('nobody can write reports or mail from the client, even the parent', async () => {
    await assertFails(setDoc(doc(asAbi(), 'reports/2026-08-18'), { summary: 'x' }));
    await assertFails(setDoc(doc(asAbi(), 'mail/m1'), { to: 'x@y.z' }));
    await assertFails(setDoc(doc(asAbi(), 'outbox/o1'), { to: 'x@y.z' }));
    await assertFails(setDoc(doc(asLuke(), 'mail/m2'), { to: 'x@y.z' }));
  });
});

describe('memory plan', () => {
  it('kids read memory items but cannot write; parent curates', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'memoryItems/m1'), { track: 'bible', week: 1 });
      await setDoc(doc(context.firestore(), 'memoryAttempts/a1'), { studentId: 'luke', result: 'pass' });
    });
    await assertSucceeds(getDoc(doc(asLuke(), 'memoryItems/m1')));
    await assertFails(updateDoc(doc(asLuke(), 'memoryItems/m1'), { week: 2 }));
    await assertSucceeds(updateDoc(doc(asAbi(), 'memoryItems/m1'), { week: 1 }));
    await assertSucceeds(getDoc(doc(asLuke(), 'memoryAttempts/a1')));
    await assertFails(getDoc(doc(asLayla(), 'memoryAttempts/a1')));
    await assertFails(setDoc(doc(asLuke(), 'memoryAttempts/a2'), { studentId: 'luke', result: 'pass' }));
    await assertSucceeds(setDoc(doc(asAbi(), 'memoryAttempts/a2'), { studentId: 'luke', result: 'pass' }));
  });
});

describe('bugReports', () => {
  it('a kid can file a bug report as themselves, cannot spoof or edit', async () => {
    await assertSucceeds(
      setDoc(doc(asLuke(), 'bugReports/b1'), { reportedBy: 'luke-uid', text: 'button broke' })
    );
    await assertFails(
      setDoc(doc(asLuke(), 'bugReports/b2'), { reportedBy: 'layla-uid', text: 'x' })
    );
    await assertFails(
      updateDoc(doc(asLuke(), 'bugReports/b1'), { text: 'edited' })
    );
    await assertFails(getDoc(doc(asLuke(), 'bugReports/b1')));
    await assertSucceeds(getDoc(doc(asAbi(), 'bugReports/b1')));
  });
});

describe('kidReports', () => {
  it('a kid reads their own weekly report, not a sibling\'s; nobody writes', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'kidReports/luke-2026-08-20'), { studentId: 'luke', headline: 'x' });
    });
    await assertSucceeds(getDoc(doc(asLuke(), 'kidReports/luke-2026-08-20')));
    await assertFails(getDoc(doc(asLayla(), 'kidReports/luke-2026-08-20')));
    await assertSucceeds(getDoc(doc(asAbi(), 'kidReports/luke-2026-08-20')));
    await assertFails(setDoc(doc(asLuke(), 'kidReports/luke-2026-08-21'), { studentId: 'luke' }));
  });
});

describe('grades', () => {
  it('a student can read their own grade', async () => {
    await assertSucceeds(getDoc(doc(asLuke(), 'grades/luke-1')));
  });

  it('a student cannot read a sibling\'s grade', async () => {
    await assertFails(getDoc(doc(asLayla(), 'grades/luke-1')));
  });

  it('a student can never write a grade, even their own', async () => {
    await assertFails(updateDoc(doc(asLuke(), 'grades/luke-1'), { score: 10 }));
  });

  it('the parent can override a grade', async () => {
    await assertSucceeds(updateDoc(doc(asAbi(), 'grades/luke-1'), { overriddenScore: 10 }));
  });
});

describe('submissions', () => {
  it('a student can probe for a not-yet-existing submission without a permission error', async () => {
    // First load of a fresh assignment does a getDoc before any draft exists;
    // that must return "not found", not PERMISSION_DENIED (which would break autosave arming).
    await assertSucceeds(getDoc(doc(asLuke(), 'submissions/luke-brand-new')));
  });

  it('a student can create their own submission', async () => {
    await assertSucceeds(
      setDoc(doc(asLuke(), 'submissions/luke-1'), {
        assignmentId: 'luke-1',
        studentId: 'luke',
        isDraft: true,
      })
    );
  });

  it('a student cannot create a submission claiming to be a sibling', async () => {
    await assertFails(
      setDoc(doc(asLuke(), 'submissions/fake-1'), {
        assignmentId: 'layla-1',
        studentId: 'layla',
        isDraft: true,
      })
    );
  });

  it('a student cannot edit a submission once it is no longer a draft', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'submissions/luke-1'), {
        assignmentId: 'luke-1',
        studentId: 'luke',
        isDraft: false,
      });
    });
    await assertFails(
      updateDoc(doc(asLuke(), 'submissions/luke-1'), { answers: ['changed'] })
    );
  });

  it('a student cannot delete their own submission', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'submissions/luke-1'), {
        assignmentId: 'luke-1',
        studentId: 'luke',
        isDraft: true,
      });
    });
    await assertFails(deleteDoc(doc(asLuke(), 'submissions/luke-1')));
  });
});
