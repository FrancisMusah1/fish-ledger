import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { toPesewas, formatCedis } from '../lib/money';

// A blank sale line: fish chosen, number of pieces, price per piece (cedis).
const emptyLine = { fishTypeId: '', pieces: '', price: '' };

export default function SaleScreen() {
  // Live lists from the database; they re-render when the data changes.
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), []);
  const fishTypes = useLiveQuery(() => db.fishTypes.toArray(), []);

  // Sale date: today by default; a past date saves the sale as an old entry.
  const today = new Date().toLocaleDateString('en-CA'); // format YYYY-MM-DD
  const [date, setDate] = useState(today);

  // Form state.
  const [customerId, setCustomerId] = useState('');
  const [newName, setNewName] = useState(''); // "new customer" inputs
  const [newPlace, setNewPlace] = useState('');
  const [lines, setLines] = useState([{ ...emptyLine }]);
  const [paid, setPaid] = useState(''); // amount paid now, in cedis
  const [method, setMethod] = useState('cash'); // 'cash' or 'momo'
  const [message, setMessage] = useState(''); // feedback shown under the button

  // Add a customer and select them straight away.
  const addCustomer = async () => {
    if (!newName.trim()) return;
    const id = await db.customers.add({
      name: newName.trim(),
      place: newPlace.trim(),
      openingBalance: 0, // old debt carried in from the book (pesewas)
    });
    setCustomerId(String(id));
    setNewName('');
    setNewPlace('');
  };

  // Edit, add or remove a fish line (all lines live in one state array).
  const updateLine = (index, field, value) =>
    setLines(lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  const addLine = () => setLines([...lines, { ...emptyLine }]);
  const removeLine = (index) => setLines(lines.filter((_, i) => i !== index));

  // Line total in pesewas = pieces x price per piece.
  const lineTotal = (l) =>
    Math.round(Number(l.pieces || 0) * toPesewas(l.price || 0));
  // Total and balance are calculated on every render, never typed in.
  const total = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const balance = total - toPesewas(paid || 0);

  // Save the sale, its lines and any payment in ONE transaction,
  // so either everything is saved or nothing is.
  const save = async () => {
    // Ignore half-filled lines.
    const validLines = lines.filter(
      (l) => l.fishTypeId && Number(l.pieces) > 0 && Number(l.price) > 0
    );
    // Checks: stop with a message if something is missing or wrong.
    if (!customerId) return setMessage('Choose a customer first.');
    if (!date) return setMessage('Choose a date.');
    if (validLines.length === 0) return setMessage('Add at least one fish line.');

    const saleTotal = validLines.reduce((sum, l) => sum + lineTotal(l), 0);
    const paidPesewas = toPesewas(paid || 0);
    if (paidPesewas < 0 || paidPesewas > saleTotal)
      return setMessage('Paid must be between 0 and the total.');

    const enteredAt = new Date().toISOString(); // when it was typed in
    // soldAt = the sale's real date (noon, for back-dated entries).
    const when =
      date === today ? enteredAt : new Date(date + 'T12:00:00').toISOString();

    await db.transaction(
      'rw',
      db.sales,
      db.saleItems,
      db.payments,
      db.allocations,
      async () => {
        // 1) The sale itself.
        const saleId = await db.sales.add({
          customerId: Number(customerId),
          soldAt: when,
          enteredAt,
          total: saleTotal,
        });
        // 2) Its lines (money in pesewas).
        await db.saleItems.bulkAdd(
          validLines.map((l) => ({
            saleId,
            fishTypeId: Number(l.fishTypeId),
            pieces: Number(l.pieces),
            pricePerPiece: toPesewas(l.price),
            lineTotal: lineTotal(l),
          }))
        );
        // 3) The payment made now (if any), linked to this sale.
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

    // Reset for the next sale (customer and date stay selected).
    setMessage(`Saved. Balance on this sale: ${formatCedis(saleTotal - paidPesewas)}`);
    setLines([{ ...emptyLine }]);
    setPaid('');
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <h2>New sale</h2>

      {/* Date picker; the red note warns when saving an old entry. */}
      <input type="date" value={date} max={today}
        onChange={(e) => setDate(e.target.value)} />
      {date !== today && (
        <p style={{ color: 'red' }}>Saving as an old entry: {date}</p>
      )}

      {/* Choose an existing customer... */}
      <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
        <option value="">Choose customer</option>
        {customers?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.place ? ` (${c.place})` : ''}
          </option>
        ))}
      </select>

      {/* ...or add a new one. */}
      <div>
        <input placeholder="New customer" value={newName}
          onChange={(e) => setNewName(e.target.value)} />
        <input placeholder="Place" value={newPlace}
          onChange={(e) => setNewPlace(e.target.value)} />
        <button onClick={addCustomer}>Add</button>
      </div>

      {/* One row per fish line: fish, pieces, price, line total. */}
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

      {/* Totals, payment now, and save. */}
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