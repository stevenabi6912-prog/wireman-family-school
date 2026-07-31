import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes } from 'firebase/storage';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'homeschool-theme-rules-test',
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

function asLuke() {
  return testEnv.authenticatedContext('luke-uid', { role: 'student', studentId: 'luke' }).storage();
}
function asLayla() {
  return testEnv.authenticatedContext('layla-uid', { role: 'student', studentId: 'layla' }).storage();
}

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

describe('theme header pictures', () => {
  it('a student can upload an image to their own themes folder', async () => {
    await assertSucceeds(
      uploadBytes(ref(asLuke(), 'themes/luke/header-1.png'), png, { contentType: 'image/png' })
    );
  });

  it('a student cannot upload into a sibling\'s themes folder', async () => {
    await assertFails(
      uploadBytes(ref(asLuke(), 'themes/layla/header-1.png'), png, { contentType: 'image/png' })
    );
  });

  it('non-image uploads are rejected', async () => {
    await assertFails(
      uploadBytes(ref(asLuke(), 'themes/luke/sneaky.pdf'), png, { contentType: 'application/pdf' })
    );
  });

  it('any signed-in family member can view a theme picture', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(ref(context.storage(), 'themes/luke/header-1.png'), png, { contentType: 'image/png' });
    });
    await assertSucceeds(getBytes(ref(asLayla(), 'themes/luke/header-1.png')));
  });
});
