import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { toPesewas, formatCedis } from '../lib/money';

// Today as YYYY-MM-DD (the format date inputs use).
const today = () => new Date().toLocaleDateString('en-CA');
// Invoice dates are plain 'YYYY-MM-DD' text; show them as e.g. "22 Aug".
const fmtDate = (d) =>
  new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });

// One invoice in the list, with its own "Pay supplier" box.
// It is a separate component so each invoice keeps its own typed amount.
function InvoiceRow({ inv }) {
  const [amount, setAmount] = useState('');
  const owing = inv.total - inv.paid; // what is still owed on this invoice

  // Record a payment to the cold store against this invoice.
  const pay = async () => {
    const p = toPesewas(amount || 0);
    if (p <= 0 || p > owing) return; // ignore empty or too-large amounts
    await db.supplierPayments.add({
      invoiceId: inv.id,
      amount: p,
      paidAt: new Date().toISOString(),
    });
    setAmount('');
  };

  return (
    <div style={{ borderTop: '1px solid #ccc', padding: '8px 0' }}>
      <strong>{fmtDate(inv.invoiceDate)}</strong>
      {inv.invoiceNo ? ` #${inv.invoiceNo}` : ''}
      {/* quantity × unit price = total, as written on the invoice */}
      <div>
        {inv.quantity} × {inv.unitPrice / 100} = {formatCedis(inv.total)}
      </div>
      <div>
        Paid: {formatCedis(inv.paid)} | Owing: {formatCedis(owing)}
      </div>
      {/* Payment box only while something is still owed. */}
      {owing > 0 && (
        <>
          <input type="number" placeholder="Pay supplier" value={amount}
            onChange={(e) => setAmount(e.target.value)} />
          <button onClick={pay}>Pay</button>
        </>
      )}
    </div>
  );
}

export default function PurchasesScreen() {
  // New-invoice form state (quantity and price are typed as on the invoice).
  const [invoiceNo, setInvoiceNo] = useState('');
  const [date, setDate] = useState(today());
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState(''); // unit price in cedis
  const [paid, setPaid] = useState(''); // amount paid now, in cedis
  const [message, setMessage] = useState('');

  // All invoices, newest first, each with the sum of its payments.
  const invoices = useLiveQuery(async () => {
    const list = await db.supplierInvoices
      .orderBy('invoiceDate')
      .reverse()
      .toArray();
    const pays = await db.supplierPayments.toArray();
    return list.map((inv) => ({
      ...inv,
      paid: pays
        .filter((p) => p.invoiceId === inv.id)
        .reduce((sum, p) => sum + p.amount, 0),
    }));
  }, []);

  // Live total for the form (pesewas) and the total owed to the cold store.
  const total = Math.round(Number(quantity || 0) * toPesewas(price || 0));
  const totalOwing =
    invoices?.reduce((sum, i) => sum + (i.total - i.paid), 0) || 0;

  // Save the invoice (and any payment made now) in one transaction.
  const save = async () => {
    const paidP = toPesewas(paid || 0);
    // Checks: stop with a message if something is missing or wrong.
    if (!date || Number(quantity) <= 0 || Number(price) <= 0)
      return setMessage('Enter date, quantity and price.');
    if (paidP < 0 || paidP > total)
      return setMessage('Paid must be between 0 and the total.');

    await db.transaction(
      'rw',
      db.supplierInvoices,
      db.supplierPayments,
      async () => {
        // 1) The invoice (money in pesewas).
        const invoiceId = await db.supplierInvoices.add({
          invoiceNo: invoiceNo.trim(),
          invoiceDate: date,
          quantity: Number(quantity),
          unitPrice: toPesewas(price),
          total,
          enteredAt: new Date().toISOString(), // when it was typed in
        });
        // 2) The payment made now (if any).
        if (paidP > 0) {
          await db.supplierPayments.add({
            invoiceId,
            amount: paidP,
            paidAt: new Date().toISOString(),
          });
        }
      }
    );

    // Clear the form for the next invoice (date stays).
    setInvoiceNo('');
    setQuantity('');
    setPrice('');
    setPaid('');
    setMessage('Saved.');
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <h2>Cold store invoices</h2>
      <h3>Total owed to cold store: {formatCedis(totalOwing)}</h3>

      {/* New invoice form. */}
      <input type="date" value={date} max={today()}
        onChange={(e) => setDate(e.target.value)} />
      <input placeholder="Invoice no." value={invoiceNo}
        onChange={(e) => setInvoiceNo(e.target.value)} />
      <input type="number" placeholder="Quantity (as on invoice)" value={quantity}
        onChange={(e) => setQuantity(e.target.value)} />
      <input type="number" placeholder="Unit price" value={price}
        onChange={(e) => setPrice(e.target.value)} />
      <p>Total: {formatCedis(total)}</p>
      <input type="number" placeholder="Paid now" value={paid}
        onChange={(e) => setPaid(e.target.value)} />
      <button onClick={save}>Save invoice</button>
      {message && <p>{message}</p>}

      {/* Saved invoices, newest first. */}
      {invoices?.map((inv) => (
        <InvoiceRow key={inv.id} inv={inv} />
      ))}
    </div>
  );
}