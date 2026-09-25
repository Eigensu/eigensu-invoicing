'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { requestPasswordReset } from '@/lib/actions/auth'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
})
type FormValues = z.infer<typeof schema>

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('email', values.email)
      await requestPasswordReset(fd)
      setSent(true)
    })
  }

  if (sent) {
    return (
      <div className="rounded-xl bg-cream-light px-4 py-4 text-sm text-charcoal-600">
        If an account exists for that email, a password reset link is on its way. Check your
        inbox (and spam folder).
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-charcoal-600">Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  autoComplete="email"
                  className="h-12 rounded-xl border-transparent bg-cream-light focus-visible:ring-navy/40 focus-visible:border-navy focus-visible:bg-white"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full h-12 rounded-xl bg-navy text-white text-sm font-semibold tracking-wide transition-colors hover:bg-navy-hover disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Send Reset Link
        </button>
      </form>
    </Form>
  )
}
