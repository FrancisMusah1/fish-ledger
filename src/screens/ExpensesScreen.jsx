import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { toPesewas, formatCedis } from '../lib/money';

// Quick-pick buttons. Change this list to match her real daily costs.
const presets = ['Ice', 'Transport', 'Porter', 'Food', 'Other'];
// Local calendar day of a saved timestamp, as YYYY-MM-DD.
const localDay = (iso) => new Date(iso).toLocaleDateString('en-CA');

export default function ExpensesScreen() {
  // Form state.
  const [description, setDescription] = useState(''); // what it was for
  const [amount, setAmount] = useState(''); // in cedis
  const [message, setMessage] = useState('');

  // Today's expenses, newest first. Re-runs when the data changes.
  const expenses = useLiveQuery(async () => {
    const today = new Date().toLocaleDateString('en-CA');
    const all = await db.expenses.orderBy('spentAt').reverse().toArray();
    return all.filter((e) => localDay(e.spentAt) === today);
  }, []);

  // Total spent today (pesewas).
  const total = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;

  // Save one expense.
  const save = async () => {
    const p = toPesewas(amount || 0);
    // Checks: stop with a message if something is missing.
    if (!description.trim()) return setMessage('Choose what it was for.');
    if (p <= 0) return setMessage('Enter an amount.');
    await db.expenses.add({
      description: description.trim(),
      amount: p, // pesewas
      spentAt: new Date().toISOString(),
    });
    setDescription('');
    setAmount('');
    setMessage('Saved.');
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <h2>Expenses today</h2>
      <h3>Total: {formatCedis(total)}</h3>

      {/* Quick-pick buttons; the chosen one is shown in bold. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {presets.map((p) => (
          <button key={p} onClick={() => setDescription(p)}
            style={{ fontWeight: description === p ? 'bold' : 'normal' }}>
            {p}
          </button>
        ))}
      </div>

      {/* Or type any description, then the amount. */}
      <input placeholder="Or type what it was for" value={description}
        onChange={(e) => setDescription(e.target.value)} />
      <input type="number" placeholder="Amount" value={amount}
        onChange={(e) => setAmount(e.target.value)} />
      <button onClick={save}>Save expense</button>
      {message && <p>{message}</p>}

      {/* Today's list: time, description, amount. */}
      {expenses?.map((e) => (
        <div key={e.id} style={{ borderTop: '1px solid #ccc', padding: '6px 0' }}>
          {new Date(e.spentAt).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          })}{' '}
          {e.description}: {formatCedis(e.amount)}
        </div>
      ))}
    </div>
  );
}