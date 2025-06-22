import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useWallet } from './WalletContext';
import { AOContext } from './AOContext';
import aoService from '../services/AOService';

/**
 * AO Provider Component
 * 
 * Manages the connection to AO processes and provides
 * a unified interface for all AO operations.
 */
export const AOProvider = ({ children }) => {
  const { wallet, isConnected } = useWallet();
  const [aoStatus, setAoStatus] = useState('disconnected');
  const [processIds, setProcessIds] = useState({ avatar: null, oracle: null });
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState(null);

  // Initialize AO service when wallet connects
  useEffect(() => {
    const initializeAO = async () => {
      if (!isConnected || !wallet) {
        aoService.reset();
        setAoStatus('disconnected');
        setProcessIds({ avatar: null, oracle: null });
        setError(null);
        return;
      }

      setIsInitializing(true);
      setError(null);

      try {
        await aoService.initialize(wallet);
        const status = aoService.getStatus();
        
        setAoStatus(status.connectionStatus);
        setProcessIds(status.processIds);
        
        if (status.connectionStatus === 'connected') {
          toast.success('🔗 Connected to AO processes');
        }
      } catch (err) {
        console.error('AO initialization failed:', err);
        setError(err.message);
        setAoStatus('error');
        
        if (err.message.includes('not configured')) {
          toast.error('⚠️ Processes not deployed. Run deployment first.');
        } else {
          toast.error('❌ Failed to connect to AO processes');
        }
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAO();
  }, [isConnected, wallet]);

  // === CHAT METHODS ===
  
  const sendChatMessage = async (message) => {
    if (!aoService.isReady()) {
      throw new Error('AO service not ready');
    }
    return await aoService.sendChatMessage(message);
  };

  const readInbox = async () => {
    if (!aoService.isReady()) {
      return [];
    }
    return await aoService.readAvatarInbox();
  };

  const pollForMessages = async (lastMessageId = null) => {
    if (!aoService.isReady()) {
      return [];
    }
    return await aoService.pollForNewMessages(lastMessageId);
  };

  // === MEMORY METHODS ===

  const getMemories = async () => {
    if (!aoService.isReady()) {
      return [];
    }
    return await aoService.getAgentMemories();
  };

  const storeMemory = async (memory) => {
    if (!aoService.isReady()) {
      throw new Error('AO service not ready');
    }
    return await aoService.storeMemory(memory);
  };

  // === NETWORK METHODS ===

  const getPeerNetwork = async () => {
    if (!aoService.isReady()) {
      return { peers: [], proposals: [] };
    }
    return await aoService.getPeerNetwork();
  };

  const addPeer = async (processId) => {
    if (!aoService.isReady()) {
      throw new Error('AO service not ready');
    }
    return await aoService.addPeer(processId);
  };

  const getOracleStatus = async () => {
    if (!aoService.isReady()) {
      return {
        activeProposals: 0,
        recentActivity: 'unknown',
        consensusHealth: 'unknown',
        communityMood: 'unknown'
      };
    }
    return await aoService.getOracleStatus();
  };

  const getRecentProposals = async (limit = 10, status = 'all') => {
    if (!aoService.isReady()) {
      return [];
    }
    return await aoService.getRecentProposals(limit, status);
  };

  const submitProposal = async (title, content, category = 'general') => {
    if (!aoService.isReady()) {
      throw new Error('AO service not ready');
    }
    return await aoService.submitProposal(title, content, category);
  };

  const getAgentProcessList = async () => {
    if (!aoService.isReady()) {
      return [];
    }
    return await aoService.getAgentProcessList();
  };

  // Context value
  const value = {
    // Status
    aoStatus,
    processIds,
    isInitializing,
    error,
    isReady: aoService.isReady(),
    
    // Chat methods
    sendChatMessage,
    readInbox,
    pollForMessages,
    
    // Memory methods
    getMemories,
    storeMemory,
    
    // Network methods
    getPeerNetwork,
    addPeer,
    getOracleStatus,
    getRecentProposals,
    submitProposal,
    getAgentProcessList,
    
    // Utility
    getStatus: () => aoService.getStatus()
  };

  return (
    <AOContext.Provider value={value}>
      {children}
    </AOContext.Provider>
  );
};
