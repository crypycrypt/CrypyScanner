"use client"

// Purely decorative holo trading-card — a static showpiece next to the KPI
// strip, adapted from a user-supplied "VOID REAPER" TCG card sample and
// reflavored to WhaleRadar AI's Meme's radar branding. No live data.
export default function RadarShowcaseCard() {
  return (
    <div className="rsc-slot" aria-hidden="true">
      <div className="rsc-card">
        <div className="rsc-holo" />
        <div className="rsc-inner">
          <div className="rsc-top-bar">
            <span className="rsc-type">RADAR</span>
          </div>

          <span className="rsc-title">HOLLOWCAT</span>

          <div className="rsc-portrait">
            <div className="rsc-portal" />
            <img src="/assets/ic_cathollow.svg" alt="" className="rsc-mascot" />
            <div className="rsc-souls"><i /><i /><i /><i /><i /></div>
          </div>

          <div className="rsc-divider">
            <span />
            <svg className="rsc-div-icon" viewBox="0 0 24 24">
              <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z" />
            </svg>
            <span />
          </div>

          <div className="rsc-skill">
            <div className="rsc-skill-head">
              <span className="rsc-skill-name">Rug Harvest</span>
            </div>
            <p className="rsc-skill-desc">Marks rug-pull wallets on sight. +2 RISK revealed for every red flag found this scan.</p>
          </div>

          <div className="rsc-skill alt">
            <div className="rsc-skill-head">
              <span className="rsc-skill-name">Diamond Hands</span>
              <span className="rsc-skill-tag">PASSIVE</span>
            </div>
            <p className="rsc-skill-desc">Immune to panic-sell signals. Survives one flash-crash with hands still diamond.</p>
          </div>

          <div className="rsc-footer">
            <div className="rsc-rarity"><i /><i /><i /></div>
            <span className="rsc-set">WhaleRadar AI · Meme&apos;s</span>
          </div>
        </div>
        <div className="rsc-edge-glow" />
      </div>
    </div>
  )
}
