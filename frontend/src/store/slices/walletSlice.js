export const createWalletSlice = (set) => ({
  wallet: null,
  walletStatus: 'disconnected',
  setWallet: (wallet) => set((state) => {
    state.wallet = wallet;
    state.walletStatus = wallet ? 'connected' : 'disconnected';
  }),
  disconnectWallet: () => set((state) => {
    state.wallet = null;
    state.walletStatus = 'disconnected';
  }),
});
