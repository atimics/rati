#!/usr/bin/env node

/**
 * Advanced Secret Scanner for Orb Agent Mono
 * Scans for potential secrets, private keys, and sensitive data
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

// Secret patterns to detect
const SECRET_PATTERNS = [
  {
    name: 'Private Key',
    pattern: /private[_\s]*key[_\s]*[=:]\s*["']?([a-fA-F0-9]{64,}|[A-Za-z0-9+/]{40,}={0,2})["']?/gi,
    severity: 'HIGH'
  },
  {
    name: 'API Key',
    pattern: /api[_\s]*key[_\s]*[=:]\s*["']?([a-zA-Z0-9]{20,})["']?/gi,
    severity: 'HIGH'
  },
  {
    name: 'Secret Key',
    pattern: /secret[_\s]*key[_\s]*[=:]\s*["']?([a-zA-Z0-9+/]{20,}={0,2})["']?/gi,
    severity: 'HIGH'
  },
  {
    name: 'Bearer Token',
    pattern: /bearer[_\s]*token[_\s]*[=:]\s*["']?([a-zA-Z0-9+/]{20,}={0,2})["']?/gi,
    severity: 'HIGH'
  },
  {
    name: 'Password',
    pattern: /password[_\s]*[=:]\s*["']?([a-zA-Z0-9!@#$%^&*()]{8,})["']?/gi,
    severity: 'MEDIUM'
  },
  {
    name: 'Mnemonic Phrase',
    pattern: /mnemonic[_\s]*[=:]|seed[_\s]*phrase[_\s]*[=:]/gi,
    severity: 'CRITICAL'
  },
  {
    name: 'Database URL',
    pattern: /mongodb:\/\/[^"'\s]+|postgres:\/\/[^"'\s]+|mysql:\/\/[^"'\s]+/gi,
    severity: 'MEDIUM'
  },
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: 'HIGH'
  },
  {
    name: 'GitHub Token',
    pattern: /ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|ghu_[a-zA-Z0-9]{36}/g,
    severity: 'HIGH'
  },
  {
    name: 'Solana Private Key',
    pattern: /\b[1-9A-HJ-NP-Za-km-z]{87,88}\b/g,
    severity: 'CRITICAL'
  },
  {
    name: 'Ethereum Private Key',
    pattern: /0x[a-fA-F0-9]{64}/g,
    severity: 'CRITICAL'
  },
  {
    name: 'JWT Token',
    pattern: /eyJ[a-zA-Z0-9+/=]+\.eyJ[a-zA-Z0-9+/=]+\.[a-zA-Z0-9+/=_-]+/g,
    severity: 'MEDIUM'
  }
];

// Files and directories to exclude from scanning
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'target',
  'dist',
  'build',
  'coverage',
  '.next',
  'cache',
  'logs',
  '.env.example',
  'wallet.example.json',
  'check-system.sh',
  'scan-secrets.js',
  '.gitignore',
  'test',
  'mock',
  '__tests__',
  '*.test.*',
  '*.spec.*'
];

// File extensions to scan
const SCAN_EXTENSIONS = [
  '.js', '.ts', '.jsx', '.tsx', '.json', '.env', '.yml', '.yaml', 
  '.toml', '.ini', '.conf', '.config', '.sh', '.bash', '.zsh',
  '.py', '.rs', '.sol', '.md', '.txt'
];

class SecretScanner {
  constructor() {
    this.findings = [];
    this.scannedFiles = 0;
    this.excludePatterns = EXCLUDE_PATTERNS.map(p => new RegExp(p, 'i'));
  }

  shouldExcludeFile(filePath) {
    return this.excludePatterns.some(pattern => pattern.test(filePath));
  }

  shouldScanFile(filePath) {
    if (this.shouldExcludeFile(filePath)) return false;
    
    const ext = extname(filePath).toLowerCase();
    return SCAN_EXTENSIONS.includes(ext) || !ext; // Include files without extensions
  }

  scanFile(filePath) {
    try {
      const content = readFileSync(filePath, 'utf8');
      this.scannedFiles++;
      
      for (const secretPattern of SECRET_PATTERNS) {
        const matches = [...content.matchAll(secretPattern.pattern)];
        
        for (const match of matches) {
          // Skip if it looks like a test/example value
          const fullMatch = match[0];
          if (this.isTestValue(fullMatch)) continue;
          
          // Get line number
          const beforeMatch = content.substring(0, match.index);
          const lineNumber = beforeMatch.split('\n').length;
          
          this.findings.push({
            file: filePath,
            line: lineNumber,
            type: secretPattern.name,
            severity: secretPattern.severity,
            match: fullMatch,
            context: this.getContext(content, match.index, 50)
          });
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not scan ${filePath}: ${error.message}`);
    }
  }

  isTestValue(value) {
    const testIndicators = [
      'test', 'example', 'sample', 'mock', 'fake', 'dummy',
      '1234567890', 'abcdef', 'xxxxxx', '000000',
      'your_key_here', 'your-key-here', 'replace_me'
    ];
    
    const lowerValue = value.toLowerCase();
    return testIndicators.some(indicator => lowerValue.includes(indicator));
  }

  getContext(content, index, radius) {
    const start = Math.max(0, index - radius);
    const end = Math.min(content.length, index + radius);
    return content.substring(start, end).replace(/\n/g, '\\n');
  }

  scanDirectory(dirPath) {
    const items = readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = join(dirPath, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!this.shouldExcludeFile(item)) {
          this.scanDirectory(fullPath);
        }
      } else if (stat.isFile() && this.shouldScanFile(fullPath)) {
        this.scanFile(fullPath);
      }
    }
  }

  generateReport() {
    console.log('\n🔍 Secret Scanning Report');
    console.log('=========================');
    console.log(`Files scanned: ${this.scannedFiles}`);
    console.log(`Potential secrets found: ${this.findings.length}\n`);

    if (this.findings.length === 0) {
      console.log('✅ No secrets detected!');
      return 0;
    }

    // Group by severity
    const bySeverity = this.findings.reduce((acc, finding) => {
      acc[finding.severity] = acc[finding.severity] || [];
      acc[finding.severity].push(finding);
      return acc;
    }, {});

    const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    let exitCode = 0;

    for (const severity of severityOrder) {
      if (!bySeverity[severity]) continue;
      
      console.log(`\n${this.getSeverityIcon(severity)} ${severity} SEVERITY (${bySeverity[severity].length})`);
      console.log('-'.repeat(50));
      
      for (const finding of bySeverity[severity]) {
        console.log(`📄 ${finding.file}:${finding.line}`);
        console.log(`   Type: ${finding.type}`);
        console.log(`   Match: ${finding.match}`);
        console.log(`   Context: ...${finding.context}...`);
        console.log('');
      }
      
      if (severity === 'CRITICAL' || severity === 'HIGH') {
        exitCode = 1;
      }
    }

    console.log('\n📋 Recommendations:');
    console.log('- Move secrets to environment variables');
    console.log('- Use .env files (and ensure they are gitignored)');
    console.log('- Consider using secret management services');
    console.log('- Review and remove any hardcoded credentials');
    
    return exitCode;
  }

  getSeverityIcon(severity) {
    switch (severity) {
      case 'CRITICAL': return '🚨';
      case 'HIGH': return '⚠️';
      case 'MEDIUM': return '⚡';
      case 'LOW': return 'ℹ️';
      default: return '🔍';
    }
  }
}

// Main execution
function main() {
  const scanner = new SecretScanner();
  const startDir = process.argv[2] || '.';
  
  console.log(`🔍 Scanning for secrets in: ${startDir}`);
  console.log('Excluded patterns:', EXCLUDE_PATTERNS.join(', '));
  
  scanner.scanDirectory(startDir);
  const exitCode = scanner.generateReport();
  
  process.exit(exitCode);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
