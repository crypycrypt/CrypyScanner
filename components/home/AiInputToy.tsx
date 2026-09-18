"use client"

// Decorative "AI assistant" face — hover the grid to tilt it, with an ambient
// glow + drifting firefly particles around the border. The click-to-open
// chat box from the original sample was removed per user feedback (kept as
// a purely ambient/hover decoration instead of a popup).
const FIREFLIES = [
  { top: '4%', left: '18%', delay: '0s', duration: '5.5s', size: 3 },
  { top: '10%', left: '82%', delay: '0.8s', duration: '6.2s', size: 2 },
  { top: '22%', left: '6%', delay: '1.6s', duration: '5s', size: 2 },
  { top: '30%', left: '92%', delay: '2.4s', duration: '6.8s', size: 3 },
  { top: '52%', left: '2%', delay: '0.4s', duration: '5.8s', size: 2 },
  { top: '58%', left: '96%', delay: '1.2s', duration: '5.3s', size: 3 },
  { top: '80%', left: '12%', delay: '2s', duration: '6.5s', size: 2 },
  { top: '86%', left: '78%', delay: '2.8s', duration: '5.6s', size: 3 },
  { top: '72%', left: '46%', delay: '3.4s', duration: '6s', size: 2 },
  { top: '6%', left: '48%', delay: '1.8s', duration: '6.4s', size: 2 },
]

export default function AiInputToy() {
  return (
    <div className="aitoy-slot" aria-hidden="true">
      <div className="aitoy-container">
        {Array.from({ length: 15 }).map((_, i) => (
          <div className="aitoy-area" key={i} />
        ))}
        <div className="aitoy-wrap">
          <div className="aitoy-ambient-glow" />
          {FIREFLIES.map((f, i) => (
            <span
              key={i}
              className="aitoy-firefly"
              style={{
                top: f.top,
                left: f.left,
                width: f.size,
                height: f.size,
                animationDelay: f.delay,
                animationDuration: f.duration,
              }}
            />
          ))}
          <div className="aitoy-card">
            <div className="aitoy-blur-balls">
              <div className="aitoy-balls">
                <span className="aitoy-ball aitoy-rosa" />
                <span className="aitoy-ball aitoy-violet" />
                <span className="aitoy-ball aitoy-green" />
                <span className="aitoy-ball aitoy-cyan" />
              </div>
            </div>
            <div className="aitoy-content-card">
              <div className="aitoy-blur-card">
                <div className="aitoy-eyes">
                  <span className="aitoy-eye" />
                  <span className="aitoy-eye" />
                </div>
                <div className="aitoy-eyes aitoy-happy">
                  <svg fill="none" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M8.28386 16.2843C8.9917 15.7665 9.8765 14.731 12 14.731C14.1235 14.731 15.0083 15.7665 15.7161 16.2843C17.8397 17.8376 18.7542 16.4845 18.9014 15.7665C19.4323 13.1777 17.6627 11.1066 17.3088 10.5888C16.3844 9.23666 14.1235 8 12 8C9.87648 8 7.61556 9.23666 6.69122 10.5888C6.33728 11.1066 4.56771 13.1777 5.09858 15.7665C5.24582 16.4845 6.16034 17.8376 8.28386 16.2843Z"
                    />
                  </svg>
                  <svg fill="none" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M8.28386 16.2843C8.9917 15.7665 9.8765 14.731 12 14.731C14.1235 14.731 15.0083 15.7665 15.7161 16.2843C17.8397 17.8376 18.7542 16.4845 18.9014 15.7665C19.4323 13.1777 17.6627 11.1066 17.3088 10.5888C16.3844 9.23666 14.1235 8 12 8C9.87648 8 7.61556 9.23666 6.69122 10.5888C6.33728 11.1066 4.56771 13.1777 5.09858 15.7665C5.24582 16.4845 6.16034 17.8376 8.28386 16.2843Z"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
