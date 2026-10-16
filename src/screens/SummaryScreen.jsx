import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatCedis } from '../lib/money';

// Local calendar day of a saved timestamp, as YYYY-MM-DD.
const localDay = (iso) => new Date(iso).toLocaleDateString('en-CA');
// Add up one numeric field across a list of records.
const sum = (list, field) => list.reduce((s, x) => s + x[field], 0);

export default function SummaryScreen() {
  const today = new Date().toLocaleDateString('en-CA');
  // Period shown: both dates default to today.
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  // Work out every figure from the saved records. Nothing is stored:
  // it is recalculated whenever the dates or the data change.
  const s = useLiveQuery(async () => {
    // Is a YYYY-MM-DD day inside the chosen period?
    const inRange = (d) => d >= from && d <= to;

    // Records that fall inside the period.
    const sales = (await db.sales.toArray()).filter((x) =>
      inRange(localDay(x.soldAt))
    );
    const payments = (await db.payments.toArray()).filter((x) =>
      inRange(localDay(x.paidAt))
    );
    const expenses = (await db.expenses.toArray()).filter((x) =>
      inRange(localDay(x.spentAt))
    );
    const invoices = (await db.supplierInvoices.toArray()).filter((x) =>
      inRange(x.invoiceDate) // invoice dates are already YYYY-MM-DD
    );

    // Everything ever sold and paid, for the "owed now" figure.
    const allSales = await db.sales.toArray();
    const allAllocs = await db.allocations.toArray();

    // Totals for the period (all money in pesewas).
    const cash = sum(payments.filter((p) => p.method === 'cash'), 'amount');
    const momo = sum(payments.filter((p) => p.method === 'momo'), 'amount');
    const salesTotal = sum(sales, 'total');
    const expensesTotal = sum(expenses, 'amount');
    const coldStore = sum(invoices, 'total');

    return {
      salesTotal, // new sales made in the period
      cash, // cash received (includes old debts paid in the period)
      momo, // mobile money received
      expensesTotal,
      coldStore, // cold store invoices dated in the period
      cashInHand: cash - expensesTotal, // assumes expenses are paid from cash
      roughProfit: salesTotal - coldStore - expensesTotal, // see note on screen
      owedNow: sum(allSales, 'total') - sum(allAllocs, 'amount'), // all customers, today
    };
  }, [from, to]);

  // One line of the summary: label on the left, amount on the right.
  const row = (label, value, bold) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0',
      fontWeight: bold ? 'bold' : 'normal' }}>
      <span>{label}</span>
      <span>{formatCedis(value)}</span>
    </div>
  );

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <h2>Summary</h2>
      {/* Period: from and to dates. */}
      <input type="date" value={from} max={today}
        onChange={(e) => setFrom(e.target.value)} />
      <input type="date" value={to} max={today}
        onChange={(e) => setTo(e.target.value)} />

      {s && (
        <>
          {row('Sold', s.salesTotal, true)}
          {row('Cash received', s.cash)}
          {row('Mobile money received', s.momo)}
          {row('Expenses', s.expensesTotal)}
          {row('Cash in hand (cash − expenses)', s.cashInHand, true)}
          <hr />
          {row('Owed by customers (now)', s.owedNow, true)}
          <hr />
          {row('Cold store invoices in this period', s.coldStore)}
          {row('Rough profit', s.roughProfit, true)}
          <p style={{ fontSize: 12 }}>
            Rough profit = sold − cold store invoices − expenses. It only makes
            sense over a period that covers the fish those invoices brought in
            (for example a month). For one day it compares a whole invoice with
            one day of sales.
          </p>
        </>
      )}
    </div>
  );
}