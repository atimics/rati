export const createUISlice = (set) => ({
  activeTab: 'collective',
  notifications: [],
  setActiveTab: (tab) => set({ activeTab: tab }),
  addNotification: (notification) => set((state) => {
    state.notifications.push({ id: Date.now(), ...notification });
  }),
  removeNotification: (id) => set((state) => {
    state.notifications = state.notifications.filter((n) => n.id !== id);
  }),
});
