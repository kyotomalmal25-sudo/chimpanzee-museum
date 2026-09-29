import { copyFile } from 'node:fs/promises';
await copyFile(new URL('./node_modules/@supabase/supabase-js/dist/umd/supabase.js', import.meta.url), new URL('./supabase.js', import.meta.url));
await copyFile(new URL('./node_modules/@supabase/supabase-js/LICENSE', import.meta.url), new URL('./supabase-LICENSE', import.meta.url));
