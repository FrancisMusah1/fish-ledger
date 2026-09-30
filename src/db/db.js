import Dexie from 'dexie';

export const db = new Dexie('fishLedger');

db.version(1).stores({
  customers: '++id, name, place',
  fishTypes: '++id, name',
  sales: '++id, customerId, soldAt',
  saleItems: '++id, saleId, fishTypeId',
  payments: '++id, customerId, paidAt',
  allocations: '++id, paymentId, saleId',
  expenses: '++id, spentAt',
});

db.version(2).stores({
    supplierInvoices: '++id, invoiceNo, invoiceDate',
    supplierPayments: '++id, invoiceId, paidAt',
  });

db.on('populate', () => {
  db.fishTypes.bulkAdd([
    { name: 'Tuna' },
    { name: 'Yellowfin (Odaa)' },
    { name: 'Doctor fish' },
  ]);
});