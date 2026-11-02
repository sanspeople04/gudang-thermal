import { AlertCircle, CheckCircle2 } from 'lucide-react'

export const inputCls =
  'w-full bg-page border border-divider px-3 py-2 text-[14px] focus:outline-none focus:border-primary disabled:opacity-60'
export const labelCls = 'font-condensed uppercase text-[12px] tracking-[0.05em] text-primary'
export const btnPrimary =
  'bg-accent text-primary font-condensed uppercase tracking-wider text-[14px] font-bold px-4 py-3 hover:bg-accent/90 disabled:opacity-60'

export function Pesan({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icon = ok ? CheckCircle2 : AlertCircle
  return (
    <div
      className={`border-l-4 p-3 flex items-start gap-2 text-[13px] font-medium ${
        ok ? 'bg-safe border-primary text-primary' : 'bg-danger/10 border-danger text-danger'
      }`}
      role={ok ? 'status' : 'alert'}
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      <p className="leading-tight">{children}</p>
    </div>
  )
}

export function GalatField({ msgs }: { msgs?: string[] }) {
  if (!msgs?.length) return null
  return <p className="text-[12px] text-danger mt-0.5">{msgs[0]}</p>
}
