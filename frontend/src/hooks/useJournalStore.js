import { useRatiStore } from '../store';

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
