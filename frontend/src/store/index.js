import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { createWalletSlice } from './slices/walletSlice';
import { createAgentSlice } from './slices/agentSlice';
import { createJournalSlice } from './slices/journalSlice';
import { createChatSlice } from './slices/chatSlice';
import { createUISlice } from './slices/uiSlice';

/**
 * Modern State Management for RATi
 * 
 * Replaces scattered localStorage calls with a centralized,
 * type-safe, persistent state management solution.
 */

/**
 * Main RATi Store
 */
export const useRatiStore = create(
  subscribeWithSelector(
    persist(
      immer((...a) => ({
        ...createWalletSlice(), // No longer needs store setter
        ...createAgentSlice(...a),
        ...createJournalSlice(...a),
        ...createChatSlice(...a),
        ...createUISlice(...a),
      })),
      {
        name: 'rati-store',
        // The wallet state is managed by the WalletProvider, so we don't persist it here.
        partialize: (state) =>
          Object.fromEntries(
            Object.entries(state).filter(([key]) => !['wallet', 'walletStatus'].includes(key))
          ),
      }
    )
  )
);
