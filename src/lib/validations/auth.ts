import { z } from 'zod'
import { MARKETPLACE_CATEGORY_SLUGS } from '@/lib/supplier-marketplace-categories'

/** E.164: + then country code and subscriber number (7–15 digits total after +). */
const e164Regex = /^\+[1-9]\d{6,14}$/

type V = (key: string) => string

const defaults: Record<string, string> = {
  required: 'Required',
  invalidEmail: 'Invalid email',
  passwordMin: 'Password must be at least 8 characters',
  passwordsNoMatch: 'Passwords do not match',
  invalidPhone: 'Invalid phone (use international format, e.g. +962791234567)',
  invalidCode: 'Enter the 6-digit code',
  businessNameRequired: 'Business name is required',
  fullNameRequired: 'Full name is required',
  marketplaceCategoryRequired: 'Select a business category',
  invalidMarketplaceCategory: 'Choose a valid business category',
}

function v(t: V | undefined, key: string): string {
  if (t) try { return t(key) } catch { /* fallback */ }
  return defaults[key] ?? key
}

export function createLoginSchema(t?: V) {
  return z.object({
    identifier: z.string().min(1, v(t, 'required')),
    password: z.string().min(8, v(t, 'passwordMin')),
  })
}

export function createSupplierRegisterSchema(t?: V) {
  const categorySlug = z.enum(MARKETPLACE_CATEGORY_SLUGS, {
    message: v(t, 'invalidMarketplaceCategory'),
  })

  return z
    .object({
      email: z.string().email(v(t, 'invalidEmail')),
      password: z.string().min(8, v(t, 'passwordMin')),
      confirmPassword: z.string().min(8, v(t, 'passwordMin')),
      businessName: z.string().min(1, v(t, 'businessNameRequired')),
      fullName: z.string().min(1, v(t, 'fullNameRequired')),
      phone: z.string().optional(),
      city: z.string().optional(),
      address: z.string().optional(),
      marketplaceCategory: z
        .string()
        .trim()
        .min(1, v(t, 'marketplaceCategoryRequired'))
        .pipe(categorySlug),
    })
    .refine((val) => val.password === val.confirmPassword, {
      message: v(t, 'passwordsNoMatch'),
      path: ['confirmPassword'],
    })
}

export function createRetailerRegisterStep1Schema(t?: V) {
  return z
    .object({
      phone: z.string().trim().regex(e164Regex, v(t, 'invalidPhone')),
      email: z.string().optional(),
      businessName: z.string().min(1, v(t, 'businessNameRequired')),
      fullName: z.string().min(1, v(t, 'fullNameRequired')),
      city: z.string().optional(),
      address: z.string().optional(),
    })
    .superRefine((val, ctx) => {
      const e = val.email?.trim()
      if (e && !z.string().email().safeParse(e).success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: v(t, 'invalidEmail'), path: ['email'] })
      }
    })
}

export function createRetailerVerifySchema(t?: V) {
  return z
    .object({
      token: z.string().regex(/^\d{6}$/, v(t, 'invalidCode')),
      password: z.string().min(8, v(t, 'passwordMin')),
      confirmPassword: z.string().min(8, v(t, 'passwordMin')),
    })
    .refine((val) => val.password === val.confirmPassword, {
      message: v(t, 'passwordsNoMatch'),
      path: ['confirmPassword'],
    })
}

export function createRetailerCompleteRegistrationSchema(t?: V) {
  return createRetailerRegisterStep1Schema(t)
    .extend({
      token: z.string().regex(/^\d{6}$/, v(t, 'invalidCode')),
      password: z.string().min(8, v(t, 'passwordMin')),
      confirmPassword: z.string().min(8, v(t, 'passwordMin')),
    })
    .refine((val) => val.password === val.confirmPassword, {
      message: v(t, 'passwordsNoMatch'),
      path: ['confirmPassword'],
    })
}

export function createForgotPasswordRequestSchema(t?: V) {
  return z.object({
    email: z.string().email(v(t, 'invalidEmail')),
  })
}

export function createResetPasswordSchema(t?: V) {
  return z
    .object({
      password: z.string().min(8, v(t, 'passwordMin')),
      confirmPassword: z.string().min(8, v(t, 'passwordMin')),
    })
    .refine((val) => val.password === val.confirmPassword, {
      message: v(t, 'passwordsNoMatch'),
      path: ['confirmPassword'],
    })
}

export const loginSchema = createLoginSchema()
export const supplierRegisterSchema = createSupplierRegisterSchema()
export const retailerRegisterStep1Schema = createRetailerRegisterStep1Schema()
export const retailerVerifySchema = createRetailerVerifySchema()
export const retailerCompleteRegistrationSchema = createRetailerCompleteRegistrationSchema()
export const forgotPasswordRequestSchema = createForgotPasswordRequestSchema()
export const resetPasswordSchema = createResetPasswordSchema()

export type LoginInput = z.infer<typeof loginSchema>
export type SupplierRegisterInput = z.infer<typeof supplierRegisterSchema>
export type SupplierRegisterFormInput = z.input<typeof supplierRegisterSchema>
export type RetailerRegisterStep1Input = z.infer<typeof retailerRegisterStep1Schema>
export type RetailerVerifyInput = z.infer<typeof retailerVerifySchema>
export type RetailerCompleteRegistrationInput = z.infer<typeof retailerCompleteRegistrationSchema>
export type ForgotPasswordRequestInput = z.infer<typeof forgotPasswordRequestSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

/** @deprecated use supplierRegisterSchema */
export const registerSchema = supplierRegisterSchema
/** @deprecated use SupplierRegisterInput */
export type RegisterInput = SupplierRegisterInput
