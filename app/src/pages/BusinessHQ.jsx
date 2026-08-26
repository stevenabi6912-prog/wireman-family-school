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

// Two businesses run on this page: Luke's lawn service and Layla's kennel
// (Wireman Heritage Kennels LLC). The business doc's `type` picks the tabs;
// money always works the same way — that's the point of bookkeeping.
const holdersFor = (kennel) => [
  ['me-cash', '💵 Cash in my pocket'],
  ['mom', '👩 Mom is holding it'],
  ['dad', '👨 Dad is holding it'],
  ['bank', kennel ? '🏦 In the LLC account' : '🏦 In my account'],
];

const EXPENSE_CATEGORIES = ['gas (pay Dad back)', 'equipment', 'supplies', 'other'];
const KENNEL_EXPENSE_CATEGORIES = [
  'dog food', 'treats & toys', 'grooming supplies', 'vet & meds', 'stud fee',
  'whelping supplies', 'puppy supplies', 'training', 'AKC fees', "distribution to Layla", 'other',
];

const money = (n) => `$${(Number(n) || 0).toFixed(2).replace(/\.00$/, '')}`;

// Husky care, on the schedule groomers and vets actually recommend.
const CARE_TYPES = [
  { k: 'brush', label: '🪮 Brushing', days: 3, tip: "2-3x a week — daily when she's blowing coat (spring & fall)" },
  { k: 'teeth', label: '🦷 Teeth', days: 3, tip: '2-3x a week with dog toothpaste' },
  { k: 'training', label: '🎓 Training session', days: 2, tip: 'Short and consistent beats long and rare' },
  { k: 'ears', label: '👂 Ear check', days: 14, tip: "Look & sniff every 2 weeks; clean only if dirty" },
  { k: 'nails', label: '💅 Nails', days: 21, tip: "Every ~3 weeks — clicking on the floor means overdue" },
  { k: 'meds', label: '💊 Flea/tick & heartworm', days: 30, tip: 'Same day every month, every month' },
  { k: 'bath', label: '🛁 Bath', days: 49, tip: 'Every 6-8 weeks — huskies self-clean, and NEVER get shaved' },
  { k: 'vet', label: '🏥 Vet visit (Fieldstone)', days: 365, tip: "Annual exam & vaccines — call sooner if anything's off" },
];

const daysSince = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor((new Date() - new Date(y, m - 1, d)) / 86400000);
};

const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

