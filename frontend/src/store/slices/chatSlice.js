
export const createChatSlice = (set) => ({
  chatHistory: {},
  addChatMessage: (agentId, message) => set((state) => {
    if (!state.chatHistory[agentId]) {
      state.chatHistory[agentId] = [];
    }
    state.chatHistory[agentId].push(message);
  }),
  clearChatHistory: (agentId) => set((state) => {
    if (state.chatHistory[agentId]) {
      state.chatHistory[agentId] = [];
    }
  }),
});
