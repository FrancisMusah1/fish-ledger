import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { toPesewas, formatCedis } from '../lib/money';

const emptyLine = { fishTypeId: '', pieces: '', price: '' };

export default function SaleScreen() {
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), []);
  const fishTypes = useLiveQuery(() => db.fishTypes.toArray(), []);
  const today = new Date().toLocaleDateString('en-CA');
  const [date, setDate] = useState(today);

  const [customerId, setCustomerId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPlace, setNewPlace] = useState('');
  const [lines, setLines] = useState([{ ...emptyLine }]);
  const [paid, setPaid] = useState('');
  const [method, setMethod] = useState('cash');
  const [message, setMessage] = useState('');

  const addCustomer = async () => {
    if (!newName.trim()) return;
    const id = await db.customers.add({
      name: newName.trim(),
      place: newPlace.trim(),
      openingBalance: 0,
    });
    setCustomerId(String(id));
    setNewName('');
    setNewPlace('');
  };

  const updateLine = (index, field, value) =>
    setLines(lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  const addLine = () => setLines([...lines, { ...emptyLine }]);
  const removeLine = (index) => setLines(lines.filter((_, i) => i !== index));

  const lineTotal = (l) =>
    Math.round(Number(l.pieces || 0) * toPesewas(l.price || 0));
  const total = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const balance = total - toPesewas(paid || 0);

  const save = async () => {
    const validLines = lines.filter(
      (l) => l.fishTypeId && Number(l.pieces) > 0 && Number(l.price) > 0
    );
    if (!customerId) return setMessage('Choose a customer first.');
    if (!date) return setMessage('Choose a date.');
    if (validLines.length === 0) return setMessage('Add at least one fish line.');

    const saleTotal = validLines.reduce((sum, l) => sum + lineTotal(l), 0);
    const paidPesewas = toPesewas(paid || 0);
    if (paidPesewas < 0 || paidPesewas > saleTotal)
      return setMessage('Paid must be between 0 and the total.');

    const enteredAt = new Date().toISOString();
const when = date === today ? enteredAt : new Date(date + 'T12:00:00').toISOString();

    await db.transaction(
      'rw',
      db.sales,
      db.saleItems,
      db.payments,
      db.allocations,
      async () => {
        const saleId = await db.sales.add({
          customerId: Number(customerId),
          soldAt: when, enteredAt,
          total: saleTotal,
        });
        await db.saleItems.bulkAdd(
          validLines.map((l) => ({
            saleId,
            fishTypeId: Number(l.fishTypeId),
            pieces: Number(l.pieces),
            pricePerPiece: toPesewas(l.price),
            lineTotal: lineTotal(l),
          }))
        );
        if (paidPesewas > 0) {
          const paymentId = await db.payments.add({
            customerId: Number(customerId),
            amount: paidPesewas,
            method,
            paidAt: when,
          });
          await db.allocations.add({ paymentId, saleId, amount: paidPesewas });
        }
      }
    );

    setMessage(`Saved. Balance on this sale: ${formatCedis(saleTotal - paidPesewas)}`);
    setLines([{ ...emptyLine }]);
    setPaid('');
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <h2>New sale</h2>

      <input type="date" value={date} max={today}
  onChange={(e) => setDate(e.target.value)} />
{date !== today && (
  <p style={{ color: 'red' }}>Saving as an old entry: {date}</p>
)}

      <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
        <option value="">Choose customer</option>
        {customers?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.place ? ` (${c.place})` : ''}
          </option>
        ))}
      </select>

      <div>
        <input placeholder="New customer" value={newName}
          onChange={(e) => setNewName(e.target.value)} />
        <input placeholder="Place" value={newPlace}
          onChange={(e) => setNewPlace(e.target.value)} />
        <button onClick={addCustomer}>Add</button>
      </div>

      {lines.map((line, i) => (
        <div key={i}>
          <select value={line.fishTypeId}
            onChange={(e) => updateLine(i, 'fishTypeId', e.target.value)}>
            <option value="">Fish</option>
            {fishTypes?.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <input type="number" placeholder="Pieces" value={line.pieces}
            onChange={(e) => updateLine(i, 'pieces', e.target.value)} />
          <input type="number" placeholder="Price" value={line.price}
            onChange={(e) => updateLine(i, 'price', e.target.value)} />
          <span>{formatCedis(lineTotal(line))}</span>
          {lines.length > 1 && <button onClick={() => removeLine(i)}>✕</button>}
        </div>
      ))}
      <button onClick={addLine}>+ Add fish</button>

      <p>Total: {formatCedis(total)}</p>
      <input type="number" placeholder="Paid now" value={paid}
        onChange={(e) => setPaid(e.target.value)} />
      <select value={method} onChange={(e) => setMethod(e.target.value)}>
        <option value="cash">Cash</option>
        <option value="momo">Mobile money</option>
      </select>
      <p>Balance: {formatCedis(balance)}</p>
      <button onClick={save}>Save sale</button>
      {message && <p>{message}</p>}
    </div>
  );
}