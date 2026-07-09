"use client"

import React, { useState } from 'react';
import { useTopCoinsForFutures } from '../../lib/useFuturesAnalysis';
import FuturesAnalysis, { getFuturesAnalysis } from './FuturesAnalysis';

interface CoinCardProps {
  coin: any;
  onSelect: (coin: any) => void;
}

function CoinCard({ coin, onSelect }: CoinCardProps) {
  const analysis = getFuturesAnalysis(coin);
  
  return (
    <div 
      className="token-card cursor-pointer hover:border-[rgba(255,255,255,0.2)] transition-colors"
      onClick={() => onSelect(coin)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="token-logo">
            {coin.symbol?.toUpperCase().slice(0, 3)}
          </div>
          <div>
            <div className="font-semibold text-white">{coin.name}</div>
            <div className="text-sm text-[#94a3b8]">{coin.symbol?.toUpperCase()}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold text-white">${coin.current_price?.toLocaleString()}</div>
          <div className={`text-sm ${coin.price_change_percentage_24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {coin.price_change_percentage_24h?.toFixed(2)}%
          </div>
        </div>
      </div>
      
      <div className="mt-3 flex items-center justify-between">
        <span 
          className="text-xs font-semibold px-2 py-1 rounded"
          style={{ 
            backgroundColor: analysis.dirColor + '20', 
            color: analysis.dirColor,
            border: `1px solid ${analysis.dirColor}30`
          }}
        >
          {analysis.dirEmoji} {analysis.dirLabel}
        </span>
        <div className="text-xs text-[#94a3b8]">
          Leverage: {analysis.leverage}×
        </div>
      </div>
    </div>
  );
}

export default function FuturesAnalysisPage() {
  const { data: coins, isLoading, error } = useTopCoinsForFutures();
  const [selectedCoin, setSelectedCoin] = useState<any>(null);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#94a3b8]">Loading futures analysis...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">Error loading futures data</div>
      </div>
    );
  }
  
  if (!coins || coins.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#94a3b8]">No coin data available</div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Selected Coin Analysis */}
      {selectedCoin && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">
              Futures Analysis — {selectedCoin.name} ({selectedCoin.symbol?.toUpperCase()})
            </h3>
            <button 
              onClick={() => setSelectedCoin(null)}
              className="text-sm text-[#94a3b8] hover:text-white"
            >
              Back to list
            </button>
          </div>
          <FuturesAnalysis coin={selectedCoin} />
        </div>
      )}
      
      {/* Coin Grid */}
      {!selectedCoin && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Top Cryptocurrencies for Futures Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coins.slice(0, 15).map((coin: any) => (
              <CoinCard key={coin.id} coin={coin} onSelect={setSelectedCoin} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}