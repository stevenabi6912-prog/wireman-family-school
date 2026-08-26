import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  collection, doc, onSnapshot, addDoc, updateDoc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { todayISO } from '../lib/assignments';
import './BusinessHQ.css';

// Luke's real business, run for real: customers, jobs, a ledger that tracks
// money until it actually lands in his account, and the car fund. The
// entrepreneurship lessons point here — this page IS the workbook.

const HOLDERS = [
  ['me-cash', '💵 Cash in my pocket'],
  ['mom', '👩 Mom is holding it'],
  ['dad', '👨 Dad is holding it'],
  ['bank', '🏦 In my account'],
];
const holderLabel = (h) => (HOLDERS.find(([k]) => k === h)?.[1] ?? h);

const EXPENSE_CATEGORIES = ['gas (pay Dad back)', 'equipment', 'supplies', 'other'];

const money = (n) => `$${(Number(n) || 0).toFixed(2).replace(/\.00$/, '')}`;

export default function BusinessHQ() {
  const { studentId: ownStudentId, role } = useAuth();
  const { kidId } = useParams();
  const studentId = kidId ?? ownStudentId;
  const parentView = role === 'parent';

  const [biz, setBiz] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [txns, setTxns] = useState([]);
  const [tab, setTab] = useState('money');

  useEffect(() => {
    if (!studentId) return;
    const unsubs = [
      onSnapshot(doc(db, 'businesses', studentId), (s) => setBiz(s.exists() ? s.data() : {})),
      onSnapshot(collection(db, 'businesses', studentId, 'customers'), (s) =>
        setCustomers(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name > b.name ? 1 : -1)))),
      onSnapshot(collection(db, 'businesses', studentId, 'jobs'), (s) =>
        setJobs(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.date < b.date ? 1 : -1)))),
      onSnapshot(collection(db, 'businesses', studentId, 'transactions'), (s) =>
        setTxns(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.date < b.date ? 1 : -1)))),
    ];
    return () => unsubs.forEach((u) => u());
  }, [studentId]);

  const totals = useMemo(() => {
    const income = txns.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const expenses = txns.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
    const inTransit = txns.filter((t) => t.type === 'income' && t.holder !== 'bank');
    return { income, expenses, profit: income - expenses, inTransit };
  }, [txns]);

  if (!studentId) return <div className="loading-screen">Loading…</div>;

  const bizName = biz?.name || "Luke's Lawn Care";

  return (
    <div className="biz-screen">
      <header className="biz-header">
        <Link className="biz-back" to={parentView ? '/dashboard' : '/today'}>← Back to {parentView ? 'dashboard' : 'my day'}</Link>
        <h1>🚜 {bizName} <span className="biz-sub">Business HQ</span></h1>
        <div className="biz-totals">
          <span className="biz-chip">Income {money(totals.income)}</span>
          <span className="biz-chip">Expenses {money(totals.expenses)}</span>
          <span className={`biz-chip biz-chip-profit ${totals.profit < 0 ? 'biz-neg' : ''}`}>Profit {money(totals.profit)}</span>
        </div>
      </header>

      <nav className="biz-tabs">
        {[['money', '📒 Money'], ['jobs', '🗓️ Jobs'], ['customers', '👥 Customers'], ['goal', '🎯 Car fund']].map(([k, label]) => (
          <button key={k} className={tab === k ? 'biz-tab biz-tab-on' : 'biz-tab'} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>

      {tab === 'money' && <MoneyTab studentId={studentId} txns={txns} totals={totals} />}
      {tab === 'jobs' && <JobsTab studentId={studentId} jobs={jobs} customers={customers} biz={biz} />}
      {tab === 'customers' && <CustomersTab studentId={studentId} customers={customers} />}
      {tab === 'goal' && <GoalTab studentId={studentId} biz={biz} totals={totals} />}
    </div>
  );
}

// ---- Money: the ledger. Every dollar written down, tracked until it lands ----
function MoneyTab({ studentId, txns, totals }) {
  const [adding, setAdding] = useState(null); // 'income' | 'expense' | null
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [holder, setHolder] = useState('me-cash');

  async function save() {
    if (!Number(amount)) return;
    await addDoc(collection(db, 'businesses', studentId, 'transactions'), {
      type: adding,
      amount: Number(amount),
      note,
      category: adding === 'expense' ? category : (note || 'income'),
      holder: adding === 'income' ? holder : 'bank',
      date: todayISO(),
      createdAt: serverTimestamp(),
    });
    setAdding(null); setAmount(''); setNote('');
  }

  async function landed(t) {
    await updateDoc(doc(db, 'businesses', studentId, 'transactions', t.id), { holder: 'bank' });
  }

  return (
    <section className="biz-panel">
      {totals.inTransit.length > 0 && (
        <div className="biz-transit">
          <h3>🕵️ Money on the move — chase it until it lands!</h3>
          {totals.inTransit.map((t) => (
            <div key={t.id} className="biz-transit-row">
              <span>{money(t.amount)} — {t.note || t.category} <em>({holderLabel(t.holder)} since {t.date})</em></span>
              <button onClick={() => landed(t)}>It's in my account ✓</button>
            </div>
          ))}
        </div>
      )}

      <div className="biz-actions">
        <button className="biz-btn" onClick={() => { setAdding('income'); setAmount(''); }}>+ Money in</button>
        <button className="biz-btn biz-btn-ghost" onClick={() => { setAdding('expense'); setAmount(''); }}>− Expense</button>
      </div>

      {adding && (
        <div className="biz-form">
          <label>Amount $<input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          {adding === 'expense' ? (
            <label>What for
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          ) : (
            <label>Where is it right now?
              <select value={holder} onChange={(e) => setHolder(e.target.value)}>
                {HOLDERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          )}
          <label>Note<input value={note} onChange={(e) => setNote(e.target.value)} placeholder={adding === 'income' ? 'e.g. Mr. Smith paid for last mow' : 'e.g. gas for the mower'} /></label>
          <button className="biz-btn" onClick={save} disabled={!Number(amount)}>Save it</button>
          <button className="biz-cancel" onClick={() => setAdding(null)}>cancel</button>
        </div>
      )}

      <table className="biz-table">
        <thead><tr><th>Date</th><th>What</th><th>Where</th><th className="biz-right">Amount</th></tr></thead>
        <tbody>
          {txns.map((t) => (
            <tr key={t.id} className={t.type === 'expense' ? 'biz-row-exp' : ''}>
              <td>{t.date}</td>
              <td>{t.note || t.category}</td>
              <td>{t.type === 'expense' ? '—' : holderLabel(t.holder)}</td>
              <td className="biz-right">{t.type === 'expense' ? '−' : '+'}{money(t.amount)}</td>
            </tr>
          ))}
          {txns.length === 0 && <tr><td colSpan="4" className="biz-empty">Nothing logged yet — your first lesson walks you through it.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}

// ---- Jobs: log work, invoice it, get paid ----
function JobsTab({ studentId, jobs, customers, biz }) {
  const [logging, setLogging] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [service, setService] = useState('Mowed the lawn');
  const [amount, setAmount] = useState('');
  const [jobDate, setJobDate] = useState(todayISO());
  const [invoiceJob, setInvoiceJob] = useState(null);
  const [payingJob, setPayingJob] = useState(null);

  const activeCustomers = customers.filter((c) => c.active !== false);

  function pickCustomer(id) {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    if (c?.rate) setAmount(String(c.rate));
  }

  async function saveJob() {
    const c = customers.find((x) => x.id === customerId);
    if (!c || !Number(amount)) return;
    await addDoc(collection(db, 'businesses', studentId, 'jobs'), {
      customerId, customerName: c.name, service, amount: Number(amount),
      date: jobDate, status: 'done', createdAt: serverTimestamp(),
    });
    setLogging(false); setService('Mowed the lawn');
  }

  async function markPaid(job, holder) {
    await updateDoc(doc(db, 'businesses', studentId, 'jobs', job.id), { status: 'paid' });
    await addDoc(collection(db, 'businesses', studentId, 'transactions'), {
      type: 'income', amount: Number(job.amount), note: `${job.customerName} — ${job.service}`,
      category: 'job', holder, date: todayISO(), jobId: job.id, createdAt: serverTimestamp(),
    });
    setPayingJob(null);
  }

  return (
    <section className="biz-panel">
      <div className="biz-actions">
        <button className="biz-btn" onClick={() => setLogging(true)} disabled={activeCustomers.length === 0}>+ Log a job I did</button>
        {activeCustomers.length === 0 && <span className="biz-hint">Add your customers first →</span>}
      </div>

      {logging && (
        <div className="biz-form">
          <label>Customer
            <select value={customerId} onChange={(e) => pickCustomer(e.target.value)}>
              <option value="">pick one…</option>
              {activeCustomers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>What I did<input value={service} onChange={(e) => setService(e.target.value)} /></label>
          <label>Price $<input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <label>Date<input type="date" value={jobDate} max={todayISO()} onChange={(e) => setJobDate(e.target.value)} /></label>
          <button className="biz-btn" onClick={saveJob} disabled={!customerId || !Number(amount)}>Save job</button>
          <button className="biz-cancel" onClick={() => setLogging(false)}>cancel</button>
        </div>
      )}

      <div className="biz-joblist">
        {jobs.map((j) => (
          <div key={j.id} className="biz-job">
            <span className="biz-job-main">
              <strong>{j.customerName}</strong> — {j.service} <em>{j.date}</em>
            </span>
            <span className="biz-job-amount">{money(j.amount)}</span>
            <span className={`biz-status biz-status-${j.status}`}>
              {j.status === 'done' ? 'not invoiced' : j.status}
            </span>
            {j.status !== 'paid' && (
              <span className="biz-job-actions">
                <button onClick={() => setInvoiceJob(j)}>✉️ Invoice</button>
                <button onClick={() => setPayingJob(j)}>💰 Paid!</button>
              </span>
            )}
          </div>
        ))}
        {jobs.length === 0 && <p className="biz-empty">No jobs logged yet. Every mow gets logged — that's the habit.</p>}
      </div>

      {payingJob && (
        <div className="biz-modal" onClick={() => setPayingJob(null)}>
          <div className="biz-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>💰 {payingJob.customerName} paid {money(payingJob.amount)} — where is the money right now?</h3>
            <div className="biz-holder-grid">
              {HOLDERS.map(([k, l]) => (
                <button key={k} className="biz-btn" onClick={() => markPaid(payingJob, k)}>{l}</button>
              ))}
            </div>
            <button className="biz-cancel" onClick={() => setPayingJob(null)}>cancel</button>
          </div>
        </div>
      )}

      {invoiceJob && <InvoiceModal job={invoiceJob} biz={biz} customers={customers} studentId={studentId} onClose={() => setInvoiceJob(null)} />}
    </section>
  );
}

// The invoice email: generated for him, sent from his (or a parent's) own
// email so a real adult inbox is always in the loop. Nothing sends itself.
function InvoiceModal({ job, biz, customers, studentId, onClose }) {
  const customer = customers.find((c) => c.id === job.customerId);
  const [copied, setCopied] = useState(false);
  const subject = `${biz?.name || "Luke's Lawn Care"} — ${job.service.toLowerCase()} on ${job.date}`;
  const body = [
    `Hi ${customer?.name ?? 'there'},`,
    '',
    `I ${job.service.toLowerCase().replace(/^i /, '')} today (${job.date}). Everything is done and I walked it to double-check my work.`,
    '',
    `Amount: $${job.amount}`,
    `You can pay the usual way${customer?.payVia ? ` (${customer.payVia})` : ''}. Thank you for your business!`,
    '',
    `— Luke, ${biz?.name || "Luke's Lawn Care"}`,
  ].join('\n');

  async function copyIt() {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied(true);
    } catch { /* clipboard blocked — they can select the text */ }
  }

  async function markInvoiced() {
    await updateDoc(doc(db, 'businesses', studentId, 'jobs', job.id), { status: 'invoiced' });
    onClose();
  }

  const mailto = customer?.email
    ? `mailto:${encodeURIComponent(customer.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : null;

  return (
    <div className="biz-modal" onClick={onClose}>
      <div className="biz-modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>✉️ Invoice for {job.customerName}</h3>
        <p className="biz-hint">Send this from your email (cc Mom!). If they don't have an email on file yet, ask them for one — that's a pro move.</p>
        <textarea className="biz-invoice-text" readOnly value={`Subject: ${subject}\n\n${body}`} rows={11} />
        <div className="biz-actions">
          <button className="biz-btn" onClick={copyIt}>{copied ? 'Copied! ✓' : '📋 Copy it'}</button>
          {mailto && <a className="biz-btn biz-btn-link" href={mailto}>📧 Open in email</a>}
          <button className="biz-btn biz-btn-ghost" onClick={markInvoiced}>Mark invoiced ✓</button>
        </div>
        <button className="biz-cancel" onClick={onClose}>close</button>
      </div>
    </div>
  );
}

// ---- Customers: the people who trust you ----
function CustomersTab({ studentId, customers }) {
  const [editing, setEditing] = useState(null); // customer id | 'new' | null
  const blank = { name: '', rate: '', cadence: 'weekly', payVia: '', email: '', notes: '', active: true };
  const [form, setForm] = useState(blank);

  function startEdit(c) {
    setEditing(c?.id ?? 'new');
    setForm(c ? { ...blank, ...c } : blank);
  }

  async function save() {
    if (!form.name) return;
    const data = {
      name: form.name, rate: Number(form.rate) || 0, cadence: form.cadence,
      payVia: form.payVia, email: form.email.trim(), notes: form.notes, active: form.active !== false,
    };
    if (editing === 'new') {
      await addDoc(collection(db, 'businesses', studentId, 'customers'), { ...data, createdAt: serverTimestamp() });
    } else {
      await updateDoc(doc(db, 'businesses', studentId, 'customers', editing), data);
    }
    setEditing(null);
  }

  return (
    <section className="biz-panel">
      <div className="biz-actions">
        <button className="biz-btn" onClick={() => startEdit(null)}>+ Add a customer</button>
      </div>

      {editing && (
        <div className="biz-form biz-form-col">
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mr. Smith" /></label>
          <label>Price per job $<input type="number" min="0" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></label>
          <label>How often<input value={form.cadence} onChange={(e) => setForm({ ...form, cadence: e.target.value })} placeholder="weekly, every other week…" /></label>
          <label>How they pay<input value={form.payVia} onChange={(e) => setForm({ ...form, payVia: e.target.value })} placeholder="cash to me / sends it to Dad / sends it to Mom" /></label>
          <label>Email (for invoices)<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Notes<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="gate code, dog's name, sprinkler heads by the mailbox…" /></label>
          <label className="biz-check"><input type="checkbox" checked={form.active !== false} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active customer (uncheck for leads &amp; winter pause)</label>
          <div className="biz-actions">
            <button className="biz-btn" onClick={save} disabled={!form.name}>Save</button>
            <button className="biz-cancel" onClick={() => setEditing(null)}>cancel</button>
          </div>
        </div>
      )}

      <div className="biz-custlist">
        {customers.map((c) => (
          <div key={c.id} className={`biz-cust ${c.active === false ? 'biz-cust-off' : ''}`}>
            <div>
              <strong>{c.name}</strong> — {money(c.rate)} {c.cadence}
              {c.active === false && <span className="biz-lead-tag">lead / paused</span>}
              <div className="biz-cust-meta">
                pays: {c.payVia || '—'} · email: {c.email || 'none yet — ask!'}
                {c.notes && <> · 📝 {c.notes}</>}
              </div>
            </div>
            <button className="biz-edit" onClick={() => startEdit(c)}>edit</button>
          </div>
        ))}
        {customers.length === 0 && <p className="biz-empty">No customers entered yet — that's your first assignment.</p>}
      </div>
    </section>
  );
}

// ---- Goal: the car fund, powered by give/save/spend ----
function GoalTab({ studentId, biz, totals }) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(biz?.carTarget ?? '');
  const [why, setWhy] = useState(biz?.carWhy ?? '');
  const [give, setGive] = useState(biz?.give ?? 10);
  const [save, setSave] = useState(biz?.save ?? 50);

  useEffect(() => {
    setTarget(biz?.carTarget ?? ''); setWhy(biz?.carWhy ?? '');
    setGive(biz?.give ?? 10); setSave(biz?.save ?? 50);
  }, [biz]);

  const spend = Math.max(0, 100 - Number(give || 0) - Number(save || 0));
  const carFund = Math.max(0, totals.profit) * (Number(biz?.save ?? 50) / 100);
  const pct = biz?.carTarget ? Math.min(100, (carFund / biz.carTarget) * 100) : 0;

  async function saveGoal() {
    await setDoc(doc(db, 'businesses', studentId), {
      carTarget: Number(target) || 0, carWhy: why,
      give: Number(give) || 0, save: Number(save) || 0,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    setEditing(false);
  }

  return (
    <section className="biz-panel">
      <div className="biz-goal-card">
        <h3>🚗 The car fund</h3>
        {biz?.carWhy && <p className="biz-goal-why">“{biz.carWhy}”</p>}
        <div className="biz-goal-bar"><div className="biz-goal-fill" style={{ width: `${pct}%` }} /></div>
        <p className="biz-goal-nums">
          <strong>{money(carFund)}</strong> set aside{biz?.carTarget ? <> of <strong>{money(biz.carTarget)}</strong> ({Math.round(pct)}%)</> : ' — set your target below'}
        </p>
        <p className="biz-hint">Car fund = your save-share ({biz?.save ?? 50}%) of profit. More mows, more car. Zero borrowed. 💪</p>
      </div>

      <div className="biz-split-card">
        <h3>Give / Save / Spend</h3>
        <p className="biz-hint">Every dollar gets a job before you touch it: give some, save most, spend the rest guilt-free.</p>
        <div className="biz-split-row">
          <span className="biz-split biz-split-give">Give {biz?.give ?? 10}%</span>
          <span className="biz-split biz-split-save">Save {biz?.save ?? 50}%</span>
          <span className="biz-split biz-split-spend">Spend {100 - (biz?.give ?? 10) - (biz?.save ?? 50)}%</span>
        </div>
      </div>

      {!editing ? (
        <button className="biz-btn" onClick={() => setEditing(true)}>✏️ Edit my goal &amp; split</button>
      ) : (
        <div className="biz-form biz-form-col">
          <label>Car fund target $<input type="number" min="0" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 4000" /></label>
          <label>Why this goal?<input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="what car, and why it matters to you" /></label>
          <label>Give %<input type="number" min="0" max="100" value={give} onChange={(e) => setGive(e.target.value)} /></label>
          <label>Save %<input type="number" min="0" max="100" value={save} onChange={(e) => setSave(e.target.value)} /></label>
          <p className="biz-hint">Spend gets what's left: {spend}%</p>
          <div className="biz-actions">
            <button className="biz-btn" onClick={saveGoal}>Save</button>
            <button className="biz-cancel" onClick={() => setEditing(false)}>cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
