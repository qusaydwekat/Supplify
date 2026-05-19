/**
 * Seeds Supabase test users for E2E. Run once with service role key:
 * npx tsx src/tests/e2e/helpers/seed.ts
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

async function seed() {
  console.log('Seeding E2E test accounts…')

  for (const [email, role, business] of [
    ['test-supplier@supplify.test', 'supplier', 'Test Supplier Co.'] as const,
    ['test-retailer@supplify.test', 'retailer', 'Test Retailer Shop'] as const,
  ]) {
    const { data: existing } = await supabase.auth.admin.listUsers()
    const found = existing.users.find((u) => u.email === email)
    if (!found) {
      await supabase.auth.admin.createUser({
        email,
        password: 'TestPassword123!',
        email_confirm: true,
        user_metadata: { role },
      })
    }
    console.log(`  ✓ ${email}`)
  }

  console.log('Done. Set E2E_ENABLED=1 and run: npm run test:e2e')
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