export default function BusinessHQ() {
  const { studentId: ownStudentId, role } = useAuth();
  const { kidId } = useParams();
  const studentId = kidId ?? ownStudentId;
  const parentView = role === 'parent';

  const [biz, setBiz] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [txns, setTxns] = useState([]);
  const [careLog, setCareLog] = useState([]);
  const [litters, setLitters] = useState([]);
  const [puppies, setPuppies] = useState([]);
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
      onSnapshot(collection(db, 'businesses', studentId, 'careLog'), (s) =>
        setCareLog(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.date < b.date ? 1 : -1)))),
      onSnapshot(collection(db, 'businesses', studentId, 'litters'), (s) =>
        setLitters(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ((a.heatStart ?? '') < (b.heatStart ?? '') ? 1 : -1)))),
      onSnapshot(collection(db, 'businesses', studentId, 'puppies'), (s) =>
        setPuppies(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name > b.name ? 1 : -1)))),
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

  const kennel = biz?.type === 'kennel';
  const bizName = biz?.name || (kennel ? 'Wireman Heritage Kennels LLC' : "Luke's Lawn Care");
  const tabs = kennel
    ? [['money', '📒 Money'], ['care', '🐺 Lyra'], ['litter', '🐶 Litter'], ['goal', '🌟 Vision']]
    : [['money', '📒 Money'], ['jobs', '🗓️ Jobs'], ['customers', '👥 Customers'], ['goal', '🎯 Car fund']];

  return (
    <div className="biz-screen">
      <header className="biz-header">
        <Link className="biz-back" to={parentView ? '/dashboard' : '/today'}>← Back to {parentView ? 'dashboard' : 'my day'}</Link>
        <h1>{kennel ? '🐾' : '🚜'} {bizName} <span className="biz-sub">Business HQ</span></h1>
        <div className="biz-totals">
          <span className="biz-chip">Income {money(totals.income)}</span>
          <span className="biz-chip">Expenses {money(totals.expenses)}</span>
          <span className={`biz-chip biz-chip-profit ${totals.profit < 0 ? 'biz-neg' : ''}`}>Profit {money(totals.profit)}</span>
        </div>
      </header>

      <nav className="biz-tabs">
        {tabs.map(([k, label]) => (
          <button key={k} className={tab === k ? 'biz-tab biz-tab-on' : 'biz-tab'} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>

      {tab === 'money' && <MoneyTab studentId={studentId} txns={txns} totals={totals} kennel={kennel} />}
      {tab === 'jobs' && !kennel && <JobsTab studentId={studentId} jobs={jobs} customers={customers} biz={biz} />}
      {tab === 'customers' && !kennel && <CustomersTab studentId={studentId} customers={customers} />}
      {tab === 'care' && kennel && <CareTab studentId={studentId} careLog={careLog} />}
      {tab === 'litter' && kennel && <LitterTab studentId={studentId} litters={litters} puppies={puppies} kennel={kennel} />}
      {tab === 'goal' && (kennel
        ? <VisionTab studentId={studentId} biz={biz} txns={txns} />
        : <GoalTab studentId={studentId} biz={biz} totals={totals} />)}
    </div>
  );
}

// ---- Money: the ledger. Every dollar written down, tracked until it lands ----
function MoneyTab({ studentId, txns, totals, kennel }) {
  const [adding, setAdding] = useState(null); // 'income' | 'expense' | null
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const categories = kennel ? KENNEL_EXPENSE_CATEGORIES : EXPENSE_CATEGORIES;
  const holders = holdersFor(kennel);
  const holderLabel = (h) => (holders.find(([k]) => k === h)?.[1] ?? h);
  const [category, setCategory] = useState(categories[0]);
  const [holder, setHolder] = useState('me-cash');
  const [paidBy, setPaidBy] = useState('llc'); // kennel expenses: who fronted it
  const familyCovered = txns.filter((t) => t.type === 'expense' && t.paidBy === 'family')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  async function save() {
    if (!Number(amount)) return;
    await addDoc(collection(db, 'businesses', studentId, 'transactions'), {
      type: adding,
      amount: Number(amount),
      note,
      category: adding === 'expense' ? category : (note || 'income'),
      holder: adding === 'income' ? holder : 'bank',
      ...(kennel && adding === 'expense' ? { paidBy } : {}),
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
      {kennel && familyCovered > 0 && (
        <p className="biz-hint">🧾 True cost so far includes <strong>{money(familyCovered)}</strong> covered by Mom &amp; Dad — once the LLC has retained earnings, it takes these over.</p>
      )}
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
            <>
              <label>What for
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              {kennel && (
                <label>Who paid it
                  <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                    <option value="llc">LLC money</option>
                    <option value="family">Mom &amp; Dad covered it</option>
                  </select>
                </label>
              )}
            </>
          ) : (
            <label>Where is it right now?
              <select value={holder} onChange={(e) => setHolder(e.target.value)}>
                {holders.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
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
              <td>{t.type === 'expense' ? (t.paidBy === 'family' ? '👩‍👨 Mom & Dad covered' : '—') : holderLabel(t.holder)}</td>
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
              {holdersFor(false).map(([k, l]) => (
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

// ---- Lyra: the care log. The dog IS the business asset — care is maintenance ----
function CareTab({ studentId, careLog }) {
  const [noteFor, setNoteFor] = useState(null);
  const [note, setNote] = useState('');

  const lastOf = (k) => careLog.find((c) => c.careType === k)?.date ?? null;

  async function logCare(k, extraNote = '') {
    await addDoc(collection(db, 'businesses', studentId, 'careLog'), {
      careType: k, date: todayISO(), note: extraNote, createdAt: serverTimestamp(),
    });
    setNoteFor(null); setNote('');
  }

  return (
    <section className="biz-panel">
      <div className="biz-goal-card">
        <h3>🐺 Lyra — AKC Siberian Husky, red coat, blue eyes</h3>
        <p className="biz-hint">She's not just your dog — she's the heart of the whole kennel. A well-cared-for dam means healthy litters, happy buyers, and a business you can be proud of. Log care as you do it; anything red is overdue.</p>
      </div>

      <div className="biz-carelist">
        {CARE_TYPES.map((c) => {
          const last = lastOf(c.k);
          const since = daysSince(last);
          const overdue = since === null || since >= c.days;
          const dueSoon = !overdue && since >= c.days - 1;
          return (
            <div key={c.k} className={`biz-care ${overdue ? 'biz-care-due' : dueSoon ? 'biz-care-soon' : ''}`}>
              <div className="biz-care-main">
                <strong>{c.label}</strong>
                <span className="biz-care-last">
                  {last ? `last: ${last} (${since === 0 ? 'today' : `${since}d ago`})` : 'never logged'}
                  {overdue && last && ' — due!'}
                  {!last && ' — start the record!'}
                </span>
                <span className="biz-care-tip">{c.tip}</span>
              </div>
              <button className="biz-btn" onClick={() => setNoteFor(c.k)}>Did it ✓</button>
            </div>
          );
        })}
      </div>

      {noteFor && (
        <div className="biz-modal" onClick={() => setNoteFor(null)}>
          <div className="biz-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{CARE_TYPES.find((c) => c.k === noteFor)?.label} — logged for today</h3>
            <label className="biz-modal-label">Anything to note? (optional)
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. blowing coat hard, left ear a little red…" />
            </label>
            <div className="biz-actions">
              <button className="biz-btn" onClick={() => logCare(noteFor, note)}>Save ✓</button>
              <button className="biz-cancel" onClick={() => setNoteFor(null)}>cancel</button>
            </div>
          </div>
        </div>
      )}

      {careLog.length > 0 && (
        <details className="biz-care-history">
          <summary>Full care history ({careLog.length})</summary>
          {careLog.slice(0, 60).map((c) => (
            <p key={c.id} className="biz-care-row">
              {c.date} — {CARE_TYPES.find((t) => t.k === c.careType)?.label ?? c.careType}{c.note && ` · ${c.note}`}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}

// ---- Litter: heat -> breeding -> 63 days -> whelp -> puppies -> homes ----
function LitterTab({ studentId, litters, puppies }) {
  const litter = litters[0] ?? null; // newest
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ heatStart: '', breedDate: '', whelpDate: '', notes: '' });
  const [addingPup, setAddingPup] = useState(false);
  const [pup, setPup] = useState({ name: '', sex: 'F', color: '', price: 1250 });
  const [payingPup, setPayingPup] = useState(null); // {puppy, kind: 'deposit'|'final'}
  const holders = holdersFor(true);

  const litterPups = puppies.filter((p) => !litter || p.litterId === litter.id);
  const due = litter?.breedDate ? addDays(litter.breedDate, 63) : null;
  const goHome = litter?.whelpDate ? addDays(litter.whelpDate, 56) : null;

  function startEdit() {
    setForm({
      heatStart: litter?.heatStart ?? '', breedDate: litter?.breedDate ?? '',
      whelpDate: litter?.whelpDate ?? '', notes: litter?.notes ?? '',
    });
    setEditing(true);
  }

  async function saveLitter() {
    const data = { ...form, updatedAt: serverTimestamp() };
    if (litter) await updateDoc(doc(db, 'businesses', studentId, 'litters', litter.id), data);
    else await addDoc(collection(db, 'businesses', studentId, 'litters'), { ...data, createdAt: serverTimestamp() });
    setEditing(false);
  }

  async function savePup() {
    if (!pup.name || !litter) return;
    await addDoc(collection(db, 'businesses', studentId, 'puppies'), {
      ...pup, price: Number(pup.price) || 0, litterId: litter.id, status: 'here',
      depositPaid: 0, buyer: '', createdAt: serverTimestamp(),
    });
    setAddingPup(false); setPup({ name: '', sex: 'F', color: '', price: 1250 });
  }

  async function recordMoney(holderKey) {
    const { puppy, kind } = payingPup;
    const amount = kind === 'deposit' ? 200 : Number(puppy.price || 0) - Number(puppy.depositPaid || 0);
    const buyer = puppy.buyer || window.prompt("Buyer's name?") || 'buyer';
    await updateDoc(doc(db, 'businesses', studentId, 'puppies', puppy.id), kind === 'deposit'
      ? { status: 'reserved', depositPaid: 200, buyer }
      : { status: 'sold', buyer });
    await addDoc(collection(db, 'businesses', studentId, 'transactions'), {
      type: 'income', amount, holder: holderKey, date: todayISO(),
      note: `${puppy.name} — ${kind === 'deposit' ? '$200 deposit' : 'final payment'} (${buyer})`,
      category: 'puppy sale', createdAt: serverTimestamp(),
    });
    setPayingPup(null);
  }

  return (
    <section className="biz-panel">
      <div className="biz-goal-card">
        <h3>🐶 {litter ? 'Current litter' : 'No litter record yet'}</h3>
        {litter ? (
          <div className="biz-timeline">
            <span className="biz-tl">🌡️ Heat: <strong>{litter.heatStart || '—'}</strong></span>
            <span className="biz-tl">💞 Bred: <strong>{litter.breedDate || '—'}</strong></span>
            <span className="biz-tl">📅 Due (~63 days): <strong>{due ?? '—'}</strong></span>
            <span className="biz-tl">🐣 Whelped: <strong>{litter.whelpDate || '—'}</strong></span>
            <span className="biz-tl">🏠 Go-home (~8 wks): <strong>{goHome ?? '—'}</strong></span>
          </div>
        ) : (
          <p className="biz-hint">When Lyra's heat starts, record it here — the whole timeline (breeding, due date, go-home day) builds itself from real dates.</p>
        )}
        {litter?.notes && <p className="biz-hint">📝 {litter.notes}</p>}
        <div className="biz-actions">
          <button className="biz-btn" onClick={startEdit}>{litter ? '✏️ Update dates' : '+ Start the litter record'}</button>
        </div>
      </div>

      {editing && (
        <div className="biz-form biz-form-col">
          <label>Heat started<input type="date" value={form.heatStart} onChange={(e) => setForm({ ...form, heatStart: e.target.value })} /></label>
          <label>Breeding date<input type="date" value={form.breedDate} onChange={(e) => setForm({ ...form, breedDate: e.target.value })} /></label>
          <label>Whelp date (when it happens)<input type="date" value={form.whelpDate} onChange={(e) => setForm({ ...form, whelpDate: e.target.value })} /></label>
          <label>Notes<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="stud name, how she's doing…" /></label>
          <div className="biz-actions">
            <button className="biz-btn" onClick={saveLitter}>Save</button>
            <button className="biz-cancel" onClick={() => setEditing(false)}>cancel</button>
          </div>
        </div>
      )}

      {litter?.whelpDate && (
        <div className="biz-actions">
          <button className="biz-btn" onClick={() => setAddingPup(true)}>+ Add a puppy</button>
        </div>
      )}

      {addingPup && (
        <div className="biz-form">
          <label>Name/ID<input value={pup.name} onChange={(e) => setPup({ ...pup, name: e.target.value })} placeholder="Red collar boy…" /></label>
          <label>Sex
            <select value={pup.sex} onChange={(e) => setPup({ ...pup, sex: e.target.value })}>
              <option value="F">Female</option><option value="M">Male</option>
            </select>
          </label>
          <label>Color/markings<input value={pup.color} onChange={(e) => setPup({ ...pup, color: e.target.value })} /></label>
          <label>Price $<input type="number" value={pup.price} onChange={(e) => setPup({ ...pup, price: e.target.value })} /></label>
          <button className="biz-btn" onClick={savePup} disabled={!pup.name}>Save</button>
          <button className="biz-cancel" onClick={() => setAddingPup(false)}>cancel</button>
        </div>
      )}

      <div className="biz-joblist">
        {litterPups.map((p) => (
          <div key={p.id} className="biz-job">
            <span className="biz-job-main">
              <strong>{p.name}</strong> · {p.sex === 'F' ? '♀' : '♂'} {p.color}
              {p.buyer && <em> → {p.buyer}</em>}
            </span>
            <span className="biz-job-amount">{money(p.price)}</span>
            <span className={`biz-status biz-status-${p.status === 'here' ? 'done' : p.status === 'reserved' ? 'invoiced' : 'paid'}`}>
              {p.status === 'here' ? 'available' : p.status}
            </span>
            {p.status !== 'sold' && (
              <span className="biz-job-actions">
                {p.status === 'here' && <button onClick={() => setPayingPup({ puppy: p, kind: 'deposit' })}>💰 $200 deposit</button>}
                <button onClick={() => setPayingPup({ puppy: p, kind: 'final' })}>🏠 Sold — final payment</button>
              </span>
            )}
          </div>
        ))}
        {litter?.whelpDate && litterPups.length === 0 && (
          <p className="biz-empty">Add each puppy once they arrive — every one gets tracked from first breath to forever home.</p>
        )}
      </div>

      {payingPup && (
        <div className="biz-modal" onClick={() => setPayingPup(null)}>
          <div className="biz-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>💰 {payingPup.puppy.name}: {payingPup.kind === 'deposit' ? '$200 deposit' : `final payment (${money(Number(payingPup.puppy.price || 0) - Number(payingPup.puppy.depositPaid || 0))})`} — where did the money land?</h3>
            <div className="biz-holder-grid">
              {holders.map(([k, l]) => (
                <button key={k} className="biz-btn" onClick={() => recordMoney(k)}>{l}</button>
              ))}
            </div>
            <button className="biz-cancel" onClick={() => setPayingPup(null)}>cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}

// ---- Vision: LLC money works differently — Layla's share is her distribution ----
function VisionTab({ studentId, biz, txns }) {
  const [editing, setEditing] = useState(false);
  const [vision, setVision] = useState(biz?.vision ?? '');
  const [target, setTarget] = useState(biz?.goalTarget ?? '');
  const [why, setWhy] = useState(biz?.goalWhy ?? '');

  useEffect(() => {
    setVision(biz?.vision ?? ''); setTarget(biz?.goalTarget ?? ''); setWhy(biz?.goalWhy ?? '');
  }, [biz]);

  const distributions = txns
    .filter((t) => t.type === 'expense' && t.category === 'distribution to Layla')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const pct = biz?.goalTarget ? Math.min(100, (distributions / biz.goalTarget) * 100) : 0;

  async function save() {
    await setDoc(doc(db, 'businesses', studentId), {
      vision, goalTarget: Number(target) || 0, goalWhy: why, updatedAt: serverTimestamp(),
    }, { merge: true });
    setEditing(false);
  }

  return (
    <section className="biz-panel">
      <div className="biz-goal-card">
        <h3>🌟 The vision for Wireman Heritage Kennels</h3>
        {biz?.vision
          ? <p className="biz-goal-why">“{biz.vision}”</p>
          : <p className="biz-hint">Every great kennel started as somebody's dream. What's yours? Champion bloodlines? The husky breeder people drive hours for? Write it — your lessons will help you build it.</p>}
      </div>

      <div className="biz-split-card">
        <h3>💼 How LLC money works</h3>
        <p className="biz-hint">The business (the LLC) earns the money and pays its own bills first — that's <strong>retained earnings</strong>. What the LLC pays out to you is your <strong>distribution</strong>. Your give/save/spend applies to YOUR distributions, not the LLC's money.</p>
        <p className="biz-goal-nums">Distributions to you so far: <strong>{money(distributions)}</strong></p>
      </div>

      {biz?.goalTarget > 0 && (
        <div className="biz-goal-card">
          <h3>🎯 {biz.goalWhy || 'My goal'}</h3>
          <div className="biz-goal-bar"><div className="biz-goal-fill" style={{ width: `${pct}%` }} /></div>
          <p className="biz-goal-nums"><strong>{money(distributions)}</strong> of <strong>{money(biz.goalTarget)}</strong> ({Math.round(pct)}%)</p>
        </div>
      )}

      {!editing ? (
        <button className="biz-btn" onClick={() => setEditing(true)}>✏️ Edit my vision &amp; goal</button>
      ) : (
        <div className="biz-form biz-form-col">
          <label>My vision (dream big)<input value={vision} onChange={(e) => setVision(e.target.value)} placeholder="e.g. champion-bloodline huskies people wait in line for" /></label>
          <label>A personal goal to save my distributions for<input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="what are you saving for?" /></label>
          <label>Goal target $<input type="number" min="0" value={target} onChange={(e) => setTarget(e.target.value)} /></label>
          <div className="biz-actions">
            <button className="biz-btn" onClick={save}>Save</button>
            <button className="biz-cancel" onClick={() => setEditing(false)}>cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
