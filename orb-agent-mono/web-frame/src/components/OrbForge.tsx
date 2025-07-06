import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAccount } from 'wagmi'
import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { useChain } from '../hooks/useChain'
import { useMintAgent } from '../hooks/useMintAgent'
import { OrbSelector } from './OrbSelector'
import { TransactionStatus } from './TransactionStatus'
import { AgentPreview } from './AgentPreview'

interface OrbForgeProps {
  compact: boolean
}

export function OrbForge({ compact }: OrbForgeProps) {
  const { selectedChain } = useChain()
  const { connected: solanaConnected, publicKey, sendTransaction } = useWallet()
  const { isConnected: ethConnected, address } = useAccount()
  const { mintAgent, isLoading, error, txHash } = useMintAgent()
  
  const [selectedOrb, setSelectedOrb] = useState<string | null>(null)
  const [rariBalance, setRariBalance] = useState<number>(0)
  const [step, setStep] = useState<'select' | 'confirm' | 'minting' | 'success'>('select')

  const isConnected = selectedChain === 'solana' ? solanaConnected : ethConnected
  const userAddress = selectedChain === 'solana' ? publicKey?.toString() : address

  useEffect(() => {
    if (isConnected && userAddress) {
      checkRariBalance()
    }
  }, [isConnected, userAddress, selectedChain])

  const checkRariBalance = async () => {
    if (!userAddress) return
    
    try {
      if (selectedChain === 'solana') {
        const connection = new Connection(
          process.env.VITE_SOLANA_RPC || 'http://localhost:8899'
        )
        // TODO: Check RARI token balance for Solana wallet
        setRariBalance(1000) // Placeholder
      } else {
        // TODO: Check RARI token balance for Ethereum wallet
        setRariBalance(1000) // Placeholder
      }
    } catch (error) {
      console.error('Error checking RARI balance:', error)
    }
  }

  const handleOrbSelect = (orbId: string) => {
    setSelectedOrb(orbId)
    setStep('confirm')
  }

  const handleMint = async () => {
    if (!selectedOrb || !userAddress) return
    
    setStep('minting')
    
    try {
      const result = await mintAgent({
        orbId: selectedOrb,
        targetChain: selectedChain,
        userAddress,
      })
      
      if (result.success) {
        setStep('success')
      }
    } catch (error) {
      console.error('Minting failed:', error)
      setStep('confirm')
    }
  }

  const resetFlow = () => {
    setSelectedOrb(null)
    setStep('select')
  }

  if (!isConnected) {
    return (
      <div className="orb-forge not-connected">
        <div className="connection-prompt">
          <h3>Connect Your Wallet</h3>
          <p>
            Connect your {selectedChain === 'solana' ? 'Solana' : 'Ethereum'} wallet 
            to start forging AI Agents from your Orbs.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`orb-forge ${compact ? 'compact' : 'full'}`}>
      <div className="forge-header">
        <h3>Forge Your Agent</h3>
        <div className="chain-badge">
          <span className={`chain-indicator ${selectedChain}`} />
          {selectedChain === 'solana' ? 'Solana' : 'Base'}
        </div>
      </div>

      <div className="rari-balance">
        <span className="balance-label">$RARI Balance:</span>
        <span className="balance-value">{rariBalance.toLocaleString()}</span>
        <span className="balance-required">
          (Required: 100 $RARI)
        </span>
      </div>

      {step === 'select' && (
        <div className="step-select">
          <h4>Select an Orb to Transform</h4>
          <OrbSelector 
            userAddress={userAddress!}
            onSelect={handleOrbSelect}
            chain={selectedChain}
          />
        </div>
      )}

      {step === 'confirm' && selectedOrb && (
        <div className="step-confirm">
          <h4>Confirm Transformation</h4>
          <AgentPreview orbId={selectedOrb} />
          
          <div className="transformation-details">
            <div className="detail-row">
              <span>Orb ID:</span>
              <span>{selectedOrb}</span>
            </div>
            <div className="detail-row">
              <span>Target Chain:</span>
              <span>{selectedChain === 'solana' ? 'Solana' : 'Base'}</span>
            </div>
            <div className="detail-row">
              <span>$RARI Cost:</span>
              <span>100 $RARI</span>
            </div>
            <div className="detail-row">
              <span>Gas/Fees:</span>
              <span>~0.01 SOL</span>
            </div>
          </div>

          <div className="action-buttons">
            <button 
              className="btn btn-secondary" 
              onClick={resetFlow}
              disabled={isLoading}
            >
              Back
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleMint}
              disabled={isLoading || rariBalance < 100}
            >
              {isLoading ? 'Forging...' : 'Forge Agent'}
            </button>
          </div>
        </div>
      )}

      {step === 'minting' && (
        <div className="step-minting">
          <h4>Forging Your Agent...</h4>
          <TransactionStatus 
            status="pending"
            txHash={txHash}
            chain={selectedChain}
          />
          <div className="minting-animation">
            <div className="orb-transform">
              <div className="orb spinning" />
              <div className="transform-arrow">→</div>
              <div className="agent pulsing" />
            </div>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="step-success">
          <h4>🎉 Agent Forged Successfully!</h4>
          <AgentPreview orbId={selectedOrb!} />
          
          <TransactionStatus 
            status="success"
            txHash={txHash}
            chain={selectedChain}
          />
          
          <div className="success-actions">
            <button className="btn btn-primary" onClick={resetFlow}>
              Forge Another Agent
            </button>
            <a 
              href={`https://${selectedChain === 'solana' ? 'solscan.io' : 'basescan.org'}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              View on Explorer
            </a>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  )
}