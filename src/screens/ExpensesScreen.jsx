import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { toPesewas, formatCedis } from '../lib/money';

const presets = ['Paper', 'Transport', 'Food', 'Other'];
const localDay = (iso) => new Date(iso).toLocaleDateString('en-CA');

export default function ExpensesScreen() {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');

  const expenses = useLiveQuery(async () => {
    const today = new Date().toLocaleDateString('en-CA');
    const all = await db.expenses.orderBy('spentAt').reverse().toArray();
    return all.filter((e) => localDay(e.spentAt) === today);
  }, []);

  const total = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;

  const save = async () => {
    const p = toPesewas(amount || 0);
    if (!description.trim()) return setMessage('Choose what it was for.');
    if (p <= 0) return setMessage('Enter an amount.');
    await db.expenses.add({
      description: description.trim(),
      amount: p,
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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {presets.map((p) => (
          <button key={p} onClick={() => setDescription(p)}
            style={{ fontWeight: description === p ? 'bold' : 'normal' }}>
            {p}
          </button>
        ))}
      </div>

      <input placeholder="Or type what it was for" value={description}
        onChange={(e) => setDescription(e.target.value)} />
      <input type="number" placeholder="Amount" value={amount}
        onChange={(e) => setAmount(e.target.value)} />
      <button onClick={save}>Save expense</button>
      {message && <p>{message}</p>}

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