"use client"
import React, { useState, useTransition } from 'react'
import { AlertCircle, Lock, Mail, Loader2, PackageOpen } from 'lucide-react'
import { loginAction } from '@/app/actions/auth'

export default function LoginPage() {
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[] | string>>({})

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrors({})
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await loginAction(formData)
      if (result?.errors) setErrors(result.errors)
    })
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <div className="bg-surface w-full max-w-md border border-divider flex flex-col relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[6px] bg-accent" />
        <div className="p-8 pb-6 border-b border-divider flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-primary text-page flex items-center justify-center mb-4">
            <PackageOpen size={24} strokeWidth={1.5} />
          </div>
          <h1 className="font-condensed uppercase tracking-[0.1em] text-2xl text-primary font-semibold">Gudang Thermal</h1>
          <p className="text-[13px] text-secondary mt-1 font-mono uppercase tracking-wider">Sistem Manajemen Internal</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-5">
          {errors.general && (
            <div className="bg-danger/10 border-l-4 border-danger p-3 flex items-start gap-2 text-danger">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p className="text-[13px] font-medium leading-tight">{errors.general}</p>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="font-condensed uppercase text-[12px] tracking-[0.05em] text-primary">Alamat Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-secondary" size={16} />
              <input type="email" name="email" className={`w-full bg-page border pl-9 pr-3 py-2 text-[14px] focus:outline-none focus:border-primary ${errors.email ? "border-danger" : "border-divider"}`} disabled={isPending} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-condensed uppercase text-[12px] tracking-[0.05em] text-primary">Kata Sandi</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-secondary" size={16} />
              <input type="password" name="password" className={`w-full bg-page border pl-9 pr-3 py-2 text-[14px] font-mono focus:outline-none focus:border-primary ${errors.password ? "border-danger" : "border-divider"}`} disabled={isPending} />
            </div>
          </div>
          <button type="submit" disabled={isPending} className="mt-2 w-full bg-accent text-primary flex items-center justify-center font-condensed uppercase text-[14px] font-bold px-4 py-3 hover:bg-accent/90 disabled:opacity-70">
            {isPending ? <><Loader2 size={16} className="animate-spin mr-2" /> Loading...</> : "Masuk ke Sistem"}
          </button>
        </form>
      </div>
    </div>
  )
}