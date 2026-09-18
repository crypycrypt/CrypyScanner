"use client"

// Decorative interactive "AI assistant" toggle — hover the grid to tilt the
// face, click to flip it into a chat box. Purely presentational (no state,
// no submit handler); see styles/ai-input-toy.css for the recolored theme.
export default function AiInputToy() {
  return (
    <div className="aitoy-slot" aria-hidden="true">
      <div className="aitoy-container">
        {Array.from({ length: 15 }).map((_, i) => (
          <div className="aitoy-area" key={i} />
        ))}
        <label className="aitoy-wrap">
          <input type="checkbox" />
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
            <div className="aitoy-chat-panel">
              <div className="aitoy-chat">
                <div className="aitoy-chat-bot">
                  <textarea placeholder="Imagine Something...✦˚" name="ai_toy_chat" />
                </div>
                <div className="aitoy-options">
                  <div className="aitoy-btns-add">
                    <button type="button" tabIndex={-1}>
                      <svg viewBox="0 0 24 24" height="20" width="20" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M7 8v8a5 5 0 1 0 10 0V6.5a3.5 3.5 0 1 0-7 0V15a2 2 0 0 0 4 0V8"
                          strokeWidth="2"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                        />
                      </svg>
                    </button>
                    <button type="button" tabIndex={-1}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                        <path
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zm0 10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zm10 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1zm0-8h6m-3-3v6"
                        />
                      </svg>
                    </button>
                    <button type="button" tabIndex={-1}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10s-4.477 10-10 10m-2.29-2.333A17.9 17.9 0 0 1 8.027 13H4.062a8.01 8.01 0 0 0 5.648 6.667M10.03 13c.151 2.439.848 4.73 1.97 6.752A15.9 15.9 0 0 0 13.97 13zm9.908 0h-3.965a17.9 17.9 0 0 1-1.683 6.667A8.01 8.01 0 0 0 19.938 13M4.062 11h3.965A17.9 17.9 0 0 1 9.71 4.333A8.01 8.01 0 0 0 4.062 11m5.969 0h3.938A15.9 15.9 0 0 0 12 4.248A15.9 15.9 0 0 0 10.03 11m4.259-6.667A17.9 17.9 0 0 1 15.973 11h3.965a8.01 8.01 0 0 0-5.648-6.667"
                        />
                      </svg>
                    </button>
                  </div>
                  <button className="aitoy-btn-submit" type="button" tabIndex={-1}>
                    <i>
                      <svg viewBox="0 0 512 512">
                        <path
                          d="M473 39.05a24 24 0 0 0-25.5-5.46L47.47 185h-.08a24 24 0 0 0 1 45.16l.41.13l137.3 58.63a16 16 0 0 0 15.54-3.59L422 80a7.07 7.07 0 0 1 10 10L226.66 310.26a16 16 0 0 0-3.59 15.54l58.65 137.38c.06.2.12.38.19.57c3.2 9.27 11.3 15.81 21.09 16.25h1a24.63 24.63 0 0 0 23-15.46L478.39 64.62A24 24 0 0 0 473 39.05"
                          fill="currentColor"
                        />
                      </svg>
                    </i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </label>
      </div>
    </div>
  )
}
