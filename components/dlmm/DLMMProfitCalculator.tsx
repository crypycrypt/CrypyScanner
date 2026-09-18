"use client"
import { useState, useMemo } from 'react'

export default function DLMMProfitCalculator() {
  const [capital, setCapital] = useState(1000)
  const [priceRangeMin, setPriceRangeMin] = useState(135)
  const [priceRangeMax, setPriceRangeMax] = useState(150)
  const [duration, setDuration] = useState(30)
  const [apr, setApr] = useState(28.5)

  // Calculations
  const calculations = useMemo(() => {
    const dailyRate = apr / 365
    const estimatedDailyFee = capital * (dailyRate / 100)
    const estimatedMonthlyFee = estimatedDailyFee * duration
    const estimatedAPY = apr // For simplicity, assume APY = APR
    
    // Break even point calculation
    const priceRange = priceRangeMax - priceRangeMin
    const midPrice = (priceRangeMax + priceRangeMin) / 2
    const ilRiskPercent = (priceRange / midPrice) * 10 // Simplified IL calculation
    const ilLoss = capital * (ilRiskPercent / 100)
    const breakEvenDays = ilLoss > 0 ? Math.ceil((ilLoss * 365) / (estimatedDailyFee * 365)) : 0

    return {
      estimatedDailyFee,
      estimatedMonthlyFee,
      estimatedAPY,
      ilRiskPercent,
      ilLoss,
      breakEvenDays,
      netProfit: estimatedMonthlyFee - ilLoss,
    }
  }, [capital, priceRangeMin, priceRangeMax, duration, apr])

  return (
    <div className="space-y-4">
      {/* Input Section */}
      <div className="card-glass rounded-xl p-4">
        <h3 className="font-semibold text-slate-100 mb-4">Calculator Inputs</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Capital */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Modal (USDC)
            </label>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value))}
              className="w-full rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-3 py-2 text-slate-100"
            />
            <div className="text-xs text-slate-400 mt-1">Quick select:</div>
            <div className="flex gap-1 mt-1 flex-wrap">
              {[100, 500, 1000, 5000, 10000].map((val) => (
                <button
                  key={val}
                  onClick={() => setCapital(val)}
                  className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                    capital === val
                      ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300'
                      : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-slate-400'
                  }`}
                >
                  ${val}
                </button>
              ))}
            </div>
          </div>

          {/* APR */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Expected APR (%)
            </label>
            <input
              type="number"
              value={apr}
              onChange={(e) => setApr(Number(e.target.value))}
              step="0.1"
              className="w-full rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-3 py-2 text-slate-100"
            />
            <div className="text-xs text-slate-400 mt-1">Pool options:</div>
            <div className="flex gap-1 mt-1 flex-wrap">
              {[12, 25, 35, 42, 55].map((val) => (
                <button
                  key={val}
                  onClick={() => setApr(val)}
                  className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                    apr === val
                      ? 'bg-green-500/20 border border-green-400/50 text-green-300'
                      : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-slate-400'
                  }`}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>

          {/* Price Range Min */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Price Range - Low ($)
            </label>
            <input
              type="number"
              value={priceRangeMin}
              onChange={(e) => setPriceRangeMin(Number(e.target.value))}
              step="0.1"
              className="w-full rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-3 py-2 text-slate-100"
            />
          </div>

          {/* Price Range Max */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Price Range - High ($)
            </label>
            <input
              type="number"
              value={priceRangeMax}
              onChange={(e) => setPriceRangeMax(Number(e.target.value))}
              step="0.1"
              className="w-full rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-3 py-2 text-slate-100"
            />
          </div>

          {/* Duration */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Duration (Days): {duration}
            </label>
            <input
              type="range"
              min="1"
              max="365"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex gap-1 mt-2 flex-wrap">
              {[7, 30, 90, 180, 365].map((val) => (
                <button
                  key={val}
                  onClick={() => setDuration(val)}
                  className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                    duration === val
                      ? 'bg-amber-500/20 border border-amber-400/50 text-amber-300'
                      : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-slate-400'
                  }`}
                >
                  {val}d
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Estimated Fee */}
        <div className="card-glass rounded-xl p-4 border border-amber-400/20 bg-amber-500/5">
          <div className="text-slate-400 text-sm mb-2">Estimated Daily Fee</div>
          <div className="text-3xl font-bold text-amber-400">
            ${calculations.estimatedDailyFee.toFixed(2)}
          </div>
          <div className="text-xs text-slate-500 mt-1">from trading fees only</div>
        </div>

        {/* Monthly Fee */}
        <div className="card-glass rounded-xl p-4 border border-amber-400/20 bg-amber-500/5">
          <div className="text-slate-400 text-sm mb-2">Estimated Monthly Fee</div>
          <div className="text-3xl font-bold text-amber-400">
            ${calculations.estimatedMonthlyFee.toFixed(2)}
          </div>
          <div className="text-xs text-slate-500 mt-1">for {duration}-day period</div>
        </div>

        {/* Estimated APY */}
        <div className="card-glass rounded-xl p-4 border border-green-400/20 bg-green-500/5">
          <div className="text-slate-400 text-sm mb-2">Estimated APY</div>
          <div className="text-3xl font-bold text-green-400">
            {calculations.estimatedAPY.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-500 mt-1">annualized yield</div>
        </div>

        {/* IL Risk */}
        <div className="card-glass rounded-xl p-4 border border-red-400/20 bg-red-500/5">
          <div className="text-slate-400 text-sm mb-2">Impermanent Loss Risk</div>
          <div className="text-3xl font-bold text-red-400">
            {calculations.ilRiskPercent.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-500 mt-1">≈ ${calculations.ilLoss.toFixed(2)}</div>
        </div>

        {/* Break Even */}
        <div className="card-glass rounded-xl p-4 border border-blue-400/20 bg-blue-500/5">
          <div className="text-slate-400 text-sm mb-2">Break Even Point</div>
          <div className="text-3xl font-bold text-blue-400">
            {calculations.breakEvenDays} days
          </div>
          <div className="text-xs text-slate-500 mt-1">to cover IL loss</div>
        </div>

        {/* Net Profit */}
        <div className="card-glass rounded-xl p-4 border border-green-400/20 bg-green-500/5">
          <div className="text-slate-400 text-sm mb-2">Net Profit ({duration}d)</div>
          <div className={`text-3xl font-bold ${calculations.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${calculations.netProfit.toFixed(2)}
          </div>
          <div className="text-xs text-slate-500 mt-1">after IL deduction</div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="card-glass rounded-xl p-4">
        <h3 className="font-semibold text-slate-100 mb-3">Detailed Breakdown</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Initial Capital</span>
            <span className="font-bold text-slate-100">${capital.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Price Range</span>
            <span className="font-bold text-slate-100">${priceRangeMin} - ${priceRangeMax}</span>
          </div>
          <div className="flex justify-between border-t border-slate-600/20 pt-2">
            <span className="text-slate-400">Total Fees Earned</span>
            <span className="font-bold text-amber-400">${calculations.estimatedMonthlyFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Impermanent Loss</span>
            <span className="font-bold text-red-400">-${calculations.ilLoss.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-600/20 pt-2 text-base">
            <span className="text-slate-200 font-semibold">Final Balance</span>
            <span className={`font-bold ${calculations.netProfit + capital >= capital ? 'text-green-400' : 'text-red-400'}`}>
              ${(capital + calculations.netProfit).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
