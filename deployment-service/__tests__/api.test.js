const request = require('supertest');
const app = require('../server');

describe('Deployment Service API', () => {
  describe('GET /health', () => {
    it('should return 200 and health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /deploy/genesis', () => {
    it('should deploy genesis successfully', async () => {
      const deploymentData = {
        name: 'test-genesis',
        description: 'Test genesis deployment'
      };

      const response = await request(app)
        .post('/deploy/genesis')
        .send(deploymentData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('processId');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/deploy/genesis')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /deploy/oracle', () => {
    it('should deploy oracle successfully', async () => {
      const deploymentData = {
        genesisId: 'test-genesis-id',
        name: 'test-oracle'
      };

      const response = await request(app)
        .post('/deploy/oracle')
        .send(deploymentData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('processId');
    });
  });

  describe('POST /deploy/agent', () => {
    it('should deploy agent successfully', async () => {
      const deploymentData = {
        genesisId: 'test-genesis-id',
        oracleId: 'test-oracle-id',
        name: 'test-agent'
      };

      const response = await request(app)
        .post('/deploy/agent')
        .send(deploymentData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('processId');
    });
  });
});