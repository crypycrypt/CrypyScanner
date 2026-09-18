import { NextRequest, NextResponse } from 'next/server'
import { command, startPaperTraderHeartbeat, tickPaperTrader } from '../../../lib/paperTrader'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Fallback arming: instrumentation.ts starts the heartbeat at server boot, but if
// the process was booted before that file existed (or instrumentation is off) the
// first API hit starts it. Either way there is exactly one timer per process, so
// the engine keeps trading while the user is on other menus.
export async function GET() { startPaperTraderHeartbeat(); return NextResponse.json(await tickPaperTrader()) }
export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action')
  if (!action || !['start', 'stop', 'close-all', 'reset', 'brutal-on', 'brutal-off'].includes(action)) return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 })
  return NextResponse.json(await command(action))
}
