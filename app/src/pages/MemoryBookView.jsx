import {
  SCHOOL_YEAR_LABEL, TOTAL_SCHOOL_DAYS, SUBJECT_META, subjectName, prettyDate,
} from './memoryBookData';

// The book itself — everything here is presentation over an already-loaded
// `book` (see loadMemoryBook), so it renders the same on screen and on paper.

const money = (n) => {
  const v = Number(n) || 0;
  const body = Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${v < 0 ? '−' : ''}$${body}`;
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function duration(minutes) {
  if (minutes == null) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function SectionHead({ kicker, title, children }) {
  return (
    <header className="mb-head">
      <p className="mb-kicker">{kicker}</p>
      <h2 className="mb-title">{title}</h2>
      {children && <p className="mb-lede">{children}</p>}
    </header>
  );
}

function Cover({ student, theme, headerImageUrl, numbers }) {
  const finished = numbers.daysCompleted >= TOTAL_SCHOOL_DAYS;
  return (
    <section className="mb-sheet mb-cover">
      <div className="mb-cover-inner">
        <p className="mb-cover-school">Wireman Family School</p>
        <div className="mb-cover-avatar" aria-hidden="true">{theme.avatar}</div>
        <h1 className="mb-cover-name">{student.name}</h1>
        <p className="mb-cover-grade">
          {student.grade ? `Grade ${student.grade} · ` : ''}{SCHOOL_YEAR_LABEL}
        </p>
        <div className="mb-cover-rule" />
        <p className="mb-cover-book">A Memory Book</p>
        {headerImageUrl && (
          <img
            className="mb-cover-photo"
            src={headerImageUrl}
            alt={`${student.name}'s own header picture`}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}
        {numbers.firstDate && (
          <p className="mb-cover-dates">
            {prettyDate(numbers.firstDate)} – {prettyDate(numbers.lastDate)}
            {finished ? '' : ' · the year so far'}
          </p>
        )}
      </div>
    </section>
  );
}

