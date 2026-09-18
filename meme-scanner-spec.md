# Meme Scanner — Formula, Logic & Implementation Spec

> **Status: IMPLEMENTED** — modul: [`lib/memeScanner.ts`](lib/memeScanner.ts),
> [`lib/memeOutcomeTracker.ts`](lib/memeOutcomeTracker.ts),
> route [`app/api/meme-scanner/route.ts`](app/api/meme-scanner/route.ts),
> UI di section RADAR [`components/meme/MemeCommandCenter.tsx`](components/meme/MemeCommandCenter.tsx).
>
> ⚠ **Jangan ubah bobot/threshold di formula tanpa persetujuan owner** — angka
> ini hasil kalibrasi dari data historis (46 token, 11 "turun"), bukan tebakan.

Fitur ini **menilai kualitas memecoin baru** dari feed scanner seperti BUMP!/GMGN
(data on-chain: holder distribution, bot%, bundle%, creator history, dst) —
bukan price action candlestick.

---

## 1. Skema data input (per alert masuk)

```ts
type MemeAlert = {
  timestamp: string
  category: string          // 'NEW BONDING' | 'VOLUME SURGE' | 'EARLY WATCH' | 'GRADUATED' | 'HOT' | 'STRONG MOMENTUM' | dst
  name: string
  symbol: string
  contractAddress: string
  chain: 'SOL' | 'EVM' | string
  platform: string           // 'Pump.fun' | 'stonkfun' | dst
  ageMinutes: number         // dari '🌱 4m'
  bondingPct?: number        // undefined kalau sudah Graduated
  graduated: boolean

  mcUsd: number
  lpUsd: number
  vol1mUsd: number
  change1mPct: number
  change5mPct: number

  buys: number
  sells: number
  buySellRatio: number

  holderCount: number
  top10Pct: number
  topHolders: number[]       // [TH1, TH2, TH3, TH4, TH5] persen individual

  smartCount: number
  kolCount: number
  insiderCount: number

  botPct: number
  sniperCount: number
  bundlePct: number

  organicPct: number
  buyerCount: number

  creatorLaunches: number
  xUrl?: string
}
```

---

## 2. LOGIC — hard veto dulu, baru scoring

Urutan penting: veto keras dicek **sebelum** hitung skor, supaya token yang
jelas berbahaya tidak lolos cuma karena metrik lain kebetulan bagus.

```
FUNCTION evaluateMemeAlert(alert):

  # ── HARD VETO — langsung REJECT, skor tidak dihitung ──
  IF alert.creatorLaunches > 3000:
      RETURN REJECT("creator serial launcher (>3000 token sebelumnya) —
                      di data historis, grup token yang turun ≥10% dari
                      puncak punya rata-rata creatorLaunches 5x lipat
                      grup yang stabil")

  IF alert.lpUsd < 5000:
      RETURN REJECT("likuiditas terlalu tipis (<$5K) — risiko slippage ekstrem")

  IF alert.bundlePct > 60:
      RETURN REJECT("bundle >60% — mayoritas supply dikontrol dari launch")

  IF alert.organicPct < 25:
      RETURN REJECT("organic <25% — volume didominasi bot/wash trading")

  IF alert.topHolders[0] > 30:
      RETURN REJECT("satu wallet pegang >30% supply — risiko dump instan")

  # ── SCORING — hanya untuk yang lolos veto ──
  score = computeScore(alert)

  IF score >= 65:
      RETURN ALERT("STRONG", score)
  ELSE IF score >= 45:
      RETURN ALERT("WATCH", score)
  ELSE:
      RETURN ALERT("WEAK", score)   # tampil tapi ditandai risiko tinggi
```

---

## 3. FORMULA — scoring 0-100

Bobot di bawah disesuaikan dari temuan data historis: `creatorLaunches`
terbukti paling diskriminatif, `TH1`/`Top10%` ternyata lemah (hampir tidak beda
antara grup rug vs stabil di sample), jadi bobotnya sengaja dikecilkan
dibanding intuisi awal.

```ts
function computeScore(a: MemeAlert): number {
  const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

  // 1. Creator trust (bobot terbesar — temuan paling kuat dari data historis)
  //    log-scaled supaya tidak terlalu keras menghukum creator dengan riwayat
  //    sedang (mis. 50-500 launches), tapi tetap menghukum ekstrem (>1000).
  const creatorScore = clamp(100 - Math.log10(a.creatorLaunches + 1) * 22)

  // 2. Bundle% — makin rendah makin baik (token tidak dikontrol dari launch)
  const bundleScore = clamp(100 - a.bundlePct)

  // 3. Bot% — makin rendah makin baik (volume lebih organik)
  const botScore = clamp(100 - a.botPct)

  // 4. Smart money + KOL involvement — sinyal ada yang "tahu sesuatu" atau
  //    exposure sosial nyata (bukan jaminan, tapi bonus)
  const smartKolScore = clamp((a.smartCount + a.kolCount) * 20)

  // 5. LP/MC ratio — likuiditas relatif terhadap ukuran market cap
  //    (LP tipis vs MC besar = rawan manipulasi harga dengan modal kecil)
  const lpRatioScore = clamp((a.lpUsd / Math.max(a.mcUsd, 1)) * 80)

  // 6. Organic% — tetap dipakai tapi bobot dikecilkan (lemah di data historis)
  const organicScore = a.organicPct

  // 7. Insider penalty — insider count tinggi = red flag tambahan (bukan di
  //    formula asli, tapi masuk akal ditambahkan sebagai pelengkap)
  const insiderPenalty = Math.min(20, a.insiderCount * 7)

  const weighted =
    creatorScore   * 0.30 +
    bundleScore    * 0.20 +
    botScore       * 0.15 +
    smartKolScore  * 0.10 +
    lpRatioScore   * 0.10 +
    organicScore   * 0.15
    - insiderPenalty

  return Math.round(clamp(weighted))
}
```

