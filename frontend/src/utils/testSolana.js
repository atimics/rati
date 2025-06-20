/**
 * Test script for Solana PDA derivation
 * 
 * Run this in the browser console to test the burn address generation
 */

import { deriveCharacterBurnAddress, isValidRatiBurnAddress } from '../api/solana.js';

// Test function
export function testSolanaPDA() {
  console.log('🧪 Testing Solana PDA derivation...');
  
  // Test with mock Arweave transaction IDs
  const testTxIds = [
    'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz_567',
    'test-transaction-id-1234567890',
    'another-arweave-tx-id-for-testing-purposes',
    'short-tx',
    'very-long-arweave-transaction-id-with-many-characters-to-test-edge-cases'
  ];

  testTxIds.forEach((txId, index) => {
    try {
      console.log(`\n📋 Test ${index + 1}: ${txId}`);
      
      const result = deriveCharacterBurnAddress(txId);
      console.log(`✅ Success:`, result);
      
      const isValid = isValidRatiBurnAddress(result.address);
      console.log(`🔍 Valid RATi address: ${isValid}`);
      
      if (!result.address.startsWith('RATi')) {
        console.error('❌ Address does not start with RATi!', result.address);
      } else {
        console.log(`✅ Address correctly starts with RATi: ${result.address}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed for ${txId}:`, error.message);
    }
  });
  
  console.log('\n🎯 Testing complete!');
}

// Test with actual Arweave-like transaction ID
export function testWithRealisticTxId() {
  const realisticTxId = 'J5s7zlFJSgTGfe8VGGd9-WqgKF5qZm4a8c3rN4J_t7KLm6nFbH9P2xEwQ8yTzRuV';
  
  console.log('🧪 Testing with realistic Arweave TX ID:', realisticTxId);
  
  try {
    const result = deriveCharacterBurnAddress(realisticTxId);
    console.log('✅ Burn address generated:', result);
    
    // Verify it's deterministic by generating again
    const result2 = deriveCharacterBurnAddress(realisticTxId);
    const isDeterministic = result.address === result2.address;
    
    console.log(`🔄 Deterministic test: ${isDeterministic ? 'PASS' : 'FAIL'}`);
    
    if (isDeterministic) {
      console.log('✅ Same TX ID always produces same burn address');
    } else {
      console.error('❌ Results differ between calls!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Export for console testing
if (typeof window !== 'undefined') {
  window.testSolanaPDA = testSolanaPDA;
  window.testWithRealisticTxId = testWithRealisticTxId;
}
