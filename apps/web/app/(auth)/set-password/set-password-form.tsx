'use client'

import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { setPassword } from '@/lib/actions/set-password'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
type FormValues = z.infer<typeof schema>

interface Props {
  token: string
}

export function SetPasswordForm({ token }: Props) {
  const [pending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('token', token)
      fd.set('password', values.password)
      const result = await setPassword(fd)
      if (result?.error) {
        toast.error(result.error)
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold uppercase tracking-wide text-charcoal-600">
                New password
              </FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="h-[42px] border-border focus-visible:ring-navy/40 focus-visible:border-navy"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold uppercase tracking-wide text-charcoal-600">
                Confirm password
              </FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="h-[42px] border-border focus-visible:ring-navy/40 focus-visible:border-navy"
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
          className="mt-2 w-full h-11 rounded-lg bg-navy text-white text-sm font-semibold tracking-wide transition-colors hover:bg-navy-hover disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Set password
        </button>
      </form>
    </Form>
  )
}
