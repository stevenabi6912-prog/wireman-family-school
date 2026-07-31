import { useEffect, useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Abi's per-kid memory work list (verses, poems, facts). Whatever she types
// here appears inside that kid's weekly "recite to Mom" item.
export default function MemoryWork({ students, order }) {
  return (
    <section className="memwork-section">
      <h2>Memory work</h2>
      <p className="daysoff-hint">Whatever you write here shows up in that kid's weekly memory-work item. One item per line works well.</p>
      <div className="memwork-grid">
        {order.map((id) => (
          <MemoryCard key={id} studentId={id} student={students[id]} />
        ))}
      </div>
    </section>
  );
}

function MemoryCard({ studentId, student }) {
  const [text, setText] = useState('');
  const [state, setState] = useState('idle'); // idle | dirty | saving | saved

  useEffect(() => {
    setText(student?.memoryWork ?? '');
    setState('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function save() {
    setState('saving');
    await updateDoc(doc(db, 'students', studentId), {
      memoryWork: text,
      updatedAt: serverTimestamp(),
    });
    setState('saved');
  }

  return (
    <div className="memwork-card">
      <h3>{student?.name ?? studentId}</h3>
      <textarea
        rows={5}
        value={text}
        placeholder={'e.g.\nPsalm 23:1-3\nThe 47 prepositions song\nSOTW Ch. 4 review cards'}
        onChange={(e) => { setText(e.target.value); setState('dirty'); }}
      />
      <button onClick={save} disabled={state !== 'dirty'}>
        {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : 'Save'}
      </button>
    </div>
  );
}
