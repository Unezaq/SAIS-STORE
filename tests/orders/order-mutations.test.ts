import { describe, it, expect, beforeEach, vi } from 'vitest'

import { SupabaseMock } from '../lib/supabase-mock'

const supabaseMock = new SupabaseMock()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => supabaseMock,
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => supabaseMock,
}))

import { cancelOrder, returnOrder, updateOrderStatus } from '@/lib/services/orders.service'

beforeEach(() => {
  supabaseMock.reset()
  vi.restoreAllMocks()
})

/**
 * The SQL RPCs authorize with auth.uid(). The service layer must therefore
 * never forward a caller-supplied actor id when a real session exists, and
 * must fail closed when there is no session at all.
 */
describe('order mutations — the RPC actor is always the verified session', () => {
  it('cancelOrder ignores a caller-supplied actor id and uses the session user', async () => {
    supabaseMock.setUser({ id: 'session-user-1' })
    const rpcSpy = vi.spyOn(supabaseMock, 'rpc')

    const result = await cancelOrder('ord-1', 'attacker-actor', 'admin', 'cancel:ord-1')

    expect(result.ok).toBe(true)
    expect(rpcSpy).toHaveBeenCalledWith(
      'cancel_order_rpc',
      expect.objectContaining({
        p_order_id: 'ord-1',
        p_actor_id: 'session-user-1',
        p_actor_type: 'admin',
        p_idempotency_key: 'cancel:ord-1',
      })
    )
  })

  it('cancelOrder fails closed when there is no session and no actor', async () => {
    supabaseMock.setUser(null)
    const rpcSpy = vi.spyOn(supabaseMock, 'rpc')

    const result = await cancelOrder('ord-1', null, 'customer')

    expect(result.ok).toBe(false)
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it('returnOrder sends an empty item list so SQL derives a full return', async () => {
    supabaseMock.setUser({ id: 'admin-1' })
    const rpcSpy = vi.spyOn(supabaseMock, 'rpc')

    const result = await returnOrder('ord-1', null, [], 'return:ord-1')

    expect(result.ok).toBe(true)
    expect(rpcSpy).toHaveBeenCalledWith(
      'return_order_rpc',
      expect.objectContaining({
        p_order_id: 'ord-1',
        p_actor_id: 'admin-1',
        p_return_items: [],
        p_idempotency_key: 'return:ord-1',
      })
    )
  })

  it('updateOrderStatus(annulee) goes through the cancellation RPC', async () => {
    supabaseMock.setUser({ id: 'admin-1' })
    const rpcSpy = vi.spyOn(supabaseMock, 'rpc')

    await updateOrderStatus('ord-1', 'annulee', null, 'admin')

    expect(rpcSpy).toHaveBeenCalledWith(
      'cancel_order_rpc',
      expect.objectContaining({
        p_order_id: 'ord-1',
        p_actor_id: 'admin-1',
        p_actor_type: 'admin',
      })
    )
  })

  it('updateOrderStatus(expediee) uses a direct update, not an RPC', async () => {
    supabaseMock.setUser({ id: 'admin-1' })
    const rpcSpy = vi.spyOn(supabaseMock, 'rpc')

    await updateOrderStatus('ord-1', 'expediee', 'admin-1', 'admin')

    expect(rpcSpy).not.toHaveBeenCalled()
  })
})
