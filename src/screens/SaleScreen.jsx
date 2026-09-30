import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { toPesewas, formatCedis } from '../lib/money';

const emptyLine = { fishTypeId: '', pieces: '', price: '' };

export default function SaleScreen() {
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), []);
  const fishTypes = useLiveQuery(() => db.fishTypes.toArray(), []);

  const [customerId, setCustomerId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPlace, setNewPlace] = useState('');
  const [lines, setLines] = useState([{ ...emptyLine }]);
  const [paid, setPaid] = useState('');

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

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <h2>New sale</h2>

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
      <p>Balance: {formatCedis(balance)}</p>
    </div>
  );
}