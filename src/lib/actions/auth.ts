'use server'

import { redirect } from 'next/navigation'
import {
  supplierRegisterSchema,
  loginSchema,
  forgotPasswordRequestSchema,
  resetPasswordSchema,
  retailerRegisterStep1Schema,
  retailerCompleteRegistrationSchema,
  retailerPasswordResetPhoneSchema,
  retailerPasswordResetCompleteSchema,
} from '@/lib/validations/auth'
import { isMarketplaceCategorySlug } from '@/lib/supplier-marketplace-categories'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPublicSiteUrl } from '@/lib/site-url'

/** Supplier only: email + password sign-up and app rows. */
export async function registerUser(input: unknown) {
  const parsed = supplierRegisterSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: parsed.error.message }

  const { email, password, businessName, fullName, phone, city, address, marketplaceCategory } =
    parsed.data

  const slug = marketplaceCategory.trim()
  if (!isMarketplaceCategorySlug(slug)) {
    return { data: null, error: 'Invalid business category' }
  }
  const marketplace_categories = [slug]

  const site = getPublicSiteUrl()
  const supabase = supabaseServer()
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent('/email-verified')}`,
    },
  })
  if (signUpError) return { data: null, error: signUpError.message }

  const user = signUpData.user
  if (!user) {
    return { data: null, error: 'Signup succeeded but no user returned.' }
  }

  const admin = supabaseAdmin()

  const { error: usersInsertError } = await admin.from('users').insert({
    id: user.id,
    email,
    role: 'supplier',
  })
  if (usersInsertError) return { data: null, error: usersInsertError.message }

  const { error: profilesInsertError } = await admin.from('profiles').insert({
    user_id: user.id,
    name: fullName,
    phone: phone ?? null,
    business_name: businessName,
    city: city ?? null,
    address: address?.trim() ? address.trim() : null,
  })
  if (profilesInsertError) return { data: null, error: profilesInsertError.message }

  const { error: supplierInsertError } = await admin.from('suppliers').insert({
    user_id: user.id,
    marketplace_categories,
  })
  if (supplierInsertError) return { data: null, error: supplierInsertError.message }

  const needsEmailVerification = signUpData.session == null

  return { data: { userId: user.id, role: 'supplier' as const, needsEmailVerification }, error: null }
}

/** Retailer step 1: send SMS OTP (creates auth user on first successful verify). */
function zodErrorMessage(err: { issues: readonly { message: string }[] }) {
  return err.issues.map((i) => i.message).join('; ') || 'Invalid input'
}

export async function sendRetailerRegistrationOtp(input: unknown) {
  const parsed = retailerRegisterStep1Schema.safeParse(input)
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) }
  }

  const supabase = supabaseServer()
  const { error } = await supabase.auth.signInWithOtp({
    phone: parsed.data.phone,
    options: {
      shouldCreateUser: true,
      channel: 'sms',
    },
  })

  if (error) return { error: error.message }
  return { error: null }
}

/** Retailer: verify SMS, set password, optional email on auth user, insert public.users + profiles (idempotent). */
export async function completeRetailerRegistration(input: unknown) {
  const parsed = retailerCompleteRegistrationSchema.safeParse(input)
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) }
  }

  const { phone, token, password, businessName, fullName, city, address } = parsed.data
  const email = parsed.data.email?.trim() || undefined

  const supabase = supabaseServer()

  const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  })
  if (otpError) return { error: otpError.message }

  if (!otpData.user) return { error: 'Verification failed' }

  const { error: pwError } = await supabase.auth.updateUser({ password })
  if (pwError) return { error: pwError.message }

  if (email) {
    const { error: emError } = await supabase.auth.updateUser({ email })
    if (emError) return { error: emError.message }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No session after registration' }

  const admin = supabaseAdmin()
  const usersEmail = (email ?? user.email)?.trim() || null

  const { data: existingUser } = await admin.from('users').select('id').eq('id', user.id).maybeSingle()
  if (!existingUser) {
    const { error: usersInsertError } = await admin.from('users').insert({
      id: user.id,
      email: usersEmail,
      role: 'retailer',
    })
    if (usersInsertError) {
      if ((usersInsertError as { code?: string }).code !== '23505') {
        return { error: usersInsertError.message }
      }
    }
  }

  const { data: existingProfile } = await admin.from('profiles').select('id').eq('user_id', user.id).maybeSingle()
  if (!existingProfile) {
    const { error: profilesInsertError } = await admin.from('profiles').insert({
      user_id: user.id,
      name: fullName,
      phone: user.phone ?? phone,
      business_name: businessName,
      city: city ?? null,
      address: address?.trim() ? address.trim() : null,
    })
    if (profilesInsertError) {
      if ((profilesInsertError as { code?: string }).code !== '23505') {
        return { error: profilesInsertError.message }
      }
    }
  }

  const needsEmailVerification = Boolean(email) && !user.email_confirmed_at

  return { data: { userId: user.id, role: 'retailer' as const, needsEmailVerification }, error: null }
}

export async function requestPasswordReset(input: unknown) {
  const parsed = forgotPasswordRequestSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors.email?.[0] ?? 'Invalid email' }

  const supabase = supabaseServer()
  const site = getPublicSiteUrl()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${site}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
  })
  if (error) return { error: error.message }
  return { error: null }
}

/** Retailer password reset step 1: SMS OTP to an existing phone auth user (no new sign-ups). */
export async function sendRetailerPasswordResetOtp(input: unknown) {
  const parsed = retailerPasswordResetPhoneSchema.safeParse(input)
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) }
  }

  const supabase = supabaseServer()
  const { error } = await supabase.auth.signInWithOtp({
    phone: parsed.data.phone,
    options: {
      shouldCreateUser: false,
      channel: 'sms',
    },
  })

  // Avoid account enumeration — same response whether or not the number exists.
  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('signups not allowed') || msg.includes('user not found')) {
      return { error: null }
    }
    return { error: error.message }
  }
  return { error: null }
}

/** Retailer password reset step 2: verify SMS OTP and set a new password. */
export async function completeRetailerPasswordReset(input: unknown) {
  const parsed = retailerPasswordResetCompleteSchema.safeParse(input)
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) }
  }

  const { phone, token, password } = parsed.data
  const supabase = supabaseServer()

  const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  })
  if (otpError) return { error: otpError.message }
  if (!otpData.user) return { error: 'Verification failed' }

  const admin = supabaseAdmin()
  const { data: userRow } = await admin.from('users').select('role').eq('id', otpData.user.id).maybeSingle()
  if (userRow?.role !== 'retailer') {
    await supabase.auth.signOut()
    return { error: 'NOT_RETAILER_PHONE' }
  }

  const { error: pwError } = await supabase.auth.updateUser({ password })
  if (pwError) return { error: pwError.message }

  await supabase.auth.signOut()
  return { error: null }
}

export async function updatePasswordAfterReset(input: unknown) {
  const parsed = resetPasswordSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors.confirmPassword?.[0] ?? 'Invalid input' }

  const supabase = supabaseServer()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: error.message }
  return { error: null }
}

export async function loginUser(input: unknown) {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: parsed.error.message }

  const id = parsed.data.identifier.trim()
  const password = parsed.data.password

  const isEmail = id.includes('@')
  if (!isEmail && !id.startsWith('+')) {
    return {
      data: null,
      error: 'Phone sign-in requires international format starting with + (e.g. +962791234567)',
    }
  }

  const supabase = supabaseServer()
  const credentials = isEmail ? { email: id, password } : { phone: id, password }

  const { error } = await supabase.auth.signInWithPassword(credentials)
  if (error) {
    const msg = error.message || ''
    const code = String((error as unknown as { code?: string }).code ?? '')
    const isInvalidCreds =
      code === 'invalid_login_credentials' ||
      code === 'invalid_credentials' ||
      msg.toLowerCase().includes('invalid login credentials')
    if (isInvalidCreds) return { data: null, error: null, errorKey: 'invalidLoginCredentials' as const }
    return { data: null, error: msg, errorKey: null as null }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If session exists but user fetch fails, still let middleware handle it.
  if (!user) return { data: { ok: true, role: null as null | 'supplier' | 'retailer' | 'admin' }, error: null }

  const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const role = (userRow?.role ?? null) as null | 'supplier' | 'retailer' | 'admin'

  return { data: { ok: true, role }, error: null }
}

export async function logout() {
  const supabase = supabaseServer()
  await supabase.auth.signOut()
  redirect('/login')
}

/** After email verification: clear session so the user can sign in fresh on the login page. */
export async function signOutToLogin() {
  const supabase = supabaseServer()
  await supabase.auth.signOut()
  redirect('/login')
}
