import { useChain } from '../hooks/useChain';
import { CHAIN_CONFIGS } from '../config';
import { trackEvent } from '../utils/analytics';

export function ChainSelector() {
  const { selectedChain, setSelectedChain } = useChain();

  const handleChainChange = (chain: 'solana' | 'base') => {
    if (chain !== selectedChain) {
      setSelectedChain(chain);
      trackEvent('chain_switched', {
        fromChain: selectedChain,
        toChain: chain,
      });
    }
  };

  return (
    <div className="chain-selector">
      <label className="chain-selector-label">Target Chain:</label>
      <div className="chain-options">
        {Object.entries(CHAIN_CONFIGS).map(([key, config]) => (
          <button
            key={key}
            className={`chain-option ${selectedChain === key ? 'active' : ''}`}
            onClick={() => handleChainChange(key as 'solana' | 'base')}
          >
            <span className={`chain-indicator ${key}`} />
            <span className="chain-name">{config.name}</span>
            <span className="chain-symbol">{config.nativeCurrency.symbol}</span>
          </button>
        ))}
      </div>
    </div>
  );
}