function Numbers({ student, numbers }) {
  const pct = Math.round((numbers.daysCompleted / TOTAL_SCHOOL_DAYS) * 100);
  const tiles = [
    { value: numbers.hours.toLocaleString('en-US'), label: numbers.hours === 1 ? 'hour of work' : 'hours of work' },
    { value: numbers.itemsFinished.toLocaleString('en-US'), label: 'assignments finished' },
    numbers.bestStreak > 0 && { value: numbers.bestStreak, label: `best streak — ${numbers.bestStreak === 1 ? 'day' : 'days'} in a row, everything done` },
    numbers.fastestDayMinutes != null && { value: duration(numbers.fastestDayMinutes), label: 'fastest full day of school' },
    numbers.earliestFinish && { value: numbers.earliestFinish, label: 'earliest finish to a school day' },
  ].filter(Boolean);

  return (
    <section className="mb-sheet">
      <SectionHead kicker="The year in figures" title="By the numbers">
        What {student.name}&rsquo;s year adds up to.
      </SectionHead>
      <div className="mb-days">
        <div className="mb-days-figure">
          <span className="mb-days-num">{numbers.daysCompleted}</span>
          <span className="mb-days-of">of {TOTAL_SCHOOL_DAYS} school days completed</span>
        </div>
        <div className="mb-days-track" role="img" aria-label={`${pct}% of the school year`}>
          <div className="mb-days-fill" style={{ width: `${Math.max(pct, 2)}%` }} />
        </div>
      </div>
      <div className="mb-tiles">
        {tiles.map((t) => (
          <div key={t.label} className="mb-tile">
            <span className="mb-tile-num">{t.value}</span>
            <span className="mb-tile-label">{t.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Subjects({ subjects }) {
  if (subjects.length === 0) return null;
  return (
    <section className="mb-sheet mb-keep">
      <SectionHead kicker="What we studied" title="Subjects">
        Every subject, what got done in it, and how it went.
      </SectionHead>
      <div className="mb-subjects">
        {subjects.map((s) => (
          <div key={s.id} className="mb-subject">
            <span className="mb-subject-emoji" aria-hidden="true">{SUBJECT_META[s.id]?.emoji ?? '📚'}</span>
            <div className="mb-subject-main">
              <div className="mb-subject-top">
                <span className="mb-subject-name">{subjectName(s.id)}</span>
                <span className="mb-subject-count">
                  {plural(s.items, 'assignment')}{s.hours > 0 ? ` · ${plural(s.hours, 'hour')}` : ''}
                </span>
              </div>
              {s.avg != null && (
                <div className="mb-subject-bar" role="img" aria-label={`${s.avg}% average`}>
                  <div className="mb-subject-fill" style={{ width: `${Math.min(100, Math.max(s.avg, 3))}%` }} />
                </div>
              )}
            </div>
            <span className="mb-subject-avg">
              {s.avg != null ? (
                <>
                  <strong>{s.avg}%</strong>
                  <small>avg of {s.graded}</small>
                </>
              ) : (
                <small>not graded</small>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Gallery({ student, gallery }) {
  if (gallery.status === 'ready' && gallery.photos.length === 0 && !gallery.heicSkipped) return null;
  return (
    <section className="mb-sheet mb-break">
      <SectionHead kicker="Proudest pages" title="Best work">
        Pages {student.name} can be proud of, from across the year.
      </SectionHead>
      {gallery.status !== 'ready' && (
        <p className="mb-pending mb-screen-only">📷 Picking out {student.name}&rsquo;s best pages…</p>
      )}
      {gallery.heicSkipped > 0 && (
        <p className="mb-pending mb-screen-only">
          {plural(gallery.heicSkipped, 'more page')} of {student.name}&rsquo;s {gallery.heicSkipped === 1 ? 'was' : 'were'} taken
          as iPhone HEIC photos, which this browser can&rsquo;t show. Open the Memory Book in Safari to
          include them.
        </p>
      )}
      <div className="mb-gallery">
        {gallery.photos.map((p) => (
          <figure key={p.id} className="mb-photo">
            <div className="mb-photo-frame">
              <img src={p.url} alt={p.title} />
            </div>
            <figcaption>
              <span className="mb-photo-title">{p.title}</span>
              <span className="mb-photo-meta">
                {subjectName(p.subjectId)} · {prettyDate(p.date)}
              </span>
              <span className="mb-photo-score">
                {p.maxScore > 0 ? `${p.score}/${p.maxScore} · ` : ''}{p.pct}%
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Books({ books }) {
  if (books.length === 0) return null;
  const total = books.reduce((s, b) => s + b.count, 0);
  return (
    <section className="mb-sheet mb-break">
      <SectionHead kicker="On the shelf" title="Books & reading">
        {plural(books.length, 'book')} on the shelf this year, {plural(total, 'reading')} finished.
      </SectionHead>
      <ul className="mb-books">
        {books.map((b) => (
          <li key={b.title} className="mb-shelf-book">
            <span className="mb-book-spine" aria-hidden="true">📕</span>
            <span className="mb-book-main">
              <span className="mb-book-title">{b.title}</span>
              <span className="mb-book-dates">
                {b.first === b.last
                  ? prettyDate(b.first)
                  : `${prettyDate(b.first, { year: false })} – ${prettyDate(b.last)}`}
              </span>
            </span>
            <span className="mb-book-count">
              <strong>{b.count}</strong> {b.unit}{b.count === 1 ? '' : 's'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Memory({ student, memory }) {
  const { mastered, recited } = memory;
  if (mastered.length === 0 && recited.length === 0) return null;
  return (
    <section className="mb-sheet">
      <SectionHead kicker="By heart" title="Learned by heart">
        {mastered.length > 0
          ? `Mastered means recited from memory twice, at least two weeks apart. ${student.name} has ${plural(mastered.length, 'piece')} down cold.`
          : `Recited from memory for Mom. A piece counts as mastered once it's recited again two weeks later.`}
      </SectionHead>
      {mastered.length > 0 && (
        <div className="mb-mastered">
          {mastered.map((m) => (
            <div key={m.id} className="mb-verse">
              <p className="mb-verse-title">
                <span aria-hidden="true">{m.emoji}</span> {m.title}
                {(m.pieceRef || m.reference) && <span className="mb-verse-ref"> · {m.pieceRef || m.reference}</span>}
              </p>
              {m.text && <blockquote className="mb-verse-text">{m.text}</blockquote>}
            </div>
          ))}
        </div>
      )}
      {recited.length > 0 && (
        <>
          {mastered.length > 0 && <h3 className="mb-subhead">Also recited from memory</h3>}
          <ul className="mb-recited">
            {recited.map((m) => (
              <li key={m.id} className="mb-recited-item">
                <span aria-hidden="true">{m.emoji}</span> {m.title}
                {m.pieceRef && <span className="mb-verse-ref"> · {m.pieceRef}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Weeks({ weeks }) {
  if (weeks.length === 0) return null;
  return (
    <section className="mb-sheet mb-break">
      <SectionHead kicker="Week by week" title="My weeks">
        The headline from each week&rsquo;s report, start to finish.
      </SectionHead>
      <ol className="mb-weeks">
        {weeks.map((w) => (
          <li key={w.weekEnd} className="mb-week">
            <span className="mb-week-date">{prettyDate(w.weekEnd, { year: false })}</span>
            <div className="mb-week-body">
              <p className="mb-week-headline">{w.headline}</p>
              {w.win && <p className="mb-week-win">⭐ {w.win}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Cheers({ student, cheers }) {
  if (cheers.received.length === 0 && cheers.sentCount === 0) return null;
  const list = (rows) => rows.map((r) => `${r.name} ×${r.n}`).join(' · ');
  return (
    <section className="mb-sheet">
      <SectionHead kicker="Brothers & sisters" title="Cheers">
        Brothers and sisters cheering each other on.
      </SectionHead>
      {cheers.received.length > 0 && (
        <div className="mb-cheer-block">
          <h3 className="mb-subhead">{plural(cheers.received.length, 'cheer')} for {student.name}</h3>
          <div className="mb-stickers" aria-hidden="true">
            {cheers.received.map((c, i) => (
              <span key={i} className="mb-sticker" title={`${c.from} · ${c.date}`}>{c.sticker}</span>
            ))}
          </div>
          <p className="mb-cheer-line">From {list(cheers.receivedFrom)}</p>
        </div>
      )}
      {cheers.sentCount > 0 && (
        <div className="mb-cheer-block">
          <h3 className="mb-subhead">{plural(cheers.sentCount, 'cheer')} {student.name} sent</h3>
          <p className="mb-cheer-line">
            To {list(cheers.sentTo)}
            {cheers.favoriteSticker ? ` · favorite sticker ${cheers.favoriteSticker}` : ''}
          </p>
        </div>
      )}
    </section>
  );
}

function Business({ student, business }) {
  if (!business) return null;
  return (
    <section className="mb-sheet mb-break">
      <SectionHead kicker="Open for business" title="My business">
        {business.name} — a real business, with real books.
      </SectionHead>
      <div className="mb-ledger">
        <div className="mb-ledger-cell">
          <span className="mb-ledger-label">Income</span>
          <span className="mb-ledger-num">{money(business.income)}</span>
        </div>
        <div className="mb-ledger-cell">
          <span className="mb-ledger-label">Expenses</span>
          <span className="mb-ledger-num">{money(business.expenses)}</span>
        </div>
        <div className="mb-ledger-cell mb-ledger-profit">
          <span className="mb-ledger-label">{business.profit < 0 ? 'Net so far' : 'Profit'}</span>
          <span className="mb-ledger-num">{money(business.profit)}</span>
        </div>
      </div>
      {business.familyCovered > 0 && (
        <p className="mb-biz-note">
          Mom &amp; Dad fronted {money(business.familyCovered)} of the start-up costs.
        </p>
      )}
      {business.facts.length > 0 && (
      <div className="mb-facts">
        {business.facts.map((f) => (
          <div key={f.label} className="mb-fact">
            <strong>{f.money ? money(f.value) : f.value}</strong>
            <span>{f.label}</span>
          </div>
        ))}
      </div>
      )}
      {(business.goalTarget || business.vision) && (
        <div className="mb-biz-goal">
          {business.goalTarget && (
            <p>
              <strong>Saving for:</strong> {money(business.goalTarget)}
              {business.goalWhy ? ` — “${business.goalWhy}”` : ''}
            </p>
          )}
          {business.vision && <p><strong>The vision:</strong> “{business.vision}”</p>}
        </div>
      )}
      {business.report && (
        <div className="mb-report">
          <h3 className="mb-subhead">The annual report, in {student.name}&rsquo;s own words</h3>
          <p className="mb-report-text">{business.report}</p>
        </div>
      )}
    </section>
  );
}

function Note({ student, note, onNoteChange, onNoteSave, noteStatus }) {
  const empty = !note.trim();
  return (
    <section className="mb-sheet mb-break mb-letter">
      <SectionHead kicker="One last page" title="A note from Mom & Dad" />
      <p className="mb-letter-greeting">Dear {student.name},</p>
      <div className="mb-screen-only">
        <textarea
          className="mb-letter-input"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          onBlur={onNoteSave}
          rows={Math.max(8, note.split('\n').length + 2)}
          placeholder={`What do you want ${student.name} to remember about this year?`}
        />
        <div className="mb-letter-actions">
          <button type="button" className="mb-btn" onClick={onNoteSave} disabled={noteStatus === 'saving'}>
            Save note
          </button>
          <span className="mb-letter-status" role="status">
            {noteStatus === 'saving' && 'Saving…'}
            {noteStatus === 'saved' && '✓ Saved'}
            {noteStatus === 'dirty' && 'Not saved yet'}
            {noteStatus === 'error' && "Couldn't save — check the connection and try again"}
          </span>
        </div>
      </div>
      {/* Paper gets the letter as text, or ruled lines to write one by hand. */}
      <div className="mb-print-only">
        {empty ? (
          <div className="mb-letter-lines">
            {Array.from({ length: 16 }, (_, i) => <div key={i} className="mb-letter-line" />)}
          </div>
        ) : (
          <p className="mb-letter-text">{note}</p>
        )}
      </div>
      <p className="mb-letter-sign">With all our love,<br />Mom &amp; Dad</p>
    </section>
  );
}

export default function MemoryBookPages({
  book, theme, gallery, note, onNoteChange, onNoteSave, noteStatus,
}) {
  const { student } = book;
  const vars = {
    '--mb-accent': theme.colors.accent,
    '--mb-accent-soft': theme.colors.accentSoft,
    '--mb-cover': theme.colors.header,
  };
  return (
    <article className="mb-book" style={vars}>
      <Cover student={student} theme={theme} headerImageUrl={book.headerImageUrl} numbers={book.numbers} />
      {book.numbers.itemsFinished === 0 ? (
        <section className="mb-sheet">
          <p className="mb-pending">
            {student.name}&rsquo;s book starts filling in as soon as the first assignment is finished.
          </p>
        </section>
      ) : (
        <>
          <Numbers student={student} numbers={book.numbers} />
          <Subjects subjects={book.subjects} />
          <Gallery student={student} gallery={gallery} />
          <Books books={book.books} />
          <Memory student={student} memory={book.memory} />
          <Weeks weeks={book.weeks} />
          <Cheers student={student} cheers={book.cheers} />
          <Business student={student} business={book.business} />
        </>
      )}
      <Note
        student={student}
        note={note}
        onNoteChange={onNoteChange}
        onNoteSave={onNoteSave}
        noteStatus={noteStatus}
      />
      <p className="mb-colophon">Wireman Family School · {SCHOOL_YEAR_LABEL}</p>
    </article>
  );
}
