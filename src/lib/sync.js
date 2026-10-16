import { db, TABLES } from '../db/db';
import { supabase } from './supabase';

const PUSH_BATCH = 200; // rows per upload (keeps server timestamps distinct)
const PULL_PAGE = 1000; // rows per download
// Each download re-checks the last 10 minutes, so a record that reached the
// server late is never missed. Re-downloaded rows are harmless duplicates.
const OVERLAP_MS = 10 * 60 * 1000;

let running = false; // stops two syncs from overlapping

// How many local rows are still waiting to be uploaded.
export async function countUnsynced() {
  let n = 0;
  for (const name of TABLES) {
    n += await db.table(name).where('unsynced').equals(1).count();
  }
  return n;
}

// The shop this user belongs to. Row Level Security returns only their own.
async function getShopId() {
  const { data, error } = await supabase
    .from('shops')
    .select('id')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Not a member of any shop');
  return data.id;
}

// UPLOAD: send rows marked unsynced = 1, then mark them 0.
async function push(shopId) {
  for (const name of TABLES) {
    const table = db.table(name);
    for (;;) {
      const rows = await table
        .where('unsynced')
        .equals(1)
        .limit(PUSH_BATCH)
        .toArray();
      if (rows.length === 0) break; // this table is done

      // One online record per row: the whole row is stored as JSON in `data`.
      const records = rows.map((row) => {
        const data = { ...row };
        delete data.unsynced; // local bookkeeping, not part of the record
        return { shop_id: shopId, table_name: name, id: data.id, data };
      });

      // ignoreDuplicates: a record that is already online is left alone.
      const { error } = await supabase
        .from('records')
        .upsert(records, {
          onConflict: 'shop_id,table_name,id',
          ignoreDuplicates: true,
        });
      if (error) throw error;

      // Only after the server accepted them, mark them as uploaded.
      await table
        .where('id')
        .anyOf(rows.map((r) => r.id))
        .modify({ unsynced: 0 });
    }
  }
}

// DOWNLOAD: fetch records newer than the last one this phone saw.
async function pull(shopId) {
  const key = 'lastPull:' + shopId;
  const saved = localStorage.getItem(key); // newest record time seen so far
  // Start slightly before it (OVERLAP_MS) so late-arriving records are not missed.
  let cursor = saved
    ? new Date(Date.parse(saved) - OVERLAP_MS).toISOString()
    : '1970-01-01T00:00:00Z';
  let newest = saved || '';

  for (;;) {
    const { data, error } = await supabase
      .from('records')
      .select('table_name, id, data, created_at')
      .eq('shop_id', shopId)
      .gte('created_at', cursor)
      .order('created_at', { ascending: true })
      .limit(PULL_PAGE);
    if (error) throw error;
    if (data.length === 0) break;

    // Group rows by table, then save each group locally (bulkPut = add or replace).
    const byTable = {};
    for (const r of data) {
      if (!TABLES.includes(r.table_name)) continue; // ignore unknown tables
      (byTable[r.table_name] ||= []).push({ ...r.data, id: r.id, unsynced: 0 });
    }
    for (const [name, rows] of Object.entries(byTable)) {
      await db.table(name).bulkPut(rows);
    }

    const last = data[data.length - 1].created_at;
    if (last > newest) newest = last;
    // Stop at the last page, or if the cursor can no longer move forward.
    if (data.length < PULL_PAGE || last === cursor) break;
    cursor = last;
  }
  if (newest) localStorage.setItem(key, newest);
}

// One full sync: upload first, then download.
// Returns false if a sync was already running. Throws with a short message
// when something is wrong (offline, not signed in, ...).
export async function syncNow() {
  if (running) return false;
  if (!navigator.onLine) throw new Error('Offline');
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Sign in to sync');

  running = true;
  try {
    const shopId = await getShopId();
    await push(shopId);
    await pull(shopId);
    return true;
  } finally {
    running = false; // always release, even after an error
  }
}