---

## 4. Tracking outcome (WAJIB, supaya formula bisa dikalibrasi ulang)

Bagian paling penting yang sering dilewatkan: **simpan setiap alert yang
diputuskan (ALERT/WATCH/REJECT) beserta MC-nya**, lalu re-check MC token yang
sama secara periodik (mis. tiap 1 jam, sampai 24 jam) untuk tahu outcome
sebenarnya. Tanpa ini, formula di atas cuma tebakan yang tidak pernah
divalidasi ulang.

```ts
type TrackedOutcome = {
  contractAddress: string
  firstSeenAt: string
  firstMc: number
  decision: 'STRONG' | 'WATCH' | 'WEAK' | 'REJECT'
  score: number
  checkpoints: Array<{ at: string; mc: number }>  // diisi oleh cron job
}

// Cron job tiap 1 jam: fetch MC terbaru dari DexScreener untuk semua
// contractAddress yang tersimpan dalam 24 jam terakhir, append ke checkpoints.
// Setelah 24 jam, hitung outcome final: drawdown dari firstMc/peak, lalu
// bandingkan dengan `decision` awal untuk lihat apakah formula "benar".
```

Definisi outcome final (implementasi di `lib/memeOutcomeTracker.ts`):
- `DEAD`  = MC ≤ 5% dari firstMc
- `DOWN`  = drawdown ≥ 10% dari peak (definisi "turun" dataset historis)
- `STABLE` = selain itu
- `decisionCorrect`: STRONG/WATCH benar jika STABLE; WEAK/REJECT benar jika DOWN/DEAD.

---

## 5. Cara test manual

### a) Satu MemeAlert contoh via API

```bash
curl -X POST 'http://localhost:3000/api/meme-scanner?action=evaluate' \
  -H 'Content-Type: application/json' \
  -d '{
    "timestamp": "2026-09-11T07:00:00Z",
    "category": "NEW BONDING",
    "name": "Test Coin", "symbol": "TEST",
    "contractAddress": "TESTADDR111",
    "chain": "SOL", "platform": "Pump.fun",
    "ageMinutes": 4, "bondingPct": 42, "graduated": false,
    "mcUsd": 25000, "lpUsd": 8000, "vol1mUsd": 1200,
    "change1mPct": 5, "change5mPct": 12,
    "buys": 40, "sells": 12, "buySellRatio": 3.3,
    "holderCount": 320, "top10Pct": 18, "topHolders": [8, 4, 3, 2, 1],
    "smartCount": 2, "kolCount": 1, "insiderCount": 0,
    "botPct": 10, "sniperCount": 3, "bundlePct": 15,
    "organicPct": 72, "buyerCount": 95, "creatorLaunches": 3
  }'
# → { "ok": true, "decision": "STRONG", "score": 76, ... }
```

### b) Langsung di kode (tanpa server)

```ts
import { evaluateMemeAlert } from '@/lib/memeScanner'
const verdict = evaluateMemeAlert(alert)  // { decision, score, reason }
```

### c) Endpoint lain

- `GET  /api/meme-scanner` → snapshot outcome tracker (total/aktif/final + akurasi per decision)
- `POST /api/meme-scanner?action=evaluate-batch` → body `{ alerts: MemeAlert[] }` (dipakai radar UI)
- `POST /api/meme-scanner?action=refresh` → paksa `refreshOutcomes()` sekarang
- `POST /api/meme-scanner?action=forget&address=<mint>` → hapus satu record tracking

---

## Catatan jujur soal keterbatasan

- Formula ini dikalibrasi dari **46 token, 11 di antaranya "turun"** — sample
  sangat kecil untuk standar statistik apa pun. Anggap ini hipotesis kerja,
  bukan hukum pasti.
- "Turun dari puncak" di data historis **bukan** konfirmasi rug total (ke nol) —
  cuma snapshot terakhir yang sempat ter-capture. §4 (outcome tracker) dirancang
  justru untuk menutup gap ini ke depan.
- Begitu ada ≥50-100 outcome yang benar-benar tervalidasi (lewat tracker §4,
  terlihat di `GET /api/meme-scanner` → `accuracy`), bobot formula bisa
  direcompute dari data yang jauh lebih solid.
- Untuk token dari feed radar DexScreener/RugCheck (bukan BUMP!/GMGN), beberapa
  field tidak tersedia dan diisi proxy/netral oleh `estimateAlertFromToken()`
  (creatorLaunches=0, kolCount=0, topHolders=[], organicPct dari
  uniqueBuyers/buys, bundlePct dari deployer%+insider%). Daftar field estimasi
  ikut dikembalikan (`estimatedFields`) dan ditampilkan di tooltip badge UI.
