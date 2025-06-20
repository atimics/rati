
export const createAgentSlice = (set) => ({
  agents: [],
  activeAgent: null,
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
});
