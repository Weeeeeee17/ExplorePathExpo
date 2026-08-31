import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

// Reject accidental placeholders and privileged secrets before any client is made.
export const isSupabaseConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl)
  && supabasePublishableKey.startsWith('sb_publishable_')
  && !supabasePublishableKey.includes('YOUR_KEY');

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      realtime: {
        params: { eventsPerSecond: 4 },
      },
    })
  : null;
