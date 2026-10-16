import { useEffect, useState } from 'react';
import SaleScreen from './screens/SaleScreen';
import StatementScreen from './screens/StatementScreen';
import PaymentScreen from './screens/PaymentScreen';
import DebtsScreen from './screens/DebtsScreen';
import PurchasesScreen from './screens/PurchasesScreen';
import ExpensesScreen from './screens/ExpensesScreen';
import SummaryScreen from './screens/SummaryScreen';
import BackupScreen from './screens/BackupScreen';

export default function App() {
  // Which screen is showing.
  const [tab, setTab] = useState('sale');

  // Ask the browser to keep this site's data (not clear it when storage is low).
  // The browser may refuse, so a backup file is still the real protection.
  useEffect(() => {
    navigator.storage?.persist?.();
  }, []);

  return (
    <>
      {/* Menu: one button per screen. */}
      <nav style={{ display: 'flex', gap: 8, padding: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setTab('sale')}>New sale</button>
        <button onClick={() => setTab('payment')}>Payment</button>
        <button onClick={() => setTab('statement')}>Statements</button>
        <button onClick={() => setTab('debts')}>Who owes me</button>
        <button onClick={() => setTab('purchases')}>Cold store</button>
        <button onClick={() => setTab('expenses')}>Expenses</button>
        <button onClick={() => setTab('summary')}>Summary</button>
        <button onClick={() => setTab('backup')}>Backup</button>
      </nav>

      {/* Show only the screen matching the chosen tab. */}
      {tab === 'sale' && <SaleScreen />}
      {tab === 'payment' && <PaymentScreen />}
      {tab === 'statement' && <StatementScreen />}
      {tab === 'debts' && <DebtsScreen />}
      {tab === 'purchases' && <PurchasesScreen />}
      {tab === 'expenses' && <ExpensesScreen />}
      {tab === 'summary' && <SummaryScreen />}
      {tab === 'backup' && <BackupScreen />}
    </>
  );
}