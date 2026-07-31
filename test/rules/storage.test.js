import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes } from 'firebase/storage';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'homeschool-storage-rules-test',
    storage: {
      rules: readFileSync('storage.rules', 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearStorage();
});

// Role/studentId come from Auth custom claims, matching the real app's provisioning.
function asLuke() {
  return testEnv.authenticatedContext('luke-uid', { role: 'student', studentId: 'luke' }).storage();
}
function asAbi() {
  return testEnv.authenticatedContext('abi-uid', { role: 'parent' }).storage();
}
function asAnon() {
  return testEnv.unauthenticatedContext().storage();
}

const bytes = new Uint8Array([1, 2, 3]);

describe('curriculum', () => {
  it('a signed-in student can read curriculum PDFs', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(ref(context.storage(), 'curriculum/ela/8/writing-workbook.pdf'), bytes);
    });
    await assertSucceeds(getBytes(ref(asLuke(), 'curriculum/ela/8/writing-workbook.pdf')));
  });

  it('a student cannot upload/overwrite curriculum', async () => {
    await assertFails(uploadBytes(ref(asLuke(), 'curriculum/ela/8/writing-workbook.pdf'), bytes));
  });

  it('an unauthenticated request cannot read curriculum', async () => {
    await assertFails(getBytes(ref(asAnon(), 'curriculum/ela/8/writing-workbook.pdf')));
  });
});

describe('answer keys', () => {
  it('a student can never read an answer key', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(ref(context.storage(), 'keys/ela/8/answers.pdf'), bytes);
    });
    await assertFails(getBytes(ref(asLuke(), 'keys/ela/8/answers.pdf')));
  });

  it('the parent can read answer keys', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(ref(context.storage(), 'keys/ela/8/answers.pdf'), bytes);
    });
    await assertSucceeds(getBytes(ref(asAbi(), 'keys/ela/8/answers.pdf')));
  });
});

describe('submissions', () => {
  it('a student can upload to their own submissions folder', async () => {
    await assertSucceeds(
      uploadBytes(ref(asLuke(), 'submissions/luke/2026-08-17/math-scratch.jpg'), bytes)
    );
  });

  it('a student cannot upload into a sibling\'s submissions folder', async () => {
    await assertFails(
      uploadBytes(ref(asLuke(), 'submissions/layla/2026-08-17/math-scratch.jpg'), bytes)
    );
  });

  it('a student cannot read a sibling\'s submission', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(ref(context.storage(), 'submissions/layla/2026-08-17/math-scratch.jpg'), bytes);
    });
    await assertFails(getBytes(ref(asLuke(), 'submissions/layla/2026-08-17/math-scratch.jpg')));
  });

  it('the parent can read any student\'s submission', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(ref(context.storage(), 'submissions/luke/2026-08-17/math-scratch.jpg'), bytes);
    });
    await assertSucceeds(getBytes(ref(asAbi(), 'submissions/luke/2026-08-17/math-scratch.jpg')));
  });
});
