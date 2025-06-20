import Arweave from 'arweave';

/**
 * Client-side Arweave utilities for frontend deployment and wallet integration
 */

// Initialize Arweave for client-side use
export const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https'
});

// Development/local Arweave instance
export const arweaveLocal = Arweave.init({
  host: 'localhost',
  port: 1984,
  protocol: 'http'
});

/**
 * Connect to ArConnect wallet extension
 */
export async function connectWallet() {
  try {
    // Check if ArConnect is available
    if (!window.arweaveWallet) {
      throw new Error('ArConnect wallet extension not found. Please install ArConnect.');
    }

    // Wait for ArConnect to be fully loaded
    await waitForArConnect(3000);

    // Request connection permissions
    await window.arweaveWallet.connect([
      'ACCESS_ADDRESS',
      'ACCESS_PUBLIC_KEY',
      'SIGN_TRANSACTION',
      'DISPATCH'
    ]);

    // Get connected wallet address
    const address = await window.arweaveWallet.getActiveAddress();
    
    if (!address) {
      throw new Error('No active wallet address found. Please select a wallet in ArConnect.');
    }

    // Get public key
    const publicKey = await window.arweaveWallet.getActivePublicKey();

    return {
      connected: true,
      address,
      publicKey,
      wallet: window.arweaveWallet
    };
  } catch (error) {
    console.error('Wallet connection failed:', error);
    
    // Provide more specific error messages
    let errorMessage = error.message;
    if (error.message.includes('User rejected')) {
      errorMessage = 'Connection request was rejected. Please try again and accept the connection.';
    } else if (error.message.includes('No active wallet')) {
      errorMessage = 'No wallet selected in ArConnect. Please select a wallet and try again.';
    }
    
    return {
      connected: false,
      error: errorMessage
    };
  }
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(address) {
  try {
    const winston = await arweave.wallets.getBalance(address);
    const ar = arweave.ar.winstonToAr(winston);
    return {
      winston,
      ar: parseFloat(ar)
    };
  } catch (error) {
    console.error('Failed to get wallet balance:', error);
    throw error;
  }
}

/**
 * Deploy data to Arweave
 */
export async function deployToArweave(data, contentType = 'text/html', tags = []) {
  try {
    if (!window.arweaveWallet) {
      throw new Error('Wallet not connected');
    }

    console.log('=== Starting Arweave Deployment ===');
    
    // Get the active wallet address for validation
    const address = await window.arweaveWallet.getActiveAddress();
    console.log('Deploying with wallet address:', address);
    
    // Check transaction size
    const dataSize = getTransactionSize(data);
    const isSmall = isSmallTransaction(dataSize);
    
    console.log('Transaction info:', {
      dataSize: `${dataSize} bytes`,
      isSmallTransaction: isSmall,
      qualifiesForFree: isSmall ? 'Yes - should be free/very cheap' : 'No - will cost AR'
    });
    
    // Try pure ArConnect approach first (most reliable)
    try {
      console.log('Trying pure ArConnect method...');
      return await deployWithArConnectOnly(data, contentType, tags);
    } catch (arconnectError) {
      console.log('Pure ArConnect failed, trying hybrid approach:', arconnectError.message);
    }
    
    // Fallback to hybrid approach (Arweave.js + ArConnect signing)
    console.log('Using hybrid approach (Arweave.js + ArConnect)...');
    
    // Create transaction properly for ArConnect
    const transaction = await arweave.createTransaction({
      data: data
    });

    // Add content type tag
    transaction.addTag('Content-Type', contentType);
    
    // Add application tags
    transaction.addTag('App-Name', 'RATi-Frontend');
    transaction.addTag('App-Version', '0.2.0');
    transaction.addTag('Type', 'web-app');
    
    // Add size information
    transaction.addTag('Data-Size', dataSize.toString());
    
    // Add custom tags
    tags.forEach(tag => {
      transaction.addTag(tag.name, tag.value);
    });

    console.log('Transaction created:', {
      id: transaction.id,
      dataSize: transaction.data_size,
      tags: transaction.tags
    });

    // Sign transaction with ArConnect
    console.log('Requesting signature from ArConnect...');
    
    // Use ArConnect's sign method - it returns a properly formatted transaction
    const signedTransaction = await window.arweaveWallet.sign(transaction);
    
    console.log('Transaction signed:', {
      id: signedTransaction.id,
      hasSignature: !!signedTransaction.signature,
      signatureLength: signedTransaction.signature?.length,
      format: signedTransaction.format,
      dataSize: signedTransaction.data_size
    });
    
    // Verify the transaction was signed
    if (!signedTransaction.signature || signedTransaction.signature.length === 0) {
      throw new Error('Transaction was not properly signed by ArConnect');
    }
    
    // Additional validation for ArConnect transactions
    if (signedTransaction.format !== 2) {
      console.warn('Transaction format is not v2, this might cause issues:', signedTransaction.format);
    }

    // Submit transaction
    console.log('Submitting transaction to Arweave...');
    
    // For ArConnect signed transactions, try dispatch method first (more reliable)
    if (window.arweaveWallet.dispatch) {
      try {
        console.log('Using ArConnect dispatch method...');
        const dispatchResult = await window.arweaveWallet.dispatch(signedTransaction);
        console.log('Dispatch result:', dispatchResult);
        
        return {
          success: true,
          txId: signedTransaction.id,
          url: `https://arweave.net/${signedTransaction.id}`,
          gateway: `https://arweave.net/${signedTransaction.id}`,
          method: 'dispatch'
        };
      } catch (dispatchError) {
        console.error('Dispatch method failed, trying direct post:', dispatchError);
      }
    }
    
    // Fallback to direct posting
    let response;
    try {
      console.log('Using direct post method...');
      
      // Log the transaction before posting for debugging
      console.log('Transaction being posted:', {
        id: signedTransaction.id,
        format: signedTransaction.format,
        data_size: signedTransaction.data_size,
        target: signedTransaction.target,
        quantity: signedTransaction.quantity,
        tags: signedTransaction.tags?.length || 0,
        hasSignature: !!signedTransaction.signature,
        hasOwner: !!signedTransaction.owner
      });
      
      response = await arweave.transactions.post(signedTransaction);
    } catch (postError) {
      console.error('Direct post failed:', postError);
      
      // If it's a 400 error, let's try to understand why
      if (postError.response?.status === 400) {
        console.error('400 Bad Request details:', {
          status: postError.response.status,
          statusText: postError.response.statusText,
          data: postError.response.data,
          headers: postError.response.headers
        });
        
        // Try manual verification of the transaction
        try {
          const isValid = await arweave.transactions.verify(signedTransaction);
          console.log('Transaction verification result:', isValid);
        } catch (verifyError) {
          console.error('Transaction verification failed:', verifyError);
        }
      }
      
      throw postError;
    }
    
    console.log('Transaction submission response:', {
      status: response.status,
      statusText: response.statusText,
      data: response.data
    });
    
    if (response.status === 200 || response.status === 202) {
      return {
        success: true,
        txId: signedTransaction.id,
        url: `https://arweave.net/${signedTransaction.id}`,
        gateway: `https://arweave.net/${signedTransaction.id}`
      };
    } else {
      // Log more details about the error
      console.error('Transaction submission failed:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        transactionId: signedTransaction.id
      });
      
      throw new Error(`Deployment failed with status: ${response.status} - ${response.statusText || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Deployment to Arweave failed:', error);
    
    // Log transaction details for debugging
    if (error.response) {
      console.error('Error response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    
    // Provide more specific error messages
    if (error.message.includes('User rejected')) {
      throw new Error('Transaction signing was rejected by user');
    } else if (error.message.includes('not properly signed')) {
      throw new Error('Transaction signing failed - please try again');
    } else if (error.message.includes('Insufficient funds')) {
      throw new Error('Insufficient AR balance to complete transaction');
    } else if (error.message.includes('400')) {
      throw new Error('Transaction verification failed - this may be due to network issues or transaction format. Please try again.');
    }
    
    throw error;
  }
}

/**
 * Deploy using pure ArConnect methods (alternative approach)
 */
export async function deployWithArConnectOnly(data, contentType = 'text/html', tags = []) {
  try {
    if (!window.arweaveWallet) {
      throw new Error('ArConnect not available');
    }

    console.log('=== Pure ArConnect Deployment ===');
    
    // Get wallet info
    const address = await window.arweaveWallet.getActiveAddress();
    console.log('Using address:', address);
    
    // Prepare transaction data
    const transactionData = {
      data: data,
      tags: [
        { name: 'Content-Type', value: contentType },
        { name: 'App-Name', value: 'RATi-Frontend' },
        { name: 'App-Version', value: '0.2.0' },
        { name: 'Type', value: 'web-app' },
        { name: 'Data-Size', value: getTransactionSize(data).toString() },
        ...tags
      ]
    };
    
    console.log('Transaction data prepared:', {
      dataSize: getTransactionSize(data),
      tagsCount: transactionData.tags.length
    });
    
    // Use ArConnect's createTransaction method if available
    if (window.arweaveWallet.createTransaction) {
      console.log('Using ArConnect createTransaction...');
      const txId = await window.arweaveWallet.createTransaction(transactionData);
      console.log('Transaction created and dispatched:', txId);
      
      return {
        success: true,
        txId: txId,
        url: `https://arweave.net/${txId}`,
        gateway: `https://arweave.net/${txId}`,
        method: 'arconnect-native'
      };
    }
    
    throw new Error('ArConnect createTransaction method not available');
    
  } catch (error) {
    console.error('Pure ArConnect deployment failed:', error);
    throw error;
  }
}

