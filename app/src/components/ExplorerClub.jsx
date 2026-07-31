import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { playDing, playFanfare } from '../lib/sounds';
import './ExplorerClub.css';

const SUGGESTIONS = ['Sharks', 'Volcanoes', 'Space rockets', 'Knights', 'How candy is made', 'Tornadoes', 'Dinosaurs', 'Deep sea creatures'];

// Pick any topic, get a fresh mini-lesson written on the spot.
export default function ExplorerClub({ large }) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState(null);

  async function explore(t) {
    setLoading(true);
    setError(null);
    setLesson(null);
    try {
      const res = await httpsCallable(functions, 'exploreTopic')({ topic: t });
      setLesson(res.data);
      if (!res.data.refused) playDing();
    } catch {
      setError('Hmm, the lesson machine hiccuped — try again!');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div className="explorer-launch">
        <button className="explorer-btn" onClick={() => setOpen(true)}>
          🔭 {large ? 'Explore something cool!' : "Explorer's Club — learn about anything"}
        </button>
      </div>
    );
  }

  return (
    <div className="explorer-box">
      <div className="explorer-head">
        <h3>🔭 Explorer's Club</h3>
        <button className="explorer-close" onClick={() => { setOpen(false); setLesson(null); }}>✕</button>
      </div>

      {!lesson && !loading && (
        <>
          <p className="explorer-hint">{large ? 'What do you want to learn about?' : 'Pick anything — a lesson gets written just for you.'}</p>
          <div className="explorer-entry">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && topic.trim() && explore(topic)}
              placeholder="sharks, volcanoes, trains…"
            />
            <button onClick={() => topic.trim() && explore(topic)} disabled={!topic.trim()}>Go!</button>
          </div>
          <div className="explorer-chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => explore(s)}>{s}</button>
            ))}
          </div>
        </>
      )}

      {loading && <p className="explorer-loading">✍️ Writing your lesson…</p>}
      {error && <p className="explorer-error">{error}</p>}

      {lesson?.refused && <p className="explorer-hint">{lesson.message}</p>}

      {lesson && !lesson.refused && (
        <div className="explorer-lesson">
          <h2>{lesson.title}</h2>
          {lesson.lesson?.map((p, i) => <p key={i}>{p}</p>)}
          <h4>🤯 Fun facts</h4>
          <ul>{lesson.funFacts?.map((f, i) => <li key={i}>{f}</li>)}</ul>
          <h4>🎯 Quick quiz</h4>
          {lesson.quiz?.map((q, i) => <QuizQ key={i} q={q} />)}
          <p className="explorer-hint">Now go tell Mom the coolest thing you learned!</p>
          <button className="explorer-again" onClick={() => { setLesson(null); setTopic(''); }}>Explore something else →</button>
        </div>
      )}
    </div>
  );
}

function QuizQ({ q }) {
  const [picked, setPicked] = useState(null);
  return (
    <div className="explorer-quiz">
      <p className="explorer-q">{q.q}</p>
      <div className="trivia-answers">
        {q.a.map((ans, idx) => (
          <button
            key={idx}
            className={picked === null ? '' : idx === q.c ? 'trivia-right' : picked === idx ? 'trivia-wrong' : ''}
            onClick={() => {
              if (picked !== null) return;
              setPicked(idx);
              if (idx === q.c) playFanfare();
            }}
          >
            {ans}
          </button>
        ))}
      </div>
    </div>
  );
}
