const EventEmitter = require('events');

class DeploymentMonitor extends EventEmitter {
  constructor() {
    super();
    this.deployments = new Map();
    this.monitoringInterval = null;
    this.checkInterval = 30000; // 30 seconds
  }

  /**
   * Start monitoring deployments
   */
  start() {
    if (this.monitoringInterval) {
      return;
    }

    console.log('Starting deployment monitor...');
    this.monitoringInterval = setInterval(() => {
      this.checkDeployments();
    }, this.checkInterval);

    this.emit('monitor:started');
  }

  /**
   * Stop monitoring deployments
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Deployment monitor stopped');
      this.emit('monitor:stopped');
    }
  }

  /**
   * Register a deployment for monitoring
   */
  registerDeployment(id, type, processId, config = {}) {
    const deployment = {
      id,
      type,
      processId,
      status: 'active',
      createdAt: new Date(),
      lastChecked: null,
      lastActive: new Date(),
      failureCount: 0,
      config: {
        maxFailures: 3,
        timeout: 10000,
        ...config
      }
    };

    this.deployments.set(id, deployment);
    console.log(`Registered deployment for monitoring: ${id} (${type})`);
    this.emit('deployment:registered', deployment);

    return deployment;
  }

  /**
   * Unregister a deployment from monitoring
   */
  unregisterDeployment(id) {
    const deployment = this.deployments.get(id);
    if (deployment) {
      this.deployments.delete(id);
      console.log(`Unregistered deployment: ${id}`);
      this.emit('deployment:unregistered', deployment);
    }
    return deployment;
  }

  /**
   * Get deployment status
   */
  getDeploymentStatus(id) {
    return this.deployments.get(id);
  }

  /**
   * Get all deployments
   */
  getAllDeployments() {
    return Array.from(this.deployments.values());
  }

  /**
   * Check health of all registered deployments
   */
  async checkDeployments() {
    const promises = Array.from(this.deployments.values()).map(deployment => 
      this.checkDeployment(deployment)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Check health of a specific deployment
   */
  async checkDeployment(deployment) {
    try {
      const isHealthy = await this.healthCheck(deployment);
      
      if (isHealthy) {
        deployment.status = 'active';
        deployment.lastActive = new Date();
        deployment.failureCount = 0;
        deployment.lastChecked = new Date();
        
        this.emit('deployment:healthy', deployment);
      } else {
        deployment.failureCount++;
        deployment.lastChecked = new Date();
        
        if (deployment.failureCount >= deployment.config.maxFailures) {
          deployment.status = 'failed';
          this.emit('deployment:failed', deployment);
          console.error(`Deployment failed: ${deployment.id} (${deployment.failureCount} failures)`);
        } else {
          deployment.status = 'unhealthy';
          this.emit('deployment:unhealthy', deployment);
          console.warn(`Deployment unhealthy: ${deployment.id} (${deployment.failureCount}/${deployment.config.maxFailures} failures)`);
        }
      }
    } catch (error) {
      console.error(`Error checking deployment ${deployment.id}:`, error);
      deployment.failureCount++;
      deployment.lastChecked = new Date();
      
      if (deployment.failureCount >= deployment.config.maxFailures) {
        deployment.status = 'error';
        this.emit('deployment:error', deployment, error);
      }
    }
  }

  /**
   * Perform health check on a deployment
   * This is a placeholder - implement actual health check logic
   */
  async healthCheck(deployment) {
    // TODO: Implement actual health checks based on deployment type
    // For now, return true to simulate healthy deployments
    
    switch (deployment.type) {
      case 'genesis':
        return await this.checkGenesisHealth(deployment);
      case 'oracle':
        return await this.checkOracleHealth(deployment);
      case 'agent':
        return await this.checkAgentHealth(deployment);
      default:
        return true;
    }
  }

  /**
   * Check genesis process health
   */
  async checkGenesisHealth(deployment) {
    // Implement genesis-specific health check
    // Could check if the process is responding, memory usage, etc.
    return true;
  }

  /**
   * Check oracle process health
   */
  async checkOracleHealth(deployment) {
    // Implement oracle-specific health check
    return true;
  }

  /**
   * Check agent process health
   */
  async checkAgentHealth(deployment) {
    // Implement agent-specific health check
    // Could check if agent is responding to messages, memory usage, etc.
    return true;
  }

  /**
   * Get monitoring statistics
   */
  getStats() {
    const deployments = this.getAllDeployments();
    const stats = {
      total: deployments.length,
      active: 0,
      unhealthy: 0,
      failed: 0,
      error: 0,
      byType: {}
    };

    deployments.forEach(deployment => {
      stats[deployment.status]++;
      
      if (!stats.byType[deployment.type]) {
        stats.byType[deployment.type] = { total: 0, active: 0, unhealthy: 0, failed: 0, error: 0 };
      }
      stats.byType[deployment.type].total++;
      stats.byType[deployment.type][deployment.status]++;
    });

    return stats;
  }
}

// Create singleton instance
const deploymentMonitor = new DeploymentMonitor();

module.exports = deploymentMonitor;