/**
 * Upload file to Arweave
 */
export async function uploadFile(file, tags = []) {
  try {
    const data = await file.arrayBuffer();
    return await deployToArweave(data, file.type, [
      { name: 'File-Name', value: file.name },
      { name: 'File-Size', value: file.size.toString() },
      ...tags
    ]);
  } catch (error) {
    console.error('File upload failed:', error);
    throw error;
  }
}

/**
 * Get transaction data from Arweave
 */
export async function getTransactionData(txId) {
  try {
    const response = await fetch(`https://arweave.net/${txId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch transaction: ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    console.error('Failed to get transaction data:', error);
    throw error;
  }
}

/**
 * Get transaction status
 */
export async function getTransactionStatus(txId) {
  try {
    const status = await arweave.transactions.getStatus(txId);
    return status;
  } catch (error) {
    console.error('Failed to get transaction status:', error);
    throw error;
  }
}

/**
 * Estimate transaction cost
 */
export async function estimateTransactionCost(dataSize) {
  try {
    const price = await arweave.transactions.getPrice(dataSize);
    const ar = arweave.ar.winstonToAr(price);
    return {
      winston: price,
      ar: parseFloat(ar)
    };
  } catch (error) {
    console.error('Failed to estimate transaction cost:', error);
    throw error;
  }
}

/**
 * Check if ArConnect is available
 */
export function isArConnectAvailable() {
  return typeof window !== 'undefined' && !!window.arweaveWallet;
}

/**
 * Wait for ArConnect to be available
 */
export function waitForArConnect(timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (isArConnectAvailable()) {
      resolve(true);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      if (isArConnectAvailable()) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        reject(new Error('ArConnect not available after timeout'));
      }
    }, 100);
  });
}

/**
 * Check if transaction qualifies for free/reduced cost (under 200KB)
 */
export function isSmallTransaction(dataSize) {
  const FREE_TRANSACTION_LIMIT = 200 * 1024; // 200KB in bytes
  return dataSize < FREE_TRANSACTION_LIMIT;
}

/**
 * Get transaction size from data
 */
export function getTransactionSize(data) {
  if (typeof data === 'string') {
    return new Blob([data]).size;
  } else if (data instanceof ArrayBuffer) {
    return data.byteLength;
  } else if (data instanceof Uint8Array) {
    return data.length;
  }
  return 0;
}

/**
 * Debug function to test ArConnect connection and basic transaction creation
 */
export async function debugArConnect() {
  console.log('=== ArConnect Debug Info ===');
  
  try {
    // Check ArConnect availability
    console.log('1. ArConnect available:', !!window.arweaveWallet);
    
    if (!window.arweaveWallet) {
      console.log('❌ ArConnect not found');
      return;
    }
    
    // Get permissions
    const permissions = await window.arweaveWallet.getPermissions();
    console.log('2. Permissions:', permissions);
    
    // Get active address
    const address = await window.arweaveWallet.getActiveAddress();
    console.log('3. Active address:', address);
    
    // Get balance
    const balance = await getWalletBalance(address);
    console.log('4. Balance:', balance);
    
    // Test small transaction creation
    const testData = 'Hello RATi! This is a test transaction.';
    const dataSize = getTransactionSize(testData);
    console.log('5. Test data size:', dataSize, 'bytes');
    console.log('6. Qualifies for free:', isSmallTransaction(dataSize));
    
    // Create test transaction
    const testTx = await arweave.createTransaction({ data: testData });
    testTx.addTag('App-Name', 'RATi-Test');
    testTx.addTag('Type', 'debug-test');
    
    console.log('7. Test transaction created:', {
      id: testTx.id,
      dataSize: testTx.data_size,
      owner: testTx.owner
    });
    
    console.log('✅ ArConnect debug completed - check console for details');
    
  } catch (error) {
    console.error('❌ ArConnect debug failed:', error);
  }
}

// Make debug function available globally for testing
if (typeof window !== 'undefined') {
  window.debugArConnect = debugArConnect;
}
