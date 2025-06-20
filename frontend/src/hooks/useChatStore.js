import { useRatiStore } from '../store';

export const useChatStore = () => {
  const chatHistory = useRatiStore(state => state.chatHistory);
  const addChatMessage = useRatiStore(state => state.addChatMessage);
  const setChatHistory = useRatiStore(state => state.setChatHistory);
  const clearChatHistory = useRatiStore(state => state.clearChatHistory);
  
  return {
    chatHistory,
    addChatMessage,
    setChatHistory,
    clearChatHistory
  };
};
