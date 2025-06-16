const Joi = require('joi');

const deploymentSchemas = {
  genesis: Joi.object({
    name: Joi.string().required().min(1).max(100),
    description: Joi.string().optional().max(500),
    config: Joi.object().optional()
  }),

  oracle: Joi.object({
    genesisId: Joi.string().required().min(1),
    name: Joi.string().required().min(1).max(100),
    config: Joi.object().optional()
  }),

  agent: Joi.object({
    genesisId: Joi.string().required().min(1),
    oracleId: Joi.string().required().min(1),
    name: Joi.string().required().min(1).max(100),
    prompt: Joi.string().optional().max(10000),
    config: Joi.object().optional()
  })
};

const agentSchemas = {
  start: Joi.object({
    agentId: Joi.string().required().min(1)
  }),

  stop: Joi.object({
    agentId: Joi.string().required().min(1)
  }),

  message: Joi.object({
    agentId: Joi.string().required().min(1),
    content: Joi.string().required().min(1).max(5000)
  })
};

module.exports = {
  deploymentSchemas,
  agentSchemas
};