/**
 * Environment Variable Validation for Orb Agent Mono
 * Ensures all required environment variables are present and valid
 */

interface EnvConfig {
  // Blockchain RPCs
  SOLANA_RPC_URL: string;
  EVM_RPC_URL: string;
  
  // API Keys (optional in development)
  INFURA_API_KEY?: string;
  BUNDLR_API_KEY?: string;
  
  // Database (optional)
  MONGODB_URI?: string;
  
  // Wormhole
  WORMHOLE_RPC_URL?: string;
  
  // Security
  NODE_ENV: 'development' | 'test' | 'production';
  
  // Application
  PORT?: string;
  CORS_ORIGIN?: string;
}

const requiredEnvVars: (keyof EnvConfig)[] = [
  'SOLANA_RPC_URL',
  'EVM_RPC_URL',
  'NODE_ENV'
];

const productionRequiredVars: (keyof EnvConfig)[] = [
  ...requiredEnvVars,
  'INFURA_API_KEY',
  'BUNDLR_API_KEY'
];

export function validateEnvironment(): EnvConfig {
  const env = process.env as any;
  const config: Partial<EnvConfig> = {};
  const missing: string[] = [];
  const isProduction = env.NODE_ENV === 'production';
  
  // Determine which variables are required
  const requiredVars = isProduction ? productionRequiredVars : requiredEnvVars;
  
  // Check required variables
  for (const varName of requiredVars) {
    if (!env[varName]) {
      missing.push(varName);
    } else {
      config[varName] = env[varName];
    }
  }
  
  // Optional variables
  const optionalVars: (keyof EnvConfig)[] = [
    'MONGODB_URI',
    'WORMHOLE_RPC_URL',
    'PORT',
    'CORS_ORIGIN'
  ];
  
  for (const varName of optionalVars) {
    if (env[varName]) {
      config[varName] = env[varName];
    }
  }
  
  // Add conditional optional vars
  if (!isProduction) {
    if (env.INFURA_API_KEY) config.INFURA_API_KEY = env.INFURA_API_KEY;
    if (env.BUNDLR_API_KEY) config.BUNDLR_API_KEY = env.BUNDLR_API_KEY;
  }
  
  if (missing.length > 0) {
    const errorMsg = `Missing required environment variables: ${missing.join(', ')}`;
    const suggestions = [
      'Create a .env file with the required variables',
      'Check your deployment configuration',
      isProduction ? 'Ensure all production secrets are configured' : 'Use default development values'
    ];
    
    console.error(`❌ ${errorMsg}`);
    suggestions.forEach(suggestion => console.error(`  - ${suggestion}`));
    
    throw new Error(errorMsg);
  }
  
  // Validate URL formats
  validateUrl(config.SOLANA_RPC_URL!, 'SOLANA_RPC_URL');
  validateUrl(config.EVM_RPC_URL!, 'EVM_RPC_URL');
  
  if (config.WORMHOLE_RPC_URL) {
    validateUrl(config.WORMHOLE_RPC_URL, 'WORMHOLE_RPC_URL');
  }
  
  // Validate PORT if provided
  if (config.PORT) {
    const port = parseInt(config.PORT, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid PORT: ${config.PORT}. Must be a number between 1 and 65535.`);
    }
  }
  
  console.log('✅ Environment validation passed');
  return config as EnvConfig;
}

function validateUrl(url: string, varName: string): void {
  try {
    new URL(url);
  } catch (error) {
    throw new Error(`Invalid URL for ${varName}: ${url}`);
  }
}

/**
 * Check for potentially unsafe patterns in environment variables
 */
export function securityAuditEnv(): void {
  const env = process.env;
  const warnings: string[] = [];
  
  // Check for suspicious patterns
  Object.entries(env).forEach(([key, value]) => {
    if (!value) return;
    
    // Check for hardcoded localhost in production
    if (process.env.NODE_ENV === 'production' && value.includes('localhost')) {
      warnings.push(`${key} contains localhost in production: ${value}`);
    }
    
    // Check for HTTP URLs in production (should be HTTPS)
    if (process.env.NODE_ENV === 'production' && 
        (key.includes('URL') || key.includes('RPC')) && 
        value.startsWith('http://')) {
      warnings.push(`${key} uses HTTP in production (consider HTTPS): ${value}`);
    }
    
    // Check for suspiciously long values that might be accidentally included secrets
    if (value.length > 100 && !key.includes('URI') && !key.includes('URL')) {
      warnings.push(`${key} has unusually long value (${value.length} chars) - verify it's not a secret`);
    }
  });
  
  if (warnings.length > 0) {
    console.warn('⚠️  Environment Security Warnings:');
    warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
}

export default validateEnvironment;
