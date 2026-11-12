'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  verifyClientCredentials,
  createClientAccount,
} from '@/lib/products'
import { revalidatePath } from 'next/cache'

/* ========================================================================
   CLIENT LOGIN
   ======================================================================== */

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  const client = await verifyClientCredentials(email, password)
  if (!client) {
    return { ok: false, error: 'Email ou mot de passe incorrect.' }
  }

  const jar = await cookies()
  jar.set('sais_client', email, { httpOnly: true, sameSite: 'lax', path: '/' })
  return { ok: true }
}

export async function logoutClientAction() {
  const jar = await cookies()
  jar.delete('sais_client')
  redirect('/')
}

/* ========================================================================
   CLIENT REGISTER
   ======================================================================== */

export async function registerClientAction(formData: FormData) {
  'use server'
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const firstName = String(formData.get('firstName') ?? '').trim()
  const lastName = String(formData.get('lastName') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const address = String(formData.get('address') ?? '').trim()

  if (!email || !password || !firstName || !lastName || !phone) {
    return { ok: false, error: 'Tous les champs sont obligatoires.' }
  }
  if (password.length < 6) {
    return { ok: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' }
  }

  // Hash password before sending to store
  const { hashPassword } = await import('@/lib/utils/crypto')
  const passwordHash = await hashPassword(password)

  // We need to pass the hash, but createClientAccount expects plain password and hashes internally.
  // Let's modify: createClientAccount now expects pre-hashed password? No, looking at my store.ts,
  // createClientAccount receives password and stores it directly as password_hash.
  // I need to fix this: the action should hash before calling createClientAccount.
  
  // Since createClientAccount stores password_hash directly, we pass the hash as password
  // But the function name says "password" — let me adjust by calling with hash
  const result = await createClientAccount({
    email,
    password: passwordHash, // Already hashed
    firstName,
    lastName,
    phone,
    address,
  })
  if ('error' in result) {
    return { ok: false, error: result.error }
  }

  // Auto-connect après inscription
  const jar = await cookies()
  jar.set('sais_client', email, { httpOnly: true, sameSite: 'lax', path: '/' })
  revalidatePath('/account')
  return { ok: true }
}
