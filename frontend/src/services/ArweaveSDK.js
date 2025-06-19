import Arweave from 'arweave';
import { toast } from 'react-hot-toast';

/**
 * Modern Streamlined Arweave SDK
 * 
 * Replaces the complex 521-line arweave.js utility with a clean,
 * predictable, and easy-to-use SDK that handles all Arweave interactions.
 */

class ArweaveSDK {
  constructor() {
    // Initialize Arweave client
    this.arweave = Arweave.init({
      host: 'arweave.net',
      port: 443,
      protocol: 'https'
    });

    // Track deployment status
    this.deploymentStatus = new Map();
  }

  /**
   * Deploy data to Arweave with a single, reliable method
   */
  async deploy(data, options = {}) {
    const {
      contentType = 'application/json',
      tags = [],
      onProgress = null
    } = options;

    if (!window.arweaveWallet) {
      throw new Error('Wallet not connected');
    }

    try {
      // Update progress
      onProgress?.({ status: 'creating', progress: 10 });

      // Create transaction
      const transaction = await this.arweave.createTransaction({
        data: typeof data === 'string' ? data : JSON.stringify(data)
      });

      // Add tags
      transaction.addTag('Content-Type', contentType);
      transaction.addTag('App-Name', 'RATi');
      transaction.addTag('App-Version', '1.0.0');
      transaction.addTag('Created-At', new Date().toISOString());
      
      // Add custom tags
      tags.forEach(tag => {
        transaction.addTag(tag.name, tag.value);
      });

      onProgress?.({ status: 'signing', progress: 30 });

      // Sign transaction
      const signedTx = await window.arweaveWallet.sign(transaction);
      
      onProgress?.({ status: 'submitting', progress: 60 });

      // Submit transaction
      const response = await this.arweave.transactions.post(signedTx);
      
      if (response.status !== 200) {
        throw new Error(`Transaction failed with status: ${response.status}`);
      }

      onProgress?.({ status: 'success', progress: 100 });

      const result = {
        success: true,
        txId: signedTx.id,
        url: `https://arweave.net/${signedTx.id}`,
        gateway: `https://arweave.net/${signedTx.id}`
      };

      // Track deployment for status checking
      this.deploymentStatus.set(signedTx.id, {
        status: 'pending',
        createdAt: Date.now()
      });

      toast.success('Deployment successful!');
      return result;

    } catch (error) {
      console.error('Deployment failed:', error);
      
      // User-friendly error messages
      if (error.message.includes('User rejected')) {
        throw new Error('Deployment cancelled by user');
      } else if (error.message.includes('Insufficient funds')) {
        throw new Error('Insufficient AR balance for deployment');
      } else if (error.message.includes('Network')) {
        throw new Error('Network error - please try again');
      }
      
      throw new Error(`Deployment failed: ${error.message}`);
    }
  }

  /**
   * Publish journal entry to Arweave
   */
  async publishJournal(entry, metadata = {}) {
    const journalData = {
      type: 'journal-entry',
      content: entry,
      metadata: {
        ...metadata,
        wordCount: entry.split(/\s+/).length,
        publishedAt: new Date().toISOString()
      }
    };

    const tags = [
      { name: 'Type', value: 'Journal-Entry' },
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Author', value: metadata.author || 'RATi' }
    ];

    return this.deploy(journalData, {
      contentType: 'application/json',
      tags,
      onProgress: (progress) => {
        if (progress.status === 'success') {
          toast.success('Journal entry published!');
        }
      }
    });
  }

  /**
   * Deploy agent to Arweave
   */
  async deployAgent(agentData, options = {}) {
    const {
      name = 'RATi Agent',
      bio = 'A digital avatar on Arweave',
      traits = []
    } = options;

    const deploymentData = {
      type: 'agent-deployment',
      agent: {
        name,
        bio,
        traits,
        ...agentData
      },
      deployedAt: new Date().toISOString(),
      version: '1.0.0'
    };

    const tags = [
      { name: 'Type', value: 'Agent-Deployment' },
      { name: 'Agent-Name', value: name },
      { name: 'Agent-Version', value: '1.0.0' }
    ];

    return this.deploy(deploymentData, {
      contentType: 'application/json',
      tags,
      onProgress: (progress) => {
        if (progress.status === 'success') {
          toast.success(`Agent "${name}" deployed successfully!`);
        }
      }
    });
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txId) {
    try {
      // Get status from Arweave
      const status = await this.arweave.transactions.getStatus(txId);
      
      let confirmed = false;
      let blockHeight = null;
      
      if (status.status === 200) {
        confirmed = status.confirmed?.block_height > 0;
        blockHeight = status.confirmed?.block_height;
      }

      // Update local status
      if (confirmed) {
        this.deploymentStatus.set(txId, {
          status: 'confirmed',
          blockHeight,
          confirmedAt: Date.now()
        });
      }

      return {
        txId,
        confirmed,
        blockHeight,
        pending: !confirmed,
        url: `https://arweave.net/${txId}`
      };
    } catch (error) {
      console.error('Status check failed:', error);
      return {
        txId,
        confirmed: false,
        pending: true,
        error: error.message
      };
    }
  }

  /**
   * Estimate transaction cost
   */
  async estimateCost(data) {
    try {
      const dataSize = new Blob([typeof data === 'string' ? data : JSON.stringify(data)]).size;
      const winston = await this.arweave.transactions.getPrice(dataSize);
      const ar = this.arweave.ar.winstonToAr(winston);
      
      return {
        bytes: dataSize,
        winston,
        ar: parseFloat(ar),
        usd: parseFloat(ar) * 50 // Approximate AR price
      };
    } catch (error) {
      console.error('Cost estimation failed:', error);
      return {
        bytes: 0,
        winston: '0',
        ar: 0,
        usd: 0,
        error: error.message
      };
    }
  }

  /**
   * Get wallet balance
   */
  async getBalance(address) {
    try {
      const winston = await this.arweave.wallets.getBalance(address);
      const ar = this.arweave.ar.winstonToAr(winston);
      
      return {
        winston,
        ar: parseFloat(ar),
        formatted: parseFloat(ar) < 0.001 ? 
          parseFloat(ar).toFixed(6) : 
          parseFloat(ar).toFixed(3)
      };
    } catch (error) {
      console.error('Balance check failed:', error);
      return {
        winston: '0',
        ar: 0,
        formatted: '0.000',
        error: error.message
      };
    }
  }

  /**
   * Load data from Arweave
   */
  async loadData(txId) {
    try {
      const response = await fetch(`https://arweave.net/${txId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      console.error('Data loading failed:', error);
      throw error;
    }
  }

  /**
   * Search for data by tags
   */
  async searchByTags(tags) {
    try {
      const query = {
        query: {
          tags: tags.map(tag => ({
            name: tag.name,
            values: [tag.value]
          }))
        }
      };

      const response = await this.arweave.api.post('graphql', query);
      return response.data;
    } catch (error) {
      console.error('Search failed:', error);
      return { edges: [] };
    }
  }
}

// Create singleton instance
const arweaveSDK = new ArweaveSDK();

export default arweaveSDK;
