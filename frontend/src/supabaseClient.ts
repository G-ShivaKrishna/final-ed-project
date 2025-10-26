import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xnipjrqziixkrbvuccyi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaXBqcnF6aWl4a3JidnVjY3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNjYxOTAsImV4cCI6MjA3MDk0MjE5MH0._gImzaLjdrUgKY1bTFtYECOaz06s4c0_KBBy1huC5A8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
export default supabase;
