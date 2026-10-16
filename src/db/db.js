import Dexie from 'dexie';

// New database name: the primary keys changed, and Dexie cannot change keys
// on an existing database. (Old test data stays in "fishLedger", unused.)
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

// All tables. `id` is our own unique number (no ++ auto-numbering).
// Only fields listed after the id can be searched or filtered.
db.version(1).stores({
  customers: 'id, name, place',                  // people who buy fish
  fishTypes: 'id, name',                         // tuna, doctor fish, ...
  sales: 'id, customerId, soldAt',               // one row per visit
  saleItems: 'id, saleId, fishTypeId',           // lines: pieces x price
  payments: 'id, customerId, paidAt',            // money received from customers
  allocations: 'id, paymentId, saleId',          // which payment settled which sale
  expenses: 'id, spentAt',                       // small daily costs
  supplierInvoices: 'id, invoiceNo, invoiceDate', // invoices from the cold store
  supplierPayments: 'id, invoiceId, paidAt',      // payments made to the cold store
});

// Give every new row an id automatically (add and bulkAdd), so the screens
// need no changes. Rows that already have an id (seed data, backup restores,
// rows downloaded from the server) keep theirs.
db.tables.forEach((table) => {
  table.hook('creating', (primKey) => {
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