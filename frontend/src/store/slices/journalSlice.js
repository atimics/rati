
export const createJournalSlice = (set) => ({
  journals: [],
  journalHistory: [],
  addJournal: (journal) => set((state) => {
    state.journals.unshift({
      ...journal,
      id: journal.id || Date.now(),
      createdAt: journal.createdAt || new Date().toISOString()
    });
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
});
