import { db } from '../db/db';

// Export every table as one JSON text.
// db.tables lists all tables, so new tables are backed up automatically.
export async function makeBackup() {
  const data = {};
  for (const table of db.tables) {
    data[table.name] = await table.toArray();
  }
  return JSON.stringify({
    app: 'fish-ledger', // marker so restore can reject other files
    exportedAt: new Date().toISOString(),
    data,
  });
}

// Replace ALL data with the contents of a backup file.
export async function restoreBackup(text) {
  const backup = JSON.parse(text);
  // Reject files that are not a Fish Ledger backup.
  if (backup.app !== 'fish-ledger' || !backup.data) {
    throw new Error('This is not a Fish Ledger backup file.');
  }
  // One transaction: a bad file cannot leave the data half-wiped.
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear(); // remove current rows
      const rows = backup.data[table.name];
      if (rows?.length) await table.bulkAdd(rows); // load the backup rows
    }
  });
}