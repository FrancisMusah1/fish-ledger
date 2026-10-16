import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { toPesewas, formatCedis } from '../lib/money';

// Date with weekday, e.g. "Tue 22 Sept". Matches how customers talk.
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

export default function PaymentScreen() {
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), []);

  // Form state.
  const [customerId, setCustomerId] = useState('');
  const [targetId, setTargetId] = useState(''); // sale to pay first ('' = oldest first)
  const [amount, setAmount] = useState(''); // amount paid, in cedis
  const [method, setMethod] = useState('cash'); // 'cash' or 'momo'
  const [message, setMessage] = useState('');

  // The customer's unpaid sales, oldest first, each with what is still owed.
  // remaining = sale total - everything allocated to that sale.
  const unpaid = useLiveQuery(async () => {
    if (!customerId) return [];
    const sales = await db.sales
      .where('customerId')
      .equals(Number(customerId))
      .sortBy('soldAt');
    const allocs = await db.allocations
      .where('saleId')
      .anyOf(sales.map((s) => s.id))
      .toArray();
    return sales
      .map((s) => {
        const paid = allocs
          .filter((a) => a.saleId === s.id)
          .reduce((sum, a) => sum + a.amount, 0);
        return { ...s, remaining: s.total - paid };
      })
      .filter((s) => s.remaining > 0); // fully paid sales drop out
  }, [customerId]);

  // Total the customer owes across all unpaid sales.
  const owed = unpaid?.reduce((sum, s) => sum + s.remaining, 0) || 0;

  // Switching customer clears the chosen sale and any old message.
  const chooseCustomer = (id) => {
    setCustomerId(id);
    setTargetId('');
    setMessage('');
  };

  // Save the payment and share it out across sales in one transaction.
  const save = async () => {
    const pay = toPesewas(amount || 0);
    // Checks: stop with a message if something is wrong.
    if (!customerId) return setMessage('Choose a customer first.');
    if (pay <= 0) return setMessage('Enter an amount.');
    if (pay > owed)
      return setMessage(`That is more than the ${formatCedis(owed)} owed.`);

    // Order sales are paid in: the chosen sale first, then oldest first.
    const target = unpaid.find((s) => s.id === Number(targetId));
    const order = target
      ? [target, ...unpaid.filter((s) => s.id !== target.id)]
      : unpaid;

    await db.transaction('rw', db.payments, db.allocations, async () => {
      // 1) The payment itself.
      const paymentId = await db.payments.add({
        customerId: Number(customerId),
        amount: pay,
        method,
        paidAt: new Date().toISOString(),
      });
      // 2) Hand the money out: each sale takes what it still needs,
      //    until the payment runs out.
      let left = pay;
      for (const s of order) {
        if (left <= 0) break;
        const part = Math.min(left, s.remaining);
        await db.allocations.add({ paymentId, saleId: s.id, amount: part });
        left -= part;
      }
    });

    setAmount('');
    setTargetId('');
    setMessage(`Saved. Still owed: ${formatCedis(owed - pay)}`);
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <h2>Receive payment</h2>

      <select value={customerId} onChange={(e) => chooseCustomer(e.target.value)}>
        <option value="">Choose customer</option>
        {customers?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.place ? ` (${c.place})` : ''}
          </option>
        ))}
      </select>

      {customerId && (
        <>
          {/* Unpaid sales with what is left on each. */}
          {unpaid?.map((s) => (
            <div key={s.id}>
              {fmtDate(s.soldAt)}: sale {formatCedis(s.total)}, left{' '}
              {formatCedis(s.remaining)}
            </div>
          ))}
          <h3>Total owed: {formatCedis(owed)}</h3>

          {/* Which sale this payment is for (default: oldest first). */}
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <option value="">Pay oldest first</option>
            {unpaid?.map((s) => (
              <option key={s.id} value={s.id}>
                Pay {fmtDate(s.soldAt)} sale (left {formatCedis(s.remaining)})
              </option>
            ))}
          </select>

          <input type="number" placeholder="Amount paid" value={amount}
            onChange={(e) => setAmount(e.target.value)} />
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="momo">Mobile money</option>
          </select>
          <button onClick={save}>Save payment</button>
        </>
      )}
      {message && <p>{message}</p>}
    </div>
  );
}