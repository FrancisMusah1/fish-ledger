import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatCedis } from '../lib/money';

const localDay = (iso) => new Date(iso).toLocaleDateString('en-CA');
const sum = (list, field) => list.reduce((s, x) => s + x[field], 0);

export default function SummaryScreen() {
  const today = new Date().toLocaleDateString('en-CA');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const s = useLiveQuery(async () => {
    const inRange = (d) => d >= from && d <= to;

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
      inRange(x.invoiceDate)
    );

    const allSales = await db.sales.toArray();
    const allAllocs = await db.allocations.toArray();

    const cash = sum(payments.filter((p) => p.method === 'cash'), 'amount');
    const momo = sum(payments.filter((p) => p.method === 'momo'), 'amount');
    const salesTotal = sum(sales, 'total');
    const expensesTotal = sum(expenses, 'amount');
    const coldStore = sum(invoices, 'total');

    return {
      salesTotal,
      cash,
      momo,
      expensesTotal,
      coldStore,
      cashInHand: cash - expensesTotal,
      roughProfit: salesTotal - coldStore - expensesTotal,
      owedNow: sum(allSales, 'total') - sum(allAllocs, 'amount'),
    };
  }, [from, to]);

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