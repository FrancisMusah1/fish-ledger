import { useState } from 'react';
import { makeBackup, restoreBackup } from '../lib/backup';

export default function BackupScreen() {
  const [message, setMessage] = useState('');
  // Time of the last download on this device (kept in the browser).
  const last = localStorage.getItem('lastBackup');

  // Build the backup and download it as a .json file.
  const download = async () => {
    const json = await makeBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); // temporary download link
    a.href = url;
    a.download = `fish-ledger-backup-${new Date().toLocaleDateString('en-CA')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); // free the memory
    localStorage.setItem('lastBackup', new Date().toISOString());
    setMessage('Backup downloaded. Send the file to yourself (WhatsApp or email) so it is not only on this phone.');
  };

  // Restore from a chosen file, after asking for confirmation.
  const restore = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.confirm('This replaces ALL data on this phone with the backup. Continue?')) {
      e.target.value = ''; // cancelled: reset the file picker
      return;
    }
    try {
      await restoreBackup(await file.text());
      setMessage('Restored.');
    } catch (err) {
      setMessage('Could not restore: ' + err.message);
    }
    e.target.value = ''; // reset so the same file can be chosen again
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <h2>Backup</h2>
      <p>
        Last backup:{' '}
        {last ? new Date(last).toLocaleString('en-GB') : 'never'}
      </p>
      <button onClick={download}>Download backup</button>

      <h3>Restore from a backup file</h3>
      <input type="file" accept=".json,application/json" onChange={restore} />
      {message && <p>{message}</p>}
    </div>
  );
}