import Dexie from 'dexie';

// Tables that sync with the online database (every table in the app).
export const TABLES = [
  'customers', 'fishTypes', 'sales', 'saleItems', 'payments',
  'allocations', 'expenses', 'supplierInvoices', 'supplierPayments',
];

export const db = new Dexie('fishLedgerV2');

// Unique numeric id for every new row, so two phones never create the same id.
// = milliseconds since 1970 x 1000 + random 0-999 (about 1.7e15).
// That is below JavaScript's safe integer limit (9e15), so Number() still works,
// and it fits a Postgres bigint column.
let lastId = 0;
export const newId = () => {
  let id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  if (id <= lastId) id = lastId + 1; // never repeat on this phone, even within one millisecond
  lastId = id;
  return id;
};

// Version 1: the original tables (kept so existing phones upgrade smoothly).
db.version(1).stores({
  customers: 'id, name, place',                   // people who buy fish
  fishTypes: 'id, name',                          // tuna, doctor fish, ...
  sales: 'id, customerId, soldAt',                // one row per visit
  saleItems: 'id, saleId, fishTypeId',            // lines: pieces x price
  payments: 'id, customerId, paidAt',             // money received from customers
  allocations: 'id, paymentId, saleId',           // which payment settled which sale
  expenses: 'id, spentAt',                        // small daily costs
  supplierInvoices: 'id, invoiceNo, invoiceDate', // invoices from the cold store
  supplierPayments: 'id, invoiceId, paidAt',      // payments made to the cold store
});

// Version 2: adds the `unsynced` index to every table.
// unsynced = 1 -> not uploaded yet; 0 -> already on the server.
// Never edit an old version: schema changes always get a new version number.
db.version(2)
  .stores({
    customers: 'id, name, place, unsynced',
    fishTypes: 'id, name, unsynced',
    sales: 'id, customerId, soldAt, unsynced',
    saleItems: 'id, saleId, fishTypeId, unsynced',
    payments: 'id, customerId, paidAt, unsynced',
    allocations: 'id, paymentId, saleId, unsynced',
    expenses: 'id, spentAt, unsynced',
    supplierInvoices: 'id, invoiceNo, invoiceDate, unsynced',
    supplierPayments: 'id, invoiceId, paidAt, unsynced',
  })
  .upgrade((tx) =>
    // Rows saved before this version are marked "not uploaded", so they sync too.
    Promise.all(
      TABLES.map((name) => tx.table(name).toCollection().modify({ unsynced: 1 }))
    )
  );

// For every new row: give it an id if it has none (add and bulkAdd), and mark
// it as waiting for upload. Rows that already carry an id or an unsynced value
// (seed data, backup restores, rows downloaded from the server) keep theirs.
db.tables.forEach((table) => {
  table.hook('creating', (primKey, obj) => {
    if (obj.unsynced === undefined) obj.unsynced = 1;
    if (primKey === undefined) return newId();
  });
});

// Starting fish list. Fixed ids (1-3) so every phone has the SAME rows;
// random ids here would make each phone create duplicate fish types on sync.
db.on('populate', () => {
  db.fishTypes.bulkAdd([
    { id: 1, name: 'Tuna' },
    { id: 2, name: 'Yellowfin (Odaa)' },
    { id: 3, name: 'Doctor fish' },
  ]);
});