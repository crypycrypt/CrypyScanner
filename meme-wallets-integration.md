# Smart-Wallet Radar — Integrasi Data On-Chain Asli (Solana)

Menu **Meme's → WALLETS** sebelumnya **100% data simulasi**: alamat wallet
hanya placeholder pendek (`2kL...3Pw`) dari array hardcoded, dan semua metrik
(ROI, win-rate, score, DNA) dikarang dengan `Math.random()`. Itu sebabnya tombol
**SALIN** menyalin string pendek palsu, bukan alamat wallet lengkap.

Sekarang section ini **key-gated**: bila `HELIUS_API_KEY` diisi, wallet ditemukan
dari **transaksi SWAP on-chain nyata**; bila tidak, tetap fallback DEMO tetapi
**diberi label jujur** di UI.

---

## 1. Cara kerja (mode asli / `provider: "helius"`)

```
proxy dex-feed (127.0.0.1:3001)  →  10 mint token meme paling likuid/ramai
        │
        ▼
Helius Enhanced Transactions API  →  50 SWAP terbaru per mint  (type=SWAP)
        │   GET https://api.helius.xyz/v0/addresses/{mint}/transactions
        │       ?api-key=HELIUS_API_KEY&limit=50&type=SWAP
        ▼
parse tiap swap → "leg": { wallet(feePayer), side BUY/SELL, mint, sol, tokenAmount, ts }
        │
        ▼
agregasi per wallet → realized PnL (SOL), win-rate, frekuensi, kategori, sparkline
        │
        ▼
smart-money score + klasifikasi DNA → MemeWallet[] (address = alamat LENGKAP 44 char)
```

- **Wallet = `feePayer`** dari transaksi swap (penanda tangan = trader asli).
- **BUY**: `nativeInput` (SOL dibayar) + `tokenOutputs` (token diterima).
- **SELL**: `nativeOutput` (SOL diterima) + `tokenInputs` (token dijual).
- **Realized PnL** dihitung per mint: `Σ SOL hasil jual − Σ SOL biaya beli`
  (hanya posisi yang sudah ada penjualan → "closed"). Win-rate = closed profit / closed.
- **DNA** diklasifikasi dari avg holding time, win-rate, avg ROI, dan jumlah trade
  (`EARLY SNIPER`, `FAST FLIPPER`, `SWING TRADER`, `SMART ACCUMULATOR`, `SCALP BOT`,
  `CHASER`, `GENERAL TRADER`).
- **Smart-money score** 0–100 heuristik dari win-rate, ROI, aktivitas, disiplin jual,
  dan recency.

### Kejujuran data (penting)
Statistik dihitung dari **jendela transaksi yang ditarik** (swap terbaru pada
token-token yang sedang live), **bukan** riwayat 30 hari penuh tiap wallet. Karena
itu kolom yang dulu bernama "ROI 30D" sekarang **"P&L (SOL)"** = realized PnL dalam
SOL pada jendela teramati. Tidak ada angka yang dikarang di mode asli.

---

## 2. Setup API key

1. Buka **https://dashboard.helius.dev** → buat akun → **API Keys**.
   Free tier ≈ 100.000 credits/bulan (cukup untuk pemakaian dashboard).
2. Tambahkan ke `.env` (lihat `.env.example`):
   ```env
   HELIUS_API_KEY=isi_key_kamu_disini
   # opsional: paksa mode
   # SOLANA_WALLET_PROVIDER=helius      # selalu asli (butuh key)
   # SOLANA_WALLET_PROVIDER=simulated   # selalu demo
   ```
3. Restart dev server (`npm run dev`) agar env terbaca.
4. Buka menu **Meme's → WALLETS**. Banner hijau **"● LIVE ON-CHAIN · HELIUS"**
   muncul bila mode asli aktif; tombol **SALIN** kini menyalin **alamat Solana
   lengkap**.

> Tanpa key: banner kuning **"● DEMO / SIMULATED"** muncul dan data tetap placeholder.
> Mode asli **tidak** pernah diam-diam fallback ke demo — bila swap sepi, ia
> mengembalikan daftar kosong + catatan jujur (lihat `note`).

---

## 3. File yang diubah / ditambah

| File | Perubahan |
|---|---|
| `lib/meme/walletRadar.ts` | **BARU** — discovery + agregasi wallet on-chain (Helius). Export `discoverWallets()`, `hasRealWalletProvider()`, `activeWalletProvider()`, `parseSwapTx()`. |
| `app/api/meme-wallets/route.ts` | Key-gated: mode `helius` (asli) vs `simulated` (demo). Response kini membawa `provider`, `simulated`, `legs`, `mintsQueried`, `walletsSeen`, `note`. |
| `components/meme/MemeCommandCenter.tsx` | Banner LIVE/DEMO di `WalletsSection`; kolom "ROI 30D" → "P&L (SOL)"; hover alamat menampilkan alamat lengkap (`title`). |
| `.env.example` | Tambah `HELIUS_API_KEY` + `SOLANA_WALLET_PROVIDER`. |

---

## 4. Uji manual (curl)

**Mode DEMO (tanpa key):**
```bash
curl -s "http://localhost:3000/api/meme-wallets" | node -e \
 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);\
 console.log("provider:",j.provider,"| simulated:",j.simulated,"| total:",j.total);\
 console.log("address[0]:",j.wallets[0]?.address)})'
# → provider: simulated | simulated: true | address[0]: 7xQ...91m  (placeholder)
```

**Mode ASLI (setelah `HELIUS_API_KEY` diisi + restart):**
```bash
curl -s "http://localhost:3000/api/meme-wallets?refresh=1" | node -e \
 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);\
 console.log("provider:",j.provider,"| wallets:",j.total,"| legs:",j.legs,"| mints:",j.mintsQueried);\
 const w=j.wallets[0]; if(w) console.log("top:",w.shortAddr,"| full:",w.address,"| P&L:",w.roi30d,"| DNA:",w.dna,"| score:",w.smartMoneyScore)})'
# → provider: helius | wallets: N | legs: M
#   top: Ab12…wxyz | full: <alamat 44 char asli> | P&L: +x.xx SOL | DNA: ... | score: ..
```

Panjang `address` di mode asli = **32–44 karakter base58** (alamat Solana valid),
bukan 9 karakter placeholder.

---

## 5. Batasan & tuning

- **Rate limit**: discovery menarik `maxMints=10 × perMint=50` = maks ~500 tx per
  request, concurrency 4. Cache server 60s (mode asli) agar tidak boros credit.
  Turunkan `perMint`/`maxMints` di `discoverWallets()` bila credit terbatas.
- **Jendela data**: hanya swap pada token yang sedang live di proxy. Wallet yang
  hanya trading token di luar daftar seed tidak terdeteksi pada siklus itu.
- **Butuh proxy lokal** `127.0.0.1:3001/api/dex-feed/live` (sumber seed mint) —
  sama seperti yang dipakai radar token.
- **Enhanced Transactions**: parsing mengandalkan `events.swap` Helius. Bila Helius
  mengubah skema, sesuaikan `parseSwapTx()` di `lib/meme/walletRadar.ts`.
