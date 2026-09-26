import { CANVA_API_BASE } from './config'
import { getValidAccessToken } from './tokens'
import type { CanvaAutofillTextData } from './render-data'

const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS = 45_000

async function canvaFetch(path: string, init: RequestInit): Promise<Response> {
  const accessToken = await getValidAccessToken()
  const res = await fetch(`${CANVA_API_BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error(`Canva API ${path} failed (${res.status}): ${await res.text()}`)
  }
  return res
}

interface AutofillJob {
  id: string
  status: 'in_progress' | 'success' | 'failed'
  result?: { type: 'create_design'; design: { id: string; title: string } }
  error?: { code: string; message: string }
}

interface ExportJob {
  id: string
  status: 'in_progress' | 'success' | 'failed'
  urls?: string[]
  error?: { code: string; message: string }
}

async function pollUntilDone<TJob extends { status: string }>(
  poll: () => Promise<TJob>,
): Promise<TJob> {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  for (;;) {
    const job = await poll()
    if (job.status !== 'in_progress') return job
    if (Date.now() > deadline) throw new Error('Canva job timed out')
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

async function createAutofillDesign(
  brandTemplateId: string,
  title: string,
  data: CanvaAutofillTextData,
): Promise<string> {
  const createRes = await canvaFetch('/autofills', {
    method: 'POST',
    body: JSON.stringify({ brand_template_id: brandTemplateId, title, data }),
  })
  const { job: createdJob } = (await createRes.json()) as { job: AutofillJob }

  const job = await pollUntilDone(async () => {
    const res = await canvaFetch(`/autofills/${createdJob.id}`, { method: 'GET' })
    const { job } = (await res.json()) as { job: AutofillJob }
    return job
  })

  if (job.status === 'failed' || !job.result) {
    throw new Error(`Canva autofill failed: ${job.error?.message ?? 'unknown error'}`)
  }
  return job.result.design.id
}

async function exportDesignAsPdf(designId: string): Promise<Buffer> {
  const createRes = await canvaFetch('/exports', {
    method: 'POST',
    body: JSON.stringify({ design_id: designId, format: { type: 'pdf' } }),
  })
  const { job: createdJob } = (await createRes.json()) as { job: ExportJob }

  const job = await pollUntilDone(async () => {
    const res = await canvaFetch(`/exports/${createdJob.id}`, { method: 'GET' })
    const { job } = (await res.json()) as { job: ExportJob }
    return job
  })

  const url = job.urls?.[0]
  if (job.status === 'failed' || !url) {
    throw new Error(`Canva export failed: ${job.error?.message ?? 'unknown error'}`)
  }

  const fileRes = await fetch(url)
  if (!fileRes.ok) throw new Error(`Failed to download exported PDF (${fileRes.status})`)
  return Buffer.from(await fileRes.arrayBuffer())
}

// Autofills the published Brand Template with this invoice's data, waits
// for Canva to finish rendering the design, exports it to PDF, and returns
// the file bytes. Each invoice gets a fresh, disposable Canva design — we
// never touch the template itself.
export async function generateInvoicePdfViaCanva(
  brandTemplateId: string,
  invoiceTitle: string,
  data: CanvaAutofillTextData,
): Promise<Buffer> {
  const designId = await createAutofillDesign(brandTemplateId, invoiceTitle, data)
  return exportDesignAsPdf(designId)
}
