import { NextResponse, type NextRequest } from 'next/server'
import { runDailyCron } from '@/lib/automation/run'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')

  if (!secret || secret !== process.env['CRON_SECRET']) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const summary = await runDailyCron()
    return NextResponse.json({ ok: true, summary })
  } catch (err) {
    console.error('Cron run failed:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
