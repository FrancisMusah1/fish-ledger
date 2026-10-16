import { createClient } from '@supabase/supabase-js';


// supabase-js saves the login in the browser, so it survives restarts.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);