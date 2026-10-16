import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatCedis } from '../lib/money';

// Date as dd/mm/yyyy, e.g. 29/09/2026.
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB');

export default function StatementScreen() {
  // Live lists for the dropdown and for fish names.
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), []);
  const fishTypes = useLiveQuery(() => db.fishTypes.toArray(), []);
  const [customerId, setCustomerId] = useState('');

  // Load the chosen customer's sales, payments and sale lines.
  // Re-runs automatically when the customer or the data changes.
  const data = useLiveQuery(async () => {
    if (!customerId) return null;
    const id = Number(customerId);
    const sales = await db.sales.where('customerId').equals(id).toArray();
    const payments = await db.payments.where('customerId').equals(id).toArray();
    const items = await db.saleItems
      .where('saleId')
      .anyOf(sales.map((s) => s.id))
      .toArray();
    return { sales, payments, items };
  }, [customerId]);

  const customer = customers?.find((c) => c.id === Number(customerId));
  // Fish id -> fish name (empty text until the list has loaded).
  const fishName = (id) => fishTypes?.find((f) => f.id === id)?.name ?? '';

  // Merge sales and payments into one list, oldest first.
  const events = data
    ? [
        ...data.sales.map((s) => ({ type: 'sale', at: s.soldAt, sale: s })),
        ...data.payments.map((p) => ({ type: 'payment', at: p.paidAt, payment: p })),
      ].sort((a, b) => a.at.localeCompare(b.at))
    : [];

  // Running balance: starts at the old balance, then + sales and - payments.
  let running = customer?.openingBalance || 0;
  const rows = events.map((e) => {
    running += e.type === 'sale' ? e.sale.total : -e.payment.amount;
    return { ...e, running };
  });

  // Line separating one entry from the next.
  const box = { borderTop: '1px solid #ccc', padding: '8px 0' };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <h2>Customer statement</h2>

      <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
        <option value="">Choose customer</option>
        {customers?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.place ? ` (${c.place})` : ''}
          </option>
        ))}
      </select>

      {customer && data && (
        <>
          {/* Old debt carried in from the book, if any. */}
          {customer.openingBalance > 0 && (
            <p>Old balance: {formatCedis(customer.openingBalance)}</p>
          )}

          {rows.map((r) =>
            r.type === 'sale' ? (
              // A sale: its lines (price × pieces), total and running balance.
              <div key={'s' + r.sale.id} style={box}>
                <strong>{fmtDate(r.at)}</strong>
                {data.items
                  .filter((i) => i.saleId === r.sale.id)
                  .map((i) => (
                    <div key={i.id}>
                      {fishName(i.fishTypeId)}: {i.pricePerPiece / 100} × {i.pieces} ={' '}
                      {formatCedis(i.lineTotal)}
                    </div>
                  ))}
                <div>Sale total: {formatCedis(r.sale.total)}</div>
                <div>Balance: {formatCedis(r.running)}</div>
              </div>
            ) : (
              // A payment: amount, method and running balance.
              <div key={'p' + r.payment.id} style={box}>
                <strong>{fmtDate(r.at)}</strong> Paid ({r.payment.method}):{' '}
                {formatCedis(r.payment.amount)}
                <div>Balance: {formatCedis(r.running)}</div>
              </div>
            )
          )}

          {/* Final balance = what the customer owes now. */}
          <h3>Balance owed: {formatCedis(running)}</h3>
        </>
      )}
    </div>
  );
}