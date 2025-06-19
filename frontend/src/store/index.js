import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

/**
 * Modern State Management for RATi
 * 
 * Replaces scattered localStorage calls with a centralized,
 * type-safe, persistent state management solution.
 */

// Initial state structure
const initialState = {
  // Wallet state
  wallet: null,
  walletStatus: 'disconnected',
  
  // Agent state
  agents: [],
  activeAgent: null,
  
  // Journal state
  journals: [],
  journalHistory: [],
  
  // Chat state
  chatHistory: {},
  
  // UI state
  activeTab: 'chat',
  notifications: [],
  
  // Settings
  settings: {
    theme: 'light',
    autoSave: true,
    notifications: true
  }
};

/**
 * Main RATi Store
 */
export const useRatiStore = create(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        ...initialState,

        // Wallet actions
        setWallet: (wallet) => set((state) => {
          state.wallet = wallet;
          state.walletStatus = wallet ? 'connected' : 'disconnected';
        }),

        disconnectWallet: () => set((state) => {
          state.wallet = null;
          state.walletStatus = 'disconnected';
        }),

        // Agent actions
        addAgent: (agent) => set((state) => {
          const existingIndex = state.agents.findIndex(a => a.processId === agent.processId);
          if (existingIndex >= 0) {
            state.agents[existingIndex] = agent;
          } else {
            state.agents.push(agent);
          }
        }),

        setActiveAgent: (agent) => set((state) => {
          state.activeAgent = agent;
        }),

        updateAgent: (processId, updates) => set((state) => {
          const agent = state.agents.find(a => a.processId === processId);
          if (agent) {
            Object.assign(agent, updates);
          }
        }),

        // Journal actions
        addJournal: (journal) => set((state) => {
          state.journals.unshift({
            ...journal,
            id: journal.id || Date.now(),
            createdAt: journal.createdAt || new Date().toISOString()
          });
          
          // Keep only last 50 journals
          if (state.journals.length > 50) {
            state.journals = state.journals.slice(0, 50);
          }
        }),

        updateJournal: (id, updates) => set((state) => {
          const journal = state.journals.find(j => j.id === id);
          if (journal) {
            Object.assign(journal, updates);
          }
        }),

        removeJournal: (id) => set((state) => {
          state.journals = state.journals.filter(j => j.id !== id);
        }),

        // Chat actions
        addChatMessage: (processId, message) => set((state) => {
          if (!state.chatHistory[processId]) {
            state.chatHistory[processId] = [];
          }
          
          state.chatHistory[processId].push({
            ...message,
            id: message.id || Date.now(),
            timestamp: message.timestamp || new Date().toISOString()
          });
          
          // Keep only last 100 messages per agent
          if (state.chatHistory[processId].length > 100) {
            state.chatHistory[processId] = state.chatHistory[processId].slice(-100);
          }
        }),

        setChatHistory: (processId, messages) => set((state) => {
          state.chatHistory[processId] = messages;
        }),

        clearChatHistory: (processId) => set((state) => {
          if (processId) {
            delete state.chatHistory[processId];
          } else {
            state.chatHistory = {};
          }
        }),

        // UI actions
        setActiveTab: (tab) => set((state) => {
          state.activeTab = tab;
        }),

        addNotification: (notification) => set((state) => {
          state.notifications.unshift({
            ...notification,
            id: notification.id || Date.now(),
            createdAt: new Date().toISOString()
          });
          
          // Keep only last 10 notifications
          if (state.notifications.length > 10) {
            state.notifications = state.notifications.slice(0, 10);
          }
        }),

        removeNotification: (id) => set((state) => {
          state.notifications = state.notifications.filter(n => n.id !== id);
        }),

        clearNotifications: () => set((state) => {
          state.notifications = [];
        }),

        // Settings actions
        updateSettings: (updates) => set((state) => {
          Object.assign(state.settings, updates);
        }),

        // Utility actions
        reset: () => set(() => ({ ...initialState })),

        // Selectors (computed values)
        getters: {
          isWalletConnected: () => get().walletStatus === 'connected',
          getActiveAgent: () => get().activeAgent,
          getChatHistory: (processId) => get().chatHistory[processId] || [],
          getJournals: () => get().journals,
          getUnreadNotifications: () => get().notifications.filter(n => !n.read),
        }
      })),
      {
        name: 'rati-store',
        version: 1,
        // Only persist important data, not UI state
        partialize: (state) => ({
          wallet: state.wallet,
          agents: state.agents,
          activeAgent: state.activeAgent,
          journals: state.journals,
          chatHistory: state.chatHistory,
          settings: state.settings
        }),
        // Migration function for version changes
        migrate: (persistedState, version) => {
          if (version === 0) {
            // Migrate from old localStorage format
            return {
              ...initialState,
              ...persistedState
            };
          }
          return persistedState;
        }
      }
    )
  )
);

/**
 * Custom hooks for specific store slices
 */

// Wallet hook
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

// Agent hook
export const useAgentStore = () => {
  const agents = useRatiStore(state => state.agents);
  const activeAgent = useRatiStore(state => state.activeAgent);
  const addAgent = useRatiStore(state => state.addAgent);
  const setActiveAgent = useRatiStore(state => state.setActiveAgent);
  const updateAgent = useRatiStore(state => state.updateAgent);
  
  return {
    agents,
    activeAgent,
    addAgent,
    setActiveAgent,
    updateAgent
  };
};

// Journal hook
export const useJournalStore = () => {
  const journals = useRatiStore(state => state.journals);
  const addJournal = useRatiStore(state => state.addJournal);
  const updateJournal = useRatiStore(state => state.updateJournal);
  const removeJournal = useRatiStore(state => state.removeJournal);
  
  return {
    journals,
    addJournal,
    updateJournal,
    removeJournal
  };
};

// Chat hook
export const useChatStore = () => {
  const chatHistory = useRatiStore(state => state.chatHistory);
  const addChatMessage = useRatiStore(state => state.addChatMessage);
  const setChatHistory = useRatiStore(state => state.setChatHistory);
  const clearChatHistory = useRatiStore(state => state.clearChatHistory);
  
  return {
    chatHistory,
    addChatMessage,
    setChatHistory,
    clearChatHistory,
    getChatHistory: (processId) => chatHistory[processId] || []
  };
};

// UI hook
export const useUIStore = () => {
  const activeTab = useRatiStore(state => state.activeTab);
  const notifications = useRatiStore(state => state.notifications);
  const settings = useRatiStore(state => state.settings);
  const setActiveTab = useRatiStore(state => state.setActiveTab);
  const addNotification = useRatiStore(state => state.addNotification);
  const removeNotification = useRatiStore(state => state.removeNotification);
  const updateSettings = useRatiStore(state => state.updateSettings);
  
  return {
    activeTab,
    notifications,
    settings,
    setActiveTab,
    addNotification,
    removeNotification,
    updateSettings
  };
};
