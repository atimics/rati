import type { TransactionStatus as TxStatus, ChainType } from '../types';
import { CHAIN_CONFIGS } from '../config';

interface TransactionStatusProps {
  status: TxStatus;
  txHash?: string | null;
  chain: ChainType;
  error?: string;
}

export function TransactionStatus({ status, txHash, chain, error }: TransactionStatusProps) {
  const chainConfig = CHAIN_CONFIGS[chain];
  
  const getExplorerUrl = (hash: string) => {
    if (chain === 'solana') {
      return `${chainConfig.explorerUrl}/tx/${hash}`;
    } else {
      return `${chainConfig.explorerUrl}/tx/${hash}`;
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '⚪';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return 'Transaction pending...';
      case 'success':
        return 'Transaction confirmed!';
      case 'error':
        return 'Transaction failed';
      default:
        return 'Ready';
    }
  };

  const getStatusClass = () => {
    switch (status) {
      case 'pending':
        return 'pending';
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'idle';
    }
  };

  return (
    <div className={`transaction-status ${getStatusClass()}`}>
      <div className="status-header">
        <span className="status-icon">{getStatusIcon()}</span>
        <span className="status-text">{getStatusText()}</span>
      </div>
      
      {txHash && (
        <div className="transaction-details">
          <div className="tx-hash">
            <span className="tx-label">Transaction Hash:</span>
            <code className="tx-value">
              {txHash.slice(0, 8)}...{txHash.slice(-6)}
            </code>
          </div>
          
          <a
            href={getExplorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="explorer-link"
          >
            View on {chainConfig.name} Explorer →
          </a>
        </div>
      )}
      
      {error && (
        <div className="error-details">
          <span className="error-label">Error:</span>
          <span className="error-message">{error}</span>
        </div>
      )}
      
      {status === 'pending' && (
        <div className="pending-animation">
          <div className="spinner" />
          <p className="pending-text">
            Waiting for confirmation on {chainConfig.name}...
          </p>
        </div>
      )}
      
      {status === 'success' && (
        <div className="success-details">
          <p className="success-text">
            🎉 Your Agent NFT has been successfully minted on {chainConfig.name}!
          </p>
        </div>
      )}
    </div>
  );
}