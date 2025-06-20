import { useRatiStore } from '../store';

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
