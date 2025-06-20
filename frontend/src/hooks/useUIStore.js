import { useRatiStore } from '../store';

export const useUIStore = () => {
  const activeTab = useRatiStore(state => state.activeTab);
  const notifications = useRatiStore(state => state.notifications);
  const setActiveTab = useRatiStore(state => state.setActiveTab);
  const addNotification = useRatiStore(state => state.addNotification);
  const removeNotification = useRatiStore(state => state.removeNotification);

  return {
    activeTab,
    notifications,
    setActiveTab,
    addNotification,
    removeNotification
  };
};
