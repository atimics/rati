import { useEffect, useState } from 'react'
import { OrbForge } from './components/OrbForge'
import { ChainSelector } from './components/ChainSelector'
import { WalletConnect } from './components/WalletConnect'
import { FrameProvider } from './providers/FrameProvider'
import { useChain } from './hooks/useChain'
import './App.css'

function App() {
  const { selectedChain, setSelectedChain } = useChain()
  const [isFrame, setIsFrame] = useState(false)

  useEffect(() => {
    // Detect if we're in a Farcaster Frame context
    const urlParams = new URLSearchParams(window.location.search)
    const frameContext = urlParams.get('chain') || window.parent !== window
    setIsFrame(!!frameContext)
    
    // Set chain from URL parameter
    const chainParam = urlParams.get('chain')
    if (chainParam && (chainParam === 'solana' || chainParam === 'base')) {
      setSelectedChain(chainParam)
    }
  }, [setSelectedChain])

  return (
    <FrameProvider isFrame={isFrame}>
      <div className="app">
        <header className="app-header">
          <div className="logo">
            <img src="/orb-icon.svg" alt="Orb" className="orb-icon" />
            <h1>Orb Agent Forge</h1>
          </div>
          {!isFrame && (
            <div className="header-controls">
              <ChainSelector />
              <WalletConnect />
            </div>
          )}
        </header>

        <main className="app-main">
          {isFrame ? (
            <div className="frame-container">
              <div className="frame-header">
                <h2>Transform Your Orb into an AI Agent</h2>
                <p>Burn $RARI tokens to forge a unique AI Agent NFT</p>
              </div>
              <OrbForge compact={true} />
            </div>
          ) : (
            <div className="desktop-container">
              <div className="hero-section">
                <h2>Transform Orbs into AI Agents</h2>
                <p>
                  Burn your $RARI tokens to transform Orbs into unique AI Agent NFTs. 
                  Choose your target blockchain and watch your Orb evolve.
                </p>
              </div>
              <OrbForge compact={false} />
            </div>
          )}
        </main>

        <footer className="app-footer">
          <div className="footer-content">
            <div className="footer-links">
              <a href="https://docs.orb-agents.xyz" target="_blank" rel="noopener noreferrer">
                Documentation
              </a>
              <a href="https://github.com/orb-agents" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
              <a href="https://discord.gg/orb-agents" target="_blank" rel="noopener noreferrer">
                Discord
              </a>
            </div>
            <div className="footer-stats">
              <span>8,888 Unique Agents</span>
              <span>•</span>
              <span>Cross-Chain Minting</span>
              <span>•</span>
              <span>Powered by Wormhole</span>
            </div>
          </div>
        </footer>
      </div>
    </FrameProvider>
  )
}

export default App