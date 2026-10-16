import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatCedis } from '../lib/money';

// Short date, e.g. "29 Sept".
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function DebtsScreen() {
  // How the list is ordered: 'amount' (biggest first) or 'oldest'.
  const [sortBy, setSortBy] = useState('amount');

  // Work out what each customer owes. Nothing is stored: it is recalculated
  // from sales and allocations whenever the data changes.
  const debts = useLiveQuery(async () => {
    const customers = await db.customers.toArray();
    const sales = await db.sales.toArray();
    const allocs = await db.allocations.toArray();

    // Total paid towards each sale: { saleId: pesewas }.
    const paidBySale = {};
    allocs.forEach((a) => {
      paidBySale[a.saleId] = (paidBySale[a.saleId] || 0) + a.amount;
    });

    // Per customer: total still owed, and the date of their oldest unpaid sale.
    const byCustomer = {};
    sales.forEach((s) => {
      const remaining = s.total - (paidBySale[s.id] || 0);
      if (remaining <= 0) return; // fully paid: skip
      if (!byCustomer[s.customerId]) {
        byCustomer[s.customerId] = { owed: 0, oldest: s.soldAt };
      }
      byCustomer[s.customerId].owed += remaining;
      if (s.soldAt < byCustomer[s.customerId].oldest) {
        byCustomer[s.customerId].oldest = s.soldAt;
      }
    });

    // Keep only customers who owe something, and attach their totals.
    return customers
      .filter((c) => byCustomer[c.id])
      .map((c) => ({ ...c, ...byCustomer[c.id] }));
  }, []);

  // Sort a copy of the list by the chosen order.
  const list = debts
    ? [...debts].sort(
        sortBy === 'amount'
          ? (a, b) => b.owed - a.owed // biggest debt first
          : (a, b) => a.oldest.localeCompare(b.oldest) // oldest debt first
      )
    : [];
  const totalOwed = list.reduce((sum, d) => sum + d.owed, 0);
  // Whole days since a date.
  const daysSince = (iso) =>
    Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <h2>Who owes me</h2>
      <h3>Total owed: {formatCedis(totalOwed)}</h3>

      <button onClick={() => setSortBy('amount')}>Biggest first</button>
      <button onClick={() => setSortBy('oldest')}>Oldest first</button>

      {list.length === 0 && <p>Nobody owes anything.</p>}
      {/* One block per customer: name, amount owed, how long it has been. */}
      {list.map((d) => (
        <div key={d.id} style={{ borderTop: '1px solid #ccc', padding: '8px 0' }}>
          <strong>
            {d.name}
            {d.place ? ` (${d.place})` : ''}
          </strong>
          <div>Owes: {formatCedis(d.owed)}</div>
          <div>
            Since {fmtDate(d.oldest)} ({daysSince(d.oldest)} days)
          </div>
        </div>
      ))}
    </div>
  );
}
