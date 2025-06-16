const { deployGenesis, deployOracle, deployDefaultAgent } = require('../deployment-manager');

// Mock the external dependencies
jest.mock('@permaweb/aoconnect', () => ({
  spawn: jest.fn(),
  message: jest.fn(),
  result: jest.fn()
}));

jest.mock('arweave', () => ({
  default: {
    init: jest.fn(() => ({
      transactions: {
        post: jest.fn()
      },
      wallets: {
        jwkToAddress: jest.fn()
      }
    }))
  }
}));

describe('Deployment Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('deployGenesis', () => {
    it('should deploy genesis process successfully', async () => {
      const mockSpawn = require('@permaweb/aoconnect').spawn;
      mockSpawn.mockResolvedValue({ processId: 'genesis-process-id' });

      const config = {
        name: 'Test Genesis',
        description: 'Test genesis deployment'
      };

      const result = await deployGenesis(config);

      expect(result).toHaveProperty('processId', 'genesis-process-id');
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.objectContaining({
          module: expect.any(String),
          scheduler: expect.any(String)
        })
      );
    });

    it('should handle deployment errors gracefully', async () => {
      const mockSpawn = require('@permaweb/aoconnect').spawn;
      mockSpawn.mockRejectedValue(new Error('Deployment failed'));

      const config = {
        name: 'Test Genesis',
        description: 'Test genesis deployment'
      };

      await expect(deployGenesis(config)).rejects.toThrow('Deployment failed');
    });
  });

  describe('deployOracle', () => {
    it('should deploy oracle process successfully', async () => {
      const mockSpawn = require('@permaweb/aoconnect').spawn;
      mockSpawn.mockResolvedValue({ processId: 'oracle-process-id' });

      const config = {
        genesisId: 'genesis-id',
        name: 'Test Oracle'
      };

      const result = await deployOracle(config);

      expect(result).toHaveProperty('processId', 'oracle-process-id');
      expect(mockSpawn).toHaveBeenCalled();
    });
  });

  describe('deployDefaultAgent', () => {
    it('should deploy agent process successfully', async () => {
      const mockSpawn = require('@permaweb/aoconnect').spawn;
      mockSpawn.mockResolvedValue({ processId: 'agent-process-id' });

      const config = {
        genesisId: 'genesis-id',
        oracleId: 'oracle-id',
        name: 'Test Agent'
      };

      const result = await deployDefaultAgent(config);

      expect(result).toHaveProperty('processId', 'agent-process-id');
      expect(mockSpawn).toHaveBeenCalled();
    });
  });
});