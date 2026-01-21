import { createClient } from '@supabase/supabase-js';

// Supabase Read-Only Client (Public ANON key)
export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
