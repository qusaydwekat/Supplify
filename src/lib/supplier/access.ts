import 'server-only'

import { supabaseServer } from '@/lib/supabase/server'

export const MIN_PUBLISH_COMPLETENESS_SCORE = 85

export type SupplierAccess = {
  supplierId: string
  role: 'owner' | 'manager' | 'viewer'
  canManageCatalog: boolean
  canAdjustInventory: boolean
}

export type SupplierActionContext = {
  supplierId: string
  role: SupplierAccess['role']
  supabase: ReturnType<typeof supabaseServer>
}

export async function resolveSupplierAccess(): Promise<
  { access: SupplierAccess; error: null } | { access: null; error: string }
> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { access: null, error: 'Unauthorized' }

  const { data: owner } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  if (owner) {
    return {
      access: {
        supplierId: owner.id,
        role: 'owner',
        canManageCatalog: true,
        canAdjustInventory: true,
      },
      error: null,
    }
  }

  const { data: member } = await supabase
    .from('supplier_team_members')
    .select('supplier_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) return { access: null, error: 'Supplier record not found' }

  const role = member.role === 'manager' ? 'manager' : 'viewer'
  return {
    access: {
      supplierId: member.supplier_id,
      role,
      canManageCatalog: role === 'manager',
      canAdjustInventory: role === 'manager',
    },
    error: null,
  }
}

export async function getSupplierActionContext(options?: {
  requireCatalog?: boolean
  requireInventory?: boolean
}): Promise<
  { ctx: SupplierActionContext; error: null } | { ctx: null; error: string }
> {
  const resolved = await resolveSupplierAccess()
  if (!resolved.access) return { ctx: null, error: resolved.error }

  if (options?.requireCatalog && !resolved.access.canManageCatalog) {
    return { ctx: null, error: 'Your team role cannot manage the product catalog' }
  }

  if (options?.requireInventory && !resolved.access.canAdjustInventory) {
    return { ctx: null, error: 'Your team role cannot adjust inventory' }
  }

  return {
    ctx: {
      supplierId: resolved.access.supplierId,
      role: resolved.access.role,
      supabase: supabaseServer(),
    },
    error: null,
  }
}
