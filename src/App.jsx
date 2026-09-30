import { useState } from 'react';
import SaleScreen from './screens/SaleScreen';
import StatementScreen from './screens/StatementScreen';
import PaymentScreen from './screens/PaymentScreen';

export default function App() {
  const [tab, setTab] = useState('sale');

  return (
    <>
      <nav style={{ display: 'flex', gap: 8, padding: 16 }}>
        <button onClick={() => setTab('sale')}>New sale</button>
        <button onClick={() => setTab('payment')}>Payment</button>
        <button onClick={() => setTab('statement')}>Statements</button>
      </nav>
      {tab === 'sale' && <SaleScreen />}
      {tab === 'payment' && <PaymentScreen />}
      {tab === 'statement' && <StatementScreen />}
    </>
  );
}