"use client"

import React, { useEffect, useRef, useState } from 'react';

interface SignalTerminalProps {
  signals?: any[];
}

interface Signal {
  coinId: string;
  coinSymbol: string;
  coinName: string;
  signal: 'LONG' | 'SHORT';
  currentPrice: number;
  entryLow: number;
  entryHigh: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  rr: number;
  bullish: number;
  bearish: number;
  confidence: number;
  whaleBias?: string;
  volPhase?: string;
  mcProbUp?: number;
  timestamp: string;
  signalReason: string;
  subScores?: Array<{label: string, score: number}>;
  manipulationScore?: number;
  manipulationWarnings?: string[];
  filteredSignal?: 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE';
}

const SignalTerminal: React.FC<SignalTerminalProps> = ({ signals = [] }) => {
  const [allSignals, setAllSignals] = useState<Signal[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [scanCount, setScanCount] = useState(0);
  const [longCount, setLongCount] = useState(0);
  const [shortCount, setShortCount] = useState(0);
  const [command, setCommand] = useState('');
  const [feedLines, setFeedLines] = useState<Array<{tag: string, tagClass: string, msg: string, timestamp: string}>>([]);
  const [signalCards, setSignalCards] = useState<Signal[]>([]);
  
  const matrixCanvasRef = useRef<HTMLCanvasElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // Format functions
  const fmtPrice = (v: number | null): string => {
    if (v == null) return '—';
    if (v > 1000) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (v > 1) return '$' + (+v).toFixed(4);
    return '$' + (+v).toFixed(6);
  };

  const fmtTime = (iso: string): string => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const fmtDate = (iso: string): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) + ' ' + fmtTime(iso);
  };

  const uid = (s: Signal, idx?: number): string => s.coinId + '_' + s.signal + '_' + s.timestamp + (idx !== undefined ? '_' + idx : '');

  // Matrix rain animation
  useEffect(() => {
    const canvas = matrixCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#@%&*LONGSHORT'.split('');
    const fs = 10;
    let cols: number, drops: number[];

    const resize = () => {
      canvas.width = canvas.offsetWidth || 800;
      canvas.height = canvas.offsetHeight || 50;
      cols = Math.floor(canvas.width / fs);
      drops = Array(cols).fill(1);
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.fillStyle = 'rgba(2,8,16,0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      for (let i = 0; i < drops.length; i++) {
        ctx.fillStyle = i % 5 === 0 ? '#4ade80' : '#22d3ee';
        ctx.font = fs + 'px Courier New';
        ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * fs, drops[i] * fs);
        if (drops[i] * fs > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };

    const animInterval = setInterval(draw, 50);

    return () => {
      clearInterval(animInterval);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Append line to feed
  const appendLine = (tag: string, tagClass: string, msg: string) => {
    const newLine = {
      tag,
      tagClass,
      msg,
      timestamp: new Date().toLocaleTimeString('id-ID')
    };
    setFeedLines(prev => [...prev, newLine]);
  };

  // Append signal card
  const appendSignalCard = (sig: Signal) => {
    setSignalCards(prev => [...prev, sig]);
  };

  // Poll for signals
  const poll = async () => {
    setScanCount(prev => prev + 1);
    appendLine('POLL', 'scan', `Mengambil sinyal dari server... (#${scanCount + 1})`);

    try {
      const response = await fetch('/api/crypto-scanner/signals');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      
      const newSignals = await response.json();
      setAllSignals(newSignals);
      
      const longCount = newSignals.filter((s: Signal) => s.signal === 'LONG').length;
      const shortCount = newSignals.filter((s: Signal) => s.signal === 'SHORT').length;
      setLongCount(longCount);
      setShortCount(shortCount);

      appendLine('OK', 'scan', `Proxy OK — ${newSignals.length} sinyal tersimpan`);

      const newSigs = newSignals.filter((s: Signal) => !seenIds.has(uid(s)));
      if (!newSigs.length) {
        appendLine('OK', 'scan', `Tidak ada sinyal baru. (Total: <b>${newSignals.length}</b>)`);
      } else {
        appendLine('NEW', 'scan', `<b>${newSigs.length}</b> sinyal baru ditemukan!`);
        newSigs.slice().reverse().forEach((sig: Signal) => {
          setSeenIds(prev => new Set([...prev, uid(sig)]));
          appendLine(sig.signal, sig.signal === 'LONG' ? 'long' : 'short',
            `<b>${sig.coinSymbol.toUpperCase()}</b> ${sig.coinName} — ${fmtPrice(sig.currentPrice)} | ${sig.signalReason}`);
          appendSignalCard(sig);
        });
      }
    } catch (error) {
      appendLine('ERR', 'warn', 'Proxy tidak tersedia. Jalankan: <b>node signal-bot.js</b>');
    }
  };

  // Boot sequence
  useEffect(() => {
    const bootSequence = async () => {
      const lines = [
        ['INIT', 'info', 'Signal Terminal v2 online...'],
        ['LOAD', 'info', '10 engines: Structure · Liquidity · S&D · VP · OF · Whale · Vol · GBM · Prob · Trade'],
        ['CONN', 'info', 'Proxy: <b>/api/crypto-scanner/signals</b>'],
      ];

      for (let i = 0; i < lines.length; i++) {
        await new Promise(r => setTimeout(r, 200));
        appendLine(lines[i][0], lines[i][1], lines[i][2]);
      }
      
      await poll();
    };

    bootSequence();
    const pollInterval = setInterval(poll, 15000);

    return () => clearInterval(pollInterval);
  }, []);

  // Handle command input
  const handleCommand = (cmd: string) => {
    const c = cmd.trim().toLowerCase();
    if (!c) return;

    appendLine('$', 'info', `<b style="color:#22d3ee">${cmd}</b>`);

    if (c === 'help') {
      [
        'clear / cls  — hapus feed & reload',
        'refresh      — poll sekarang',
        'status       — lihat statistik',
        'signals      — semua sinyal',
        'long         — filter LONG saja',
        'short        — filter SHORT saja',
      ].forEach(l => appendLine('', 'info', l));
    } else if (c === 'clear' || c === 'cls') {
      setFeedLines([]);
      setSignalCards([]);
      setSeenIds(new Set());
      appendLine('OK', 'scan', 'Feed dibersihkan.');
      poll();
    } else if (c === 'refresh') {
      poll();
    } else if (c === 'status') {
      appendLine('STAT', 'scan', `Scan: <b>#${scanCount}</b> | LONG: <b>${longCount}</b> | SHORT: <b>${shortCount}</b> | Total: <b>${allSignals.length}</b>`);
    } else if (c === 'signals' || c === 'long' || c === 'short') {
      const list = c === 'long' ? allSignals.filter(s => s.signal === 'LONG')
                 : c === 'short' ? allSignals.filter(s => s.signal === 'SHORT')
                 : allSignals;
      
      if (!list.length) {
        appendLine('', 'warn', 'Tidak ada sinyal.');
        return;
      }
      
      list.slice(0, 10).forEach(s => {
        appendLine(s.signal, s.signal === 'LONG' ? 'long' : 'short',
          `<b>${s.coinSymbol.toUpperCase()}</b> ${fmtPrice(s.currentPrice)} — ${s.signalReason} [${fmtDate(s.timestamp)}]`);
      });
    } else {
      appendLine('ERR', 'warn', `Tidak dikenal: <b>${cmd}</b>. Ketik <b>help</b>`);
    }

    setCommand('');
  };

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [feedLines, signalCards]);

  return (
    <div className="sterm-section">
      <div className="sterm-section-title">⚡ SIGNAL TERMINAL — Live Bot Feed</div>
      <div className="sterm-outer" id="stermOuter">
        <div className="sterm-matrix-wrap">
          <canvas ref={matrixCanvasRef} className="sterm-matrix-canvas" id="stermMatrix" />
          <div className="sterm-matrix-overlay">◈ SIGNAL_BOT v1 · QUANT_ANALYST v2 · 10 ENGINES ACTIVE ◈</div>
        </div>
        
        <div className="sterm-titlebar">
          <div className="sterm-dots">
            <div className="sterm-dot sterm-dot-r"></div>
            <div className="sterm-dot sterm-dot-y"></div>
            <div className="sterm-dot sterm-dot-g"></div>
          </div>
          <div className="sterm-title-text">signal-terminal@crypto-scanner:~$</div>
          <div className="sterm-status"><div className="sterm-status-dot"></div>LIVE</div>
        </div>
        
        <div className="sterm-statsbar">
          <div className="sterm-stat">SCAN <span className="sterm-stat-val">#{scanCount}</span></div>
          <div className="sterm-stat">LONG <span className="sterm-stat-long">{longCount}</span></div>
          <div className="sterm-stat">SHORT <span className="sterm-stat-short">{shortCount}</span></div>
          <div className="sterm-stat">TOTAL <span className="sterm-stat-val">{allSignals.length}</span></div>
          <div className="sterm-stat">INTERVAL <span className="sterm-stat-val">15s</span></div>
          <div className="sterm-stat">UPDATED <span className="sterm-stat-val">{new Date().toLocaleTimeString('id-ID')}</span></div>
          <div className="sterm-stat">ANTI-MANIP <span className="sterm-stat-val">{allSignals.filter(s => s.manipulationScore && s.manipulationScore > 50).length}</span></div>
        </div>
        
        <div className="sterm-ticker-wrap">
          <div className="sterm-ticker" id="stermTicker">
            {allSignals.slice(0, 15).map(sig => {
              const cls = sig.signal === 'LONG' ? 'sterm-ticker-up' : 'sterm-ticker-down';
              const icon = sig.signal === 'LONG' ? '▲' : '▼';
              return (
                <span key={uid(sig)} className="sterm-ticker-item">
                  <span className="sterm-ticker-sym">{sig.coinSymbol.toUpperCase()}</span>
                  <span className={cls}>{icon} {sig.signal}</span>
                  <span className="sterm-ticker-sym">{fmtPrice(sig.currentPrice)}</span>
                </span>
              );
            })}
          </div>
        </div>
        
        <div ref={feedRef} className="sterm-feed" id="stermFeed">
          {feedLines.map((line, idx) => (
            <div key={`line-${idx}`} className="sterm-line">
              <span className="sterm-line-ts">{line.timestamp}</span>
              <span className={`sterm-line-tag sterm-line-tag-${line.tagClass}`}>{line.tag}</span>
              <span className="sterm-line-msg" dangerouslySetInnerHTML={{ __html: line.msg }} />
            </div>
          ))}
          
          {signalCards.map((sig, sidx) => {
            const isLong = sig.signal === 'LONG';
            const sub = (sig.subScores || []).slice(0, 3).map(s => 
              s.label.split(' ')[0] + ':' + s.score
            ).join(' · ');
            
            return (
              <div key={uid(sig, sidx)} className={`sterm-signal-card sterm-card-${isLong ? 'long' : 'short'}`}>
                <div className="sterm-card-header">
                  <span className={`sterm-card-coin sterm-card-coin-${isLong ? 'long' : 'short'}`}>
                    {isLong ? '▲' : '▼'} {sig.coinSymbol.toUpperCase()} / {sig.coinName}
                  </span>
                  <span className={`sterm-card-badge sterm-card-badge-${isLong ? 'long' : 'short'}`}>
                    {sig.signal}
                  </span>
                </div>
                
                <div className="sterm-card-levels">
                  <div className="sterm-card-level">
                    <div className="sterm-card-level-lbl">HARGA</div>
                    <div className="sterm-card-level-val blue">{fmtPrice(sig.currentPrice)}</div>
                  </div>
                  <div className="sterm-card-level">
                    <div className="sterm-card-level-lbl">ENTRY</div>
                    <div className="sterm-card-level-val">{fmtPrice(sig.entryLow)} — {fmtPrice(sig.entryHigh)}</div>
                  </div>
                  <div className="sterm-card-level">
                    <div className="sterm-card-level-lbl">STOP LOSS</div>
                    <div className="sterm-card-level-val red">{fmtPrice(sig.stopLoss)}</div>
                  </div>
                  <div className="sterm-card-level">
                    <div className="sterm-card-level-lbl">TP1</div>
                    <div className="sterm-card-level-val green">{fmtPrice(sig.tp1)}</div>
                  </div>
                  <div className="sterm-card-level">
                    <div className="sterm-card-level-lbl">TP2</div>
                    <div className="sterm-card-level-val green">{fmtPrice(sig.tp2)}</div>
                  </div>
                  <div className="sterm-card-level">
                    <div className="sterm-card-level-lbl">R:R</div>
                    <div className="sterm-card-level-val">1 : {sig.rr}</div>
                  </div>
                </div>
                
                <div className="sterm-card-footer">
                  <span>📊 Bull <b>{sig.bullish}%</b> Bear <b>{sig.bearish}%</b> Conf <b>{sig.confidence}%</b></span>
                  <span>🐋 Whale: <b>{sig.whaleBias || '—'}</b></span>
                  <span>📏 Vol: <b>{sig.volPhase || '—'}</b></span>
                  <span>🎲 MC: <b>{sig.mcProbUp != null ? sig.mcProbUp : '—'}%</b></span>
                  <span>🕐 <b>{fmtDate(sig.timestamp)}</b></span>
                  {sub && <span>🔍 {sub}</span>}
                  {sig.manipulationScore != null && (
                    <span className={sig.manipulationScore > 50 ? 'sterm-manip-warn' : 'sterm-manip-ok'}>
                      🛡️ MANIP: <b>{sig.manipulationScore}/100</b>
                      {sig.filteredSignal && sig.filteredSignal !== sig.signal && (
                        <span className="sterm-filtered">[FILTERED: {sig.filteredSignal}]</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="sterm-inputbar">
          <span className="sterm-prompt">root@signal-bot:~$&nbsp;</span>
          <input 
            className="sterm-cmd-input" 
            id="stermInput" 
            type="text" 
            placeholder="ketik 'help'..." 
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCommand(command);
              }
            }}
            autoComplete="off" 
            spellCheck="false"
          />
          <div className="sterm-cursor"></div>
          <button className="sterm-btn-refresh" onClick={poll}>↻ REFRESH</button>
          <button className="sterm-btn-clear" onClick={() => {
            setFeedLines([]);
            setSignalCards([]);
            setSeenIds(new Set());
            appendLine('OK', 'scan', 'Feed dibersihkan.');
            poll();
          }}>✗ CLEAR</button>
        </div>
      </div>
    </div>
  );
};

export default SignalTerminal;