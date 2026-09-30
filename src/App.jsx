import { useState } from 'react';
import SaleScreen from './screens/SaleScreen';
import StatementScreen from './screens/StatementScreen';
import PaymentScreen from './screens/PaymentScreen';
import DebtsScreen from './screens/DebtsScreen';
import PurchasesScreen from './screens/PurchasesScreen';
import ExpensesScreen from './screens/ExpensesScreen';
import SummaryScreen from './screens/SummaryScreen';

export default function App() {
  const [tab, setTab] = useState('sale');

  return (
    <>
      <nav style={{ display: 'flex', gap: 8, padding: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setTab('sale')}>New sale</button>
        <button onClick={() => setTab('payment')}>Payment</button>
        <button onClick={() => setTab('statement')}>Statements</button>
        <button onClick={() => setTab('debts')}>Who owes me</button>
        <button onClick={() => setTab('purchases')}>Cold store</button>
        <button onClick={() => setTab('expenses')}>Expenses</button>
        <button onClick={() => setTab('summary')}>Summary</button>
      </nav>
      {tab === 'sale' && <SaleScreen />}
      {tab === 'payment' && <PaymentScreen />}
      {tab === 'statement' && <StatementScreen />}
      {tab === 'debts' && <DebtsScreen />}
      {tab === 'purchases' && <PurchasesScreen />}
      {tab === 'expenses' && <ExpensesScreen />}
      {tab === 'summary' && <SummaryScreen />}
    </>
  );
}