// Environment configuRATion for RATi
const config = {
  arweave: {
    host: import.meta.env.VITE_ARWEAVE_HOST || 'localhost',
    port: parseInt(import.meta.env.VITE_ARWEAVE_PORT || '1984'),
    protocol: import.meta.env.VITE_ARWEAVE_PROTOCOL || 'http'
  },
  ao: {
    moduleId: import.meta.env.VITE_AO_MODULE_ID || 'SBNb1qPQ1TDwpD_mboxm2YllmMLXpWw4U8P9Ff8W9vk',
    schedulerId: import.meta.env.VITE_AO_SCHEDULER_ID || '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA'
  },
  app: {
    name: 'RATi',
    version: import.meta.env.VITE_APP_VERSION || '0.1.0',
    environment: import.meta.env.VITE_NODE_ENV || 'development'
  },
  processes: {
    oracle: import.meta.env.VITE_ORACLE_PROCESS_ID || 'YOUR_ORACLE_PROCESS_ID_HERE',
    cell: import.meta.env.VITE_CELL_PROCESS_ID || 'YOUR_CELL_PROCESS_ID_HERE'
  },
  genesis: {
    txid: import.meta.env.VITE_GENESIS_TXID || 'YOUR_GENESIS_TXID_HERE'
  }
};

export default config;
