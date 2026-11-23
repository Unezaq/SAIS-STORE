import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

export async function POST(request: Request) {
  try {
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
    const filename = `${randomUUID()}.${safeExt}`

    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadsDir, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(join(uploadsDir, filename), buffer)

    const url = `/uploads/${filename}`
    return NextResponse.json({ ok: true, url })
  } catch (error) {
    console.error('[upload] failed', error)
    return NextResponse.json(
      { ok: false, error: "Échec de l'upload. Réessayez." },
      { status: 500 }
    )
  }
}
