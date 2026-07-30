import { createClient } from '@supabase/supabase-js'

const PRICE_URL = 'https://wcbxlqbpeodspoungwwz.supabase.co'

export function createPriceAdminClient() {
  const key = process.env.PRICE_SUPABASE_SERVICE_ROLE_KEY
  console.log('[Price] env key exists:', !!key, 'length:', key?.length)
  if (!key) throw new Error('PRICE_SUPABASE_SERVICE_ROLE_KEY não configurada')
  return createClient(PRICE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}
