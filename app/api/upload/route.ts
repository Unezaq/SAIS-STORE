import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedUser } from '@/lib/security/auth'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const STORAGE_BUCKET = 'product-images'

async function assertAdmin(): Promise<void> {
  const user = await getAuthenticatedUser()
  if (!user) {
    throw new Error('Non authentifié')
  }
  const isAdmin =
    user.app_metadata?.role === 'admin' ||
    (await (async () => {
      const supabase = createAdminClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      return profile?.role === 'admin'
    })())
  if (!isAdmin) {
    throw new Error('Non autorisé')
  }
}

export async function POST(request: Request) {
  try {
    await assertAdmin()

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Aucun fichier reçu.' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { ok: false, error: 'Format non supporté. Utilisez JPEG, PNG, WebP ou GIF.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { ok: false, error: 'Fichier trop volumineux (max 5 Mo).' },
        { status: 400 }
      )
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg'
    const filename = `${crypto.randomUUID()}.${safeExt}`

    const supabase = createAdminClient()
    const buffer = Buffer.from(await file.arrayBuffer())

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filename, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('[upload] storage error', error)
      return NextResponse.json(
        { ok: false, error: "Échec de l'upload. Réessayez." },
        { status: 500 }
      )
    }

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path)

    return NextResponse.json({ ok: true, url: urlData.publicUrl, path: data.path })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Non authentifié' || error.message === 'Non autorisé') {
        return NextResponse.json({ ok: false, error: error.message }, { status: 403 })
      }
    }
    console.error('[upload] failed', error)
    return NextResponse.json(
      { ok: false, error: "Échec de l'upload. Réessayez." },
      { status: 500 }
    )
  }
}
