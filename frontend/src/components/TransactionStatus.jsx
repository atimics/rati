import React, { useState, useEffect } from 'react';
import './TransactionStatus.css';

const TransactionStatus = ({ 
  transaction, 
  isVisible, 
  onClose,
  onRetry 
}) => {
  const [status, setStatus] = useState('preparing');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (transaction) {
      if (transaction.error) {
        setStatus('error');
        setError(transaction.error);
      } else if (transaction.txId) {
        setStatus('success');
      } else if (transaction.signing) {
        setStatus('signing');
      } else {
        setStatus('preparing');
      }
    }
  }, [transaction]);

  const getStatusInfo = () => {
    switch (status) {
      case 'preparing':
        return {
          icon: '⏳',
          title: 'Preparing Transaction',
          message: 'Setting up transaction data and fees...',
          showSpinner: true
        };
      case 'signing':
        return {
          icon: '✍️',
          title: 'Please Sign Transaction',
          message: 'Check your ArConnect extension to sign the transaction. Make sure to review the transaction details before confirming.',
          showSpinner: true
        };
      case 'submitting':
        return {
          icon: '📤',
          title: 'Submitting Transaction',
          message: 'Broadcasting your transaction to the Arweave network...',
          showSpinner: true
        };
      case 'success':
        return {
          icon: '✅',
          title: 'Transaction Successful',
          message: `Your transaction has been submitted! Transaction ID: ${transaction?.txId}`,
          showSpinner: false
        };
      case 'error':
        return {
          icon: '❌',
          title: 'Transaction Failed',
          message: getErrorMessage(error),
          showSpinner: false
        };
      default:
        return {
          icon: '⏳',
          title: 'Processing',
          message: 'Please wait...',
          showSpinner: true
        };
    }
  };

  const getErrorMessage = (error) => {
    if (!error) return 'An unknown error occurred';
    
    const errorStr = error.toString().toLowerCase();
    
    if (errorStr.includes('user rejected') || errorStr.includes('denied')) {
      return 'You declined to sign the transaction. You can retry if you want to proceed.';
    } else if (errorStr.includes('not properly signed') || errorStr.includes('signature')) {
      return 'The transaction signature failed. This might be a temporary issue with ArConnect.';
    } else if (errorStr.includes('insufficient')) {
      return 'Insufficient AR balance to complete this transaction.';
    } else if (errorStr.includes('network') || errorStr.includes('connection')) {
      return 'Network connection issue. Please check your internet connection.';
    }
    
    return error.message || error.toString();
  };

  const statusInfo = getStatusInfo();

  if (!isVisible) return null;

  return (
    <div className="transaction-status-overlay">
      <div className="transaction-status-modal">
        <div className="status-header">
          <div className="status-icon">{statusInfo.icon}</div>
          <h3 className="status-title">{statusInfo.title}</h3>
          {status !== 'signing' && status !== 'submitting' && (
            <button className="close-button" onClick={onClose}>
              ✕
            </button>
          )}
        </div>
        
        <div className="status-content">
          <p className="status-message">{statusInfo.message}</p>
          
          {statusInfo.showSpinner && (
            <div className="status-spinner">
              <div className="spinner"></div>
            </div>
          )}
          
          {status === 'success' && transaction?.txId && (
            <div className="transaction-details">
              <div className="detail-row">
                <span className="detail-label">Transaction ID:</span>
                <span className="detail-value">{transaction.txId}</span>
              </div>
              <div className="transaction-links">
                <a 
                  href={`https://arweave.net/${transaction.txId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tx-link"
                >
                  View on Arweave →
                </a>
              </div>
            </div>
          )}
          
          {status === 'error' && onRetry && (
            <div className="error-actions">
              <button className="retry-button" onClick={onRetry}>
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionStatus;
