// Server boot hook (Next.js instrumentation): starts the paper-trader heartbeat
// so the engine keeps scanning, marking prices and managing SL/TP even when the
// dashboard is not open / the user is browsing other menus. Also starts the
// meme outcome tracker heartbeat (hourly DexScreener MC re-check, spec §4) so
// scanner decisions keep getting validated in the background.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startPaperTraderHeartbeat } = await import('./lib/paperTrader')
    startPaperTraderHeartbeat()
    const { startMemeOutcomeHeartbeat } = await import('./lib/memeOutcomeTracker')
    startMemeOutcomeHeartbeat()
  }
}
