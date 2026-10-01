import { db } from '../db/db';

export async function makeBackup() {
  const data = {};
  for (const table of db.tables) {
    data[table.name] = await table.toArray();
  }
  return JSON.stringify({
    app: 'fish-ledger',
    exportedAt: new Date().toISOString(),
    data,
  });
}

export async function restoreBackup(text) {
  const backup = JSON.parse(text);
  if (backup.app !== 'fish-ledger' || !backup.data) {
    throw new Error('This is not a Fish Ledger backup file.');
  }
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
      const rows = backup.data[table.name];
      if (rows?.length) await table.bulkAdd(rows);
    }
  });
}