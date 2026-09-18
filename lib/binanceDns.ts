// ══════════════════════════════════════════════════════════════════════════
//  BINANCE DNS RESILIENCE — bypass blokir DNS level ISP/router.
//
//  Masalah nyata di mesin ini: resolver lokal (192.168.1.1) menjawab REFUSED
//  untuk *.binance.com, dan UDP:53 ke 1.1.1.1 / 8.8.8.8 / 9.9.9.9 juga
//  dibungkam (ENOTFOUND dalam <50ms). Akibatnya SEMUA fetch ke Binance gagal
//  total — bukan karena kodenya, tapi karena nama host tidak bisa di-resolve.
//
//  Yang masih jalan:
//    • DNS-over-HTTPS (1.1.1.1/dns-query, dns.google/resolve) → jawab A record
//    • koneksi TLS langsung ke IP hasil DoH dengan SNI + header Host → HTTP 200
//
//  Strategi (tanpa mock, data tetap 100% dari Binance):
//    1. coba fetch normal dulu (jaringan sehat → jalur tercepat, zero overhead)
//    2. kalau gagal dan host-nya Binance → resolve lewat DoH, cache IP-nya,
//       lalu request via node:https ke IP dengan `servername` (SNI) + Host
//    3. host yang sudah terbukti butuh DoH ditandai, jadi panggilan berikutnya
//       langsung lewat jalur DoH tanpa membuang waktu mencoba resolver lokal
//
//  Dipakai oleh signalEngine, brutalEngine, dan paperTrader.
// ══════════════════════════════════════════════════════════════════════════

import https from 'node:https'
import { lookup } from 'node:dns/promises'

const DOH_ENDPOINTS = [
  'https://1.1.1.1/dns-query?name={host}&type=A',
  'https://dns.google/resolve?name={host}&type=A',
  'https://dns.quad9.net:5053/dns-query?name={host}&type=A',
]

type DohCacheEntry = { ips: string[]; expiresAt: number; cursor: number }
type DohStore = {
  cache: Map<string, DohCacheEntry>
  needsDoh: Set<string>
  badIps: Set<string>
  lastError: string
  resolvedVia: string
}

const globalKey = '__crypycryptBinanceDns__' as const
const store = globalThis as typeof globalThis & { [globalKey]?: DohStore }
function dns(): DohStore {
  return store[globalKey] ??= { cache: new Map(), needsDoh: new Set(), badIps: new Set(), lastError: '', resolvedVia: 'system' }
}

/** Host yang perlu diperlakukan khusus karena sering diblokir DNS lokal. */
export function isBlockedProneHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h.endsWith('binance.com') || h.endsWith('binance.org') || h.endsWith('binance.us') || h.endsWith('binancefuture.com')
}

// ─── DoH resolve ────────────────────────────────────────────────────────────
async function dohResolve(hostname: string, timeoutMs = 7_000): Promise<string[]> {
  for (const template of DOH_ENDPOINTS) {
    const url = template.replace('{host}', encodeURIComponent(hostname))
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/dns-json' },
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      })
      if (!response.ok) continue
      const payload: any = await response.json()
      // Answer berisi CNAME (type 5) lalu A record (type 1) dari target-nya.
      const ips: string[] = (payload?.Answer || [])
        .filter((a: any) => a?.type === 1 && typeof a.data === 'string' && /^\d+\.\d+\.\d+\.\d+$/.test(a.data))
        .map((a: any) => a.data as string)
      const ttl = Math.min(300, Math.max(60, Number((payload?.Answer || [])[0]?.ttl) || 60))
      if (ips.length) {
        const s = dns()
        s.cache.set(hostname, { ips, expiresAt: Date.now() + ttl * 1000, cursor: 0 })
        s.resolvedVia = new URL(url).host
        return ips
      }
    } catch {
      // coba endpoint DoH berikutnya
    }
  }
  return []
}

