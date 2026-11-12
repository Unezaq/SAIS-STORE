import { getSettings } from '@/lib/products'
import { SettingsForm } from '@/components/admin/SettingsForm'

export default async function AdminSettingsPage() {
  const settings = await getSettings()
  return (
    <div className="flex flex-col gap-fib-4">
      <div>
        <p className="text-eyebrow uppercase text-text-muted">Configuration</p>
        <h1 className="mt-fib-1 text-title text-ink">Paramètres</h1>
      </div>
      <div className="rounded-[20px] bg-white p-fib-4 shadow-sm ring-1 ring-hairline">
        <SettingsForm initial={settings} />
      </div>
    </div>
  )
}
