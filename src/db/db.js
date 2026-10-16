import Dexie from 'dexie';

// Local browser database named "fishLedger". Data stays on this device.
export const db = new Dexie('fishLedger');

// Version 1 tables. Only fields listed here can be searched or filtered;
// other fields (amounts, notes) are still stored. ++id = auto-numbered key.
db.version(1).stores({
  customers: '++id, name, place',         // people who buy fish
  fishTypes: '++id, name',                 // tuna, doctor fish, ...
  sales: '++id, customerId, soldAt',       // one row per visit
  saleItems: '++id, saleId, fishTypeId',   // lines: pieces x price
  payments: '++id, customerId, paidAt',    // money received from customers
  allocations: '++id, paymentId, saleId',  // which payment settled which sale
  expenses: '++id, spentAt',               // small daily costs (ice, transport)
});

// Version 2 adds the cold store tables. Never edit an old version:
// to change the schema, add a new version number.
db.version(2).stores({
  supplierInvoices: '++id, invoiceNo, invoiceDate', // invoices from the cold store
  supplierPayments: '++id, invoiceId, paidAt',      // payments made to the cold store
});

// Runs once, when the database is first created: the starting fish list.
db.on('populate', () => {
  db.fishTypes.bulkAdd([
    { name: 'Tuna' },
    { name: 'Yellowfin (Odaa)' },
    { name: 'Doctor fish' },
  ]);
});