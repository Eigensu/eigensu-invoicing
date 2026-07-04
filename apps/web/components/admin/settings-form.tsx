'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { updateSettings, uploadLogo } from '@/lib/actions/admin'
import type { Settings } from '@eigensu/db'

const MAX_LOGO_BYTES = 2 * 1024 * 1024

const FormSchema = z.object({
  companyName: z.string().min(1, 'Required'),
  address: z.string(),
  phone: z.string(),
  email: z.string().email('Invalid email'),
  defaultTaxPercent: z.coerce.number().min(0).max(100),
  defaultCurrency: z.string().min(1),
  invoiceNumberFormat: z.string().min(1),
  defaultDueDays: z.coerce.number().int().positive(),
  declarationText: z.string(),
  founderEmailsText: z.string(),
  autoSendRecurring: z.boolean(),
})

type FormValues = z.infer<typeof FormSchema>

interface Props {
  settings: Settings | null
}

export function SettingsForm({ settings }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      companyName: settings?.companyName ?? '',
      address: settings?.address ?? '',
      phone: settings?.phone ?? '',
      email: settings?.email ?? '',
      defaultTaxPercent: Number(settings?.defaultTaxPercent ?? 0),
      defaultCurrency: settings?.defaultCurrency ?? 'INR',
      invoiceNumberFormat: settings?.invoiceNumberFormat ?? 'XXXX/YY',
      defaultDueDays: settings?.defaultDueDays ?? 30,
      declarationText: settings?.declarationText ?? '',
      founderEmailsText: (settings?.founderEmails ?? []).join('\n'),
      autoSendRecurring: settings?.autoSendRecurring ?? false,
    },
  })

  const { register, handleSubmit, watch, setValue, formState: { isSubmitting, errors } } = form
  const autoSend = watch('autoSendRecurring')

  const [logoUrl, setLogoUrl] = useState(settings?.logoUrl ?? '')
  const [logoUploading, setLogoUploading] = useState(false)

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Logo must be an image')
      e.target.value = ''
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('Logo must be smaller than 2 MB')
      e.target.value = ''
      return
    }

    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.set('logo', file)
      const result = await uploadLogo(fd)
      if (result.success) {
        setLogoUrl(result.logoUrl)
        toast.success('Logo uploaded')
      } else {
        toast.error(result.error)
      }
    } finally {
      setLogoUploading(false)
      e.target.value = ''
    }
  }

  async function onSubmit(values: FormValues) {
    const founderEmails = values.founderEmailsText
      .split(/[\n,]+/)
      .map((e) => e.trim())
      .filter(Boolean)

    const result = await updateSettings({
      companyName: values.companyName,
      ...(values.address ? { address: values.address } : {}),
      ...(values.phone ? { phone: values.phone } : {}),
      email: values.email,
      defaultTaxPercent: values.defaultTaxPercent,
      defaultCurrency: values.defaultCurrency,
      invoiceNumberFormat: values.invoiceNumberFormat,
      defaultDueDays: values.defaultDueDays,
      ...(values.declarationText ? { declarationText: values.declarationText } : {}),
      founderEmails,
      autoSendRecurring: values.autoSendRecurring,
    })

    if (result.success) {
      toast.success('Settings saved')
    } else {
      toast.error(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Company Info */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Company Info</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Company Name" error={errors.companyName?.message}>
            <Input {...register('companyName')} placeholder="Your Company Name" />
          </Field>
          <Field label="Company Email" error={errors.email?.message}>
            <Input {...register('email')} type="email" placeholder="billing@yourcompany.com" />
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            <Input {...register('phone')} placeholder="+91 XXXXX XXXXX" />
          </Field>
          <Field label="Company Logo" hint="PNG/JPG/SVG, max 2 MB. Appears on invoices.">
            <div className="flex items-center gap-3">
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Company logo"
                  className="h-10 w-10 rounded border border-slate-200 object-contain"
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={onLogoChange}
                disabled={logoUploading}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 disabled:opacity-60"
              />
            </div>
            {logoUploading && <p className="text-xs text-slate-400">Uploading…</p>}
          </Field>
        </div>
        <Field label="Address" error={errors.address?.message}>
          <textarea
            {...register('address')}
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-eigensu-blue focus:outline-none focus:ring-1 focus:ring-eigensu-blue"
            rows={3}
            placeholder="123 Main St, Mumbai, Maharashtra 400001"
          />
        </Field>
      </section>

      {/* Invoice Defaults */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Invoice Defaults</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Tax %" error={errors.defaultTaxPercent?.message}>
            <Input {...register('defaultTaxPercent')} type="number" min={0} max={100} step={0.01} />
          </Field>
          <Field label="Currency" error={errors.defaultCurrency?.message}>
            <Input {...register('defaultCurrency')} placeholder="INR" />
          </Field>
          <Field label="Invoice Format" error={errors.invoiceNumberFormat?.message}>
            <Input {...register('invoiceNumberFormat')} placeholder="XXXX/YY" />
          </Field>
          <Field label="Due Days" error={errors.defaultDueDays?.message}>
            <Input {...register('defaultDueDays')} type="number" min={1} />
          </Field>
        </div>
      </section>

      {/* Declaration */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Invoice Declaration</h3>
        <Field label="Declaration Text" error={errors.declarationText?.message}>
          <textarea
            {...register('declarationText')}
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-eigensu-blue focus:outline-none focus:ring-1 focus:ring-eigensu-blue"
            rows={3}
            placeholder="We declare that the invoice shows the actual price of services..."
          />
        </Field>
      </section>

      {/* Automation */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Automation & Alerts</h3>
        <Field
          label="Founder Alert Emails"
          hint="One email per line. CC'd on overdue reminders with ccFounders=true."
          error={errors.founderEmailsText?.message}
        >
          <textarea
            {...register('founderEmailsText')}
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-eigensu-blue focus:outline-none focus:ring-1 focus:ring-eigensu-blue"
            rows={3}
            placeholder="founder@eigensu.in"
          />
        </Field>
        <div className="flex items-center gap-3">
          <Switch
            id="autoSend"
            checked={autoSend}
            onCheckedChange={(v) => setValue('autoSendRecurring', v)}
          />
          <Label htmlFor="autoSend" className="text-sm">
            Auto-send recurring invoices
            <span className="ml-1 text-xs text-slate-400">(AMC / subscription)</span>
          </Label>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string | undefined
  error?: string | undefined
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
