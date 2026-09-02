import { createClient } from '@supabase/supabase-js'

// Public browser configuration for the shared One Little Teacher Cloud backend.
// These values may be overridden by deployment environment variables later.
// Never place a secret/service-role key in the PWA.
const url = import.meta.env.VITE_SUPABASE_URL?.trim() || 'https://qdslvqfvfwduvpgugozg.supabase.co'
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || 'sb_publishable_jSLitt7V_zwK2_W3YqI0jg_0oV-QZbw'

export const isCloudConfigured = Boolean(url && publishableKey)

export const supabase = isCloudConfigured
  ? createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
