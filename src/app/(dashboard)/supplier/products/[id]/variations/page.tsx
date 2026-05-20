import { redirect } from 'next/navigation'

export default async function SupplierProductVariationsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/supplier/products/${id}?tab=skus`)
}
