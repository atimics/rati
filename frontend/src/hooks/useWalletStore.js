import { useRatiStore } from '../store';

export const useWalletStore = () => {
  const wallet = useRatiStore(state => state.wallet);
  const walletStatus = useRatiStore(state => state.walletStatus);
  const setWallet = useRatiStore(state => state.setWallet);
  const disconnectWallet = useRatiStore(state => state.disconnectWallet);
  
  return {
    wallet,
    walletStatus,
    setWallet,
    disconnectWallet,
    isConnected: walletStatus === 'connected'
  };
};
