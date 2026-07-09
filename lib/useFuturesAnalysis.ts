"use client"

import { useQuery } from '@tanstack/react-query';

interface CoinData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency: number;
  price_change_percentage_1h_in_currency: number;
  market_cap: number;
  total_volume: number;
  sparkline_in_7d: {
    price: number[];
  };
}

export function useFuturesAnalysis(coinId: string) {
  return useQuery({
    queryKey: ['futures-analysis', coinId],
    queryFn: async (): Promise<CoinData> => {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinId}&sparkline=true&price_change_percentage=1h,24h,7d`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch coin data');
      }
      
      const data = await response.json();
      return data[0];
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useTopCoinsForFutures() {
  return useQuery({
    queryKey: ['top-coins-futures'],
    queryFn: async (): Promise<CoinData[]> => {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=1h,24h,7d'
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch top coins');
      }
      
      return response.json();
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });
}