/** IP untuk hostname: cache DoH → resolver sistem → DoH segar. */
export async function resolveIps(hostname: string): Promise<string[]> {
  const s = dns()
  const cached = s.cache.get(hostname)
  if (cached && cached.expiresAt > Date.now()) return cached.ips

  if (!s.needsDoh.has(hostname)) {
    try {
      const records = await Promise.race([
        lookup(hostname, { all: true, family: 4 }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('system dns timeout')), 2_500)),
      ])
      const ips = records.map(r => r.address).filter(Boolean)
      if (ips.length) {
        s.cache.set(hostname, { ips, expiresAt: Date.now() + 60_000, cursor: 0 })
        s.resolvedVia = 'system'
        return ips
      }
    } catch {
      // resolver lokal menolak / diblokir → tandai supaya tidak dicoba terus
      if (isBlockedProneHost(hostname)) s.needsDoh.add(hostname)
    }
  }

  const fresh = await dohResolve(hostname)
  if (fresh.length) return fresh
  // terakhir: pakai cache basi kalau ada (lebih baik daripada gagal total)
  return cached?.ips || []
}

function pickIp(hostname: string): string | null {
  const s = dns()
  const entry = s.cache.get(hostname)
  if (!entry || !entry.ips.length) return null
  const healthy = entry.ips.filter(ip => !s.badIps.has(`${hostname}:${ip}`))
  const pool = healthy.length ? healthy : entry.ips
  const ip = pool[entry.cursor % pool.length]
  entry.cursor += 1
  return ip
}

// ─── request lewat IP + SNI ─────────────────────────────────────────────────
function httpsJsonByIp(url: string, ip: string, timeoutMs: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const request = https.request(
      {
        host: ip,
        port: 443,
        path: `${target.pathname}${target.search}`,
        method: 'GET',
        servername: target.hostname, // SNI → sertifikat CloudFront valid
        headers: { Host: target.hostname, Accept: 'application/json', 'User-Agent': 'crypycrypt-engine/1.0' },
        timeout: timeoutMs,
      },
      response => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', chunk => { body += chunk })
        response.on('end', () => {
          const status = response.statusCode || 0
          if (status < 200 || status >= 300) {
            dns().badIps.add(`${target.hostname}:${ip}`)
            reject(new Error(`HTTP ${status} for ${url}`))
            return
          }
          try {
            resolve(JSON.parse(body))
          } catch (error: any) {
            reject(new Error(`JSON parse gagal (${String(error?.message || error).slice(0, 60)}) for ${url}`))
          }
        })
      },
    )
    request.on('error', error => {
      dns().badIps.add(`${target.hostname}:${ip}`)
      reject(error)
    })
    request.on('timeout', () => request.destroy(new Error(`timeout ${timeoutMs}ms for ${url}`)))
    request.end()
  })
}

async function plainJson(url: string, timeoutMs: number): Promise<any> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.json()
}

/**
 * fetch JSON yang tahan blokir DNS. Untuk host non-Binance perilakunya identik
 * dengan fetch biasa; untuk Binance ada fallback DoH + SNI otomatis.
 */
export async function fetchJsonResilient(url: string, timeoutMs = 12_000): Promise<any> {
  let hostname = ''
  try {
    hostname = new URL(url).hostname
  } catch {
    return plainJson(url, timeoutMs)
  }
  if (!isBlockedProneHost(hostname)) return plainJson(url, timeoutMs)

  const s = dns()
  if (!s.needsDoh.has(hostname)) {
    try {
      return await plainJson(url, Math.min(timeoutMs, 9_000))
    } catch (error: any) {
      s.lastError = String(error?.message || error).slice(0, 120)
      const message = String(error?.message || error)
      // hanya masalah resolusi/timeout yang dialihkan ke DoH
      if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|getaddrinfo|timeout|fetch failed|ENETUNREACH|ECONNRESET/i.test(message)) {
        s.needsDoh.add(hostname)
      } else {
        throw error // mis. HTTP 429/418 → biarkan caller yang menangani
      }
    }
  }

  let ips = await resolveIps(hostname)
  if (!ips.length) ips = await dohResolve(hostname)
  if (!ips.length) throw new Error(`DNS gagal total untuk ${hostname} (sistem + DoH)`)

  let lastError: any = null
  for (let attempt = 0; attempt < Math.min(3, Math.max(1, ips.length)); attempt += 1) {
    const ip = pickIp(hostname)
    if (!ip) break
    try {
      return await httpsJsonByIp(url, ip, timeoutMs)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error(`semua IP ${hostname} gagal`)
}

/** Status resolver — dipakai untuk logging/debug tanpa mengganggu UI. */
export function dnsStatus() {
  const s = dns()
  return {
    via: s.resolvedVia,
    dohOnly: [...s.needsDoh],
    cachedHosts: [...s.cache.keys()],
    badIps: s.badIps.size,
    lastError: s.lastError,
  }
}
