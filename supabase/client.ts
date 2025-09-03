import { createClient } from '@supabase/supabase-js';

// These are public-facing keys, safe to be exposed in a browser.
// Row Level Security is enabled in the Supabase dashboard.
const SUPABASE_URL = 'https://wdamqufoiswvmflszcbz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkYW1xdWZvaXN3dm1mbHN6Y2J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5OTkyNzcsImV4cCI6MjA3MTU3NTI3N30.Ju9lTfaxFlJvJe3FnPzOSYulI1SpRBFPtznADQeqb1k';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
