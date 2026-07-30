import { createClient } from '@supabase/supabase-js'

const PRICE_URL = 'https://wcbxlqbpeodspoungwwz.supabase.co'

const PRICE_SERVICE_ROLE_KEY = process.env.PRICE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjYnhscWJwZW9kc3BvdW5nd3d6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg0NDk5MiwiZXhwIjoyMDk2NDIwOTkyfQ.cnrz9RptNKPDyuztLNv_nXizw8br_kKlTMYGA-3HFBI'

export function createPriceAdminClient() {
  const key = process.env.PRICE_SERVICE_KEY || process.env.PRICE_SUPABASE_SERVICE_ROLE_KEY || PRICE_SERVICE_ROLE_KEY
  return createClient(PRICE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}
