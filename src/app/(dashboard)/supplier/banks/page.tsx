import { redirect } from 'next/navigation'

/** Banks directory moved off the supplier dashboard (managed via admin). */
export default function SupplierBanksRedirectPage() {
  redirect('/supplier')
}
