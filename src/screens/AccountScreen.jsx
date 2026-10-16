import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AccountScreen() {
  const [session, setSession] = useState(null); // null = not logged in
  const [shop, setShop] = useState(null); // the shop this user belongs to
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  // Track login state: read the saved session, then listen for sign-in/out.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s)
    );
    return () => sub.subscription.unsubscribe(); // stop listening on exit
  }, []);

  // When logged in, look up the user's shop. Row Level Security means this
  // only returns shops the user is a member of.
  useEffect(() => {
    if (!session) {
      setShop(null);
      return;
    }
    supabase
      .from('shops')
      .select('id, name')
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setMessage('Could not load shop: ' + error.message);
        else setShop(data);
      });
  }, [session]);

  // Sign in with email and password (needs internet).
  const signIn = async () => {
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else setPassword(''); // do not keep the password in memory
  };

  const signOut = () => supabase.auth.signOut();

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <h2>Account</h2>

      {!session ? (
        // Not logged in: show the login form.
        <>
          <input type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)} />
          <button onClick={signIn}>Sign in</button>
          <p>You only need to sign in to sync. The app works without it.</p>
        </>
      ) : (
        // Logged in: show who, and which shop.
        <>
          <p>Signed in as {session.user.email}</p>
          {shop ? (
            <p>Shop: {shop.name}</p>
          ) : (
            <p>Not a member of any shop yet. Ask the owner to add you.</p>
          )}
          <button onClick={signOut}>Sign out</button>
        </>
      )}
      {message && <p>{message}</p>}
    </div>
  );
}