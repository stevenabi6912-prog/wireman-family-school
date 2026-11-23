import './QuizForm.css';

// A test taken right on the page: blanks, matching, multiple choice,
// true/false and a written answer. The answers live as one numbered text
// block ("5. b — Greenland") so they save, turn in and grade exactly like
// typed answers always have.
export function parseAnswers(text) {
  const out = {};
  for (const line of (text ?? '').split('\n')) {
    const m = line.match(/^(\d+)\.\s?(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function toText(quiz, answers) {
  return quiz.sections
    .flatMap((s) => s.questions)
    .filter((q) => (answers[q.n] ?? '') !== '')
    // no trimming: the text round-trips on every keystroke, so a trimmed
    // trailing space could never be typed
    .map((q) => `${q.n}. ${answers[q.n].replace(/\n+/g, ' ')}`)
    .join('\n');
}

const letterOf = (value) => (value ?? '').match(/^([a-h])\b/)?.[1] ?? '';

export default function QuizForm({ quiz, text, onChange, name }) {
  const answers = parseAnswers(text);
  const set = (n, value) => onChange(toText(quiz, { ...answers, [n]: value }));
  const total = quiz.sections.reduce((n, s) => n + s.questions.length, 0);
  const answered = quiz.sections.flatMap((s) => s.questions).filter((q) => (answers[q.n] ?? '').trim()).length;

  return (
    <div className="quiz">
      {quiz.sections.map((sec, i) => (
        <section key={i} className="quiz-section">
          <h4>{String.fromCharCode(65 + i)}. {sec.heading}</h4>

          {sec.type === 'match' && (
            <ul className="quiz-options">
              {sec.options.map((o) => <li key={o.k}><strong>{o.k}.</strong> {o.t}</li>)}
            </ul>
          )}

          {sec.questions.map((q) => {
            const value = answers[q.n] ?? '';
            return (
              <div key={q.n} className={`quiz-q ${value.trim() ? 'quiz-q-done' : ''}`}>
                <p className="quiz-prompt"><span className="quiz-n">{q.n}.</span> {q.prompt}</p>

                {sec.type === 'blank' && (
                  <input className="quiz-input" value={value} placeholder="your answer" onChange={(e) => set(q.n, e.target.value)} />
                )}

                {sec.type === 'match' && (
                  <select className="quiz-select" value={letterOf(value)} onChange={(e) => {
                    const o = sec.options.find((x) => x.k === e.target.value);
                    set(q.n, o ? `${o.k} — ${o.t}` : '');
                  }}>
                    <option value="">choose…</option>
                    {sec.options.map((o) => <option key={o.k} value={o.k}>{o.k}. {o.t}</option>)}
                  </select>
                )}

                {sec.type === 'mc' && (
                  <div className="quiz-choices">
                    {q.choices.map((c) => (
                      <label key={c.k} className={letterOf(value) === c.k ? 'quiz-picked' : ''}>
                        <input type="radio" name={`${name}-${q.n}`} checked={letterOf(value) === c.k} onChange={() => set(q.n, `${c.k} — ${c.t}`)} />
                        <span><strong>{c.k}.</strong> {c.t}</span>
                      </label>
                    ))}
                  </div>
                )}

                {sec.type === 'tf' && (
                  <div className="quiz-tf">
                    {['true', 'false'].map((v) => (
                      <label key={v} className={value === v ? 'quiz-picked' : ''}>
                        <input type="radio" name={`${name}-${q.n}`} checked={value === v} onChange={() => set(q.n, v)} />
                        <span>{v === 'true' ? 'True' : 'False'}</span>
                      </label>
                    ))}
                  </div>
                )}

                {sec.type === 'essay' && (
                  <textarea className="quiz-essay" rows={5} value={value} placeholder="Write your answer in complete sentences." onChange={(e) => set(q.n, e.target.value)} />
                )}
              </div>
            );
          })}
        </section>
      ))}
      <p className="quiz-count">{answered} of {total} answered</p>
    </div>
  );
}
