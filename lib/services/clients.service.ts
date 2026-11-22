import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { StoreClient } from '@/lib/types/store'

export type AdminClientEntry = {
  id: string
  kind: 'guest' | 'customer'
  name: string
  phone: string
  email: string | null
  orderCount: number
  joinedAt: string
}

type ClientRow = {
  id: string
  phone: string
  first_name: string
  last_name: string
  email: string | null
  city: string
  address: string | null
  order_count: number
  total_spent: number
  created_at: string
  updated_at: string
}

function mapClient(row: ClientRow): StoreClient {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    address: row.address ?? undefined,
    orderCount: row.order_count,
    totalSpent: Number(row.total_spent),
    createdAt: row.created_at,
  }
}

export async function getAdminClients(): Promise<AdminClientEntry[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  const rows = (data ?? []) as ClientRow[]
  return rows.map((client) => ({
    id: client.id,
    kind: 'guest',
    name: `${client.first_name} ${client.last_name}`.trim(),
    phone: client.phone,
    email: client.email,
    orderCount: client.order_count,
    joinedAt: client.created_at,
  }))
}

export async function getClients(): Promise<StoreClient[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => mapClient(row as ClientRow))
}

export async function getClientByPhone(phone: string): Promise<StoreClient | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('phone', phone)
    .maybeSingle()

  if (error) throw error
  return data ? mapClient(data as ClientRow) : null
}
