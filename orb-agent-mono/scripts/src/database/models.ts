// MongoDB Models for Orb Agent System

import { MongoClient, Db, Collection } from 'mongodb';
import type { 
  AgentDocument, 
  UserDocument, 
  TransactionDocument,
  ChainType 
} from '../../../web-frame/src/types';

export class Database {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(uri: string): Promise<void> {
    try {
      this.client = new MongoClient(uri);
      await this.client.connect();
      this.db = this.client.db('orb_agents');
      
      // Create indexes for better performance
      await this.createIndexes();
      
      console.log('Connected to MongoDB successfully');
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');

    // Agent collection indexes
    const agents = this.db.collection<AgentDocument>('agents');
    await agents.createIndex({ index: 1 }, { unique: true });
    await agents.createIndex({ orbMint: 1 });
    await agents.createIndex({ chainId: 1 });
    await agents.createIndex({ transactionHash: 1 });
    await agents.createIndex({ createdAt: -1 });

    // User collection indexes
    const users = this.db.collection<UserDocument>('users');
    await users.createIndex({ address: 1, chainType: 1 }, { unique: true });
    await users.createIndex({ lastActivity: -1 });
    await users.createIndex({ totalMinted: -1 });

    // Transaction collection indexes
    const transactions = this.db.collection<TransactionDocument>('transactions');
    await transactions.createIndex({ hash: 1 }, { unique: true });
    await transactions.createIndex({ from: 1 });
    await transactions.createIndex({ chainId: 1 });
    await transactions.createIndex({ status: 1 });
    await transactions.createIndex({ createdAt: -1 });
  }

  // Agent methods
  async saveAgent(agent: Omit<AgentDocument, '_id'>): Promise<AgentDocument> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<AgentDocument>('agents');
    const result = await collection.insertOne({
      ...agent,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    return { ...agent, _id: result.insertedId.toString() };
  }

  async getAgent(index: number): Promise<AgentDocument | null> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<AgentDocument>('agents');
    return collection.findOne({ index });
  }

  async getAgentsByChain(chainId: number): Promise<AgentDocument[]> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<AgentDocument>('agents');
    return collection.find({ chainId }).sort({ createdAt: -1 }).toArray();
  }

  async getAgentsByOrb(orbMint: string): Promise<AgentDocument[]> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<AgentDocument>('agents');
    return collection.find({ orbMint }).toArray();
  }

  async getRecentAgents(limit: number = 50): Promise<AgentDocument[]> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<AgentDocument>('agents');
    return collection.find({}).sort({ createdAt: -1 }).limit(limit).toArray();
  }

  async getAgentStats() {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<AgentDocument>('agents');
    
    const [totalCount, chainStats, rarityStats] = await Promise.all([
      collection.countDocuments(),
      collection.aggregate([
        { $group: { _id: '$chainId', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]).toArray(),
      collection.aggregate([
        { $group: { _id: '$agentData.rarity', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]).toArray(),
    ]);

    return {
      total: totalCount,
      byChain: chainStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {} as Record<number, number>),
      byRarity: rarityStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  // User methods
  async saveUser(user: Omit<UserDocument, '_id'>): Promise<UserDocument> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<UserDocument>('users');
    
    // Upsert user
    const result = await collection.findOneAndUpdate(
      { address: user.address, chainType: user.chainType },
      {
        $set: {
          ...user,
          lastActivity: new Date(),
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
          totalMinted: 0,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
    
    return result.value!;
  }

  async getUser(address: string, chainType: ChainType): Promise<UserDocument | null> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<UserDocument>('users');
    return collection.findOne({ address, chainType });
  }

  async incrementUserMintCount(address: string, chainType: ChainType): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<UserDocument>('users');
    await collection.updateOne(
      { address, chainType },
      {
        $inc: { totalMinted: 1 },
        $set: { lastActivity: new Date() },
      }
    );
  }

  async getTopMinters(limit: number = 10): Promise<UserDocument[]> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<UserDocument>('users');
    return collection.find({})
      .sort({ totalMinted: -1 })
      .limit(limit)
      .toArray();
  }

  async getUserStats() {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<UserDocument>('users');
    
    const [totalUsers, chainStats, mintingStats] = await Promise.all([
      collection.countDocuments(),
      collection.aggregate([
        { $group: { _id: '$chainType', count: { $sum: 1 } } }
      ]).toArray(),
      collection.aggregate([
        {
          $group: {
            _id: null,
            totalMinted: { $sum: '$totalMinted' },
            avgMinted: { $avg: '$totalMinted' },
            maxMinted: { $max: '$totalMinted' },
          }
        }
      ]).toArray(),
    ]);

    return {
      totalUsers,
      byChain: chainStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {} as Record<string, number>),
      minting: mintingStats[0] || { totalMinted: 0, avgMinted: 0, maxMinted: 0 },
    };
  }

  // Transaction methods
  async saveTransaction(transaction: Omit<TransactionDocument, '_id'>): Promise<TransactionDocument> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<TransactionDocument>('transactions');
    const result = await collection.insertOne({
      ...transaction,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    return { ...transaction, _id: result.insertedId.toString() };
  }

  async updateTransactionStatus(
    hash: string, 
    status: 'confirmed' | 'failed',
    blockNumber?: number,
    gasUsed?: string
  ): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<TransactionDocument>('transactions');
    await collection.updateOne(
      { hash },
      {
        $set: {
          status,
          ...(blockNumber && { blockNumber }),
          ...(gasUsed && { gasUsed }),
          updatedAt: new Date(),
        },
      }
    );
  }

  async getTransaction(hash: string): Promise<TransactionDocument | null> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<TransactionDocument>('transactions');
    return collection.findOne({ hash });
  }

  async getTransactionsByUser(userAddress: string): Promise<TransactionDocument[]> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<TransactionDocument>('transactions');
    return collection.find({ from: userAddress })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async getPendingTransactions(): Promise<TransactionDocument[]> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<TransactionDocument>('transactions');
    return collection.find({ status: 'pending' })
      .sort({ createdAt: 1 })
      .toArray();
  }

  async getTransactionStats() {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<TransactionDocument>('transactions');
    
    const stats = await collection.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalGas: { $sum: { $toDouble: '$gasUsed' } },
        }
      }
    ]).toArray();

    return stats.reduce((acc, stat) => {
      acc[stat._id] = {
        count: stat.count,
        totalGas: stat.totalGas || 0,
      };
      return acc;
    }, {} as Record<string, { count: number; totalGas: number }>);
  }

  // Search methods
  async searchAgents(query: string, limit: number = 20): Promise<AgentDocument[]> {
    if (!this.db) throw new Error('Database not connected');
    
    const collection = this.db.collection<AgentDocument>('agents');
    
    // Create text search
    const searchQuery = {
      $or: [
        { 'agentData.name': { $regex: query, $options: 'i' } },
        { 'agentData.description': { $regex: query, $options: 'i' } },
        { 'agentData.attributes.value': { $regex: query, $options: 'i' } },
      ],
    };
    
    return collection.find(searchQuery)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    if (!this.db) return false;
    
    try {
      await this.db.admin().ping();
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let dbInstance: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = new Database();
    
    const mongoUri = process.env.MONGODB_URI;
    if (mongoUri) {
      await dbInstance.connect(mongoUri);
    }
  }
  
  return dbInstance;
}

export async function disconnectDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.disconnect();
    dbInstance = null;
  }
}