import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'wireman-homeschool' });
const db = admin.firestore();

await db.doc('families/wireman').set({
  schoolYearStart: '2026-08-17',
  schoolYearEnd: '2027-06-03',
  schoolDays: [1, 2, 3, 4],
  dailySubjectOrder: ['bible', 'math', 'ela', 'history', 'science', 'writing'],
  holidays: [
    { start: '2026-09-07', end: '2026-09-07', label: "Labor Day" },
    { start: '2026-11-23', end: '2026-11-27', label: 'Thanksgiving' },
    { start: '2026-12-21', end: '2027-01-02', label: 'Christmas' },
    { start: '2027-02-15', end: '2027-02-15', label: "Presidents' Day" },
    { start: '2027-03-29', end: '2027-04-02', label: 'Easter/Spring' },
  ],
  blockouts: [],
});

const students = [
  { id: 'luke', name: 'Luke', grade: 8, dailyHoursBudget: 6, uiDensity: 'standard', mathRemediation: { active: true, approach: 'slower-pace' } },
  { id: 'layla', name: 'Layla', grade: 8, dailyHoursBudget: 6, uiDensity: 'standard', mathRemediation: { active: true, approach: 'slower-pace' } },
  { id: 'logan', name: 'Logan', grade: 5, dailyHoursBudget: 5, uiDensity: 'standard' },
  { id: 'lazarus', name: 'Lazarus', grade: 3, dailyHoursBudget: 4, uiDensity: 'large-low-word' },
];
for (const s of students) await db.doc(`students/${s.id}`).set({ subjectOrder: null, active: true, ...s });

const subjects = [
  { id: 'bible', name: 'Bible', contentSource: 'physical-book', gradable: false },
  { id: 'math', name: 'Math', contentSource: 'video-link-placeholder', gradable: true, platformUrl: 'https://digital.demmelearning.com/' },
  { id: 'ela', name: 'Grammar & Writing', contentSource: 'storage-pdf', gradable: true },
  { id: 'history', name: 'History', contentSource: 'storage-pdf', gradable: false },
  { id: 'science', name: 'Science', contentSource: 'storage-pdf', gradable: false },
  { id: 'writing', name: 'Writing', contentSource: 'storage-pdf', gradable: true },
];
for (const s of subjects) await db.doc(`subjects/${s.id}`).set(s);
console.log('Production config seeded: family, 4 students, 6 subjects.');
