import { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress,
  createBurnInstruction,
} from '@solana/spl-token';
import type { SendTransactionOptions } from '@solana/wallet-adapter-base';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import type { TransactionResult } from '../types';
import { config, RARI_THRESHOLD } from '../config';
import { getAgentData } from './agents';

// IDL for OrbForge program (simplified)
const ORB_FORGE_IDL = {
  version: "0.1.0",
  name: "orb_forge",
  instructions: [
    {
      name: "feedOrb",
      accounts: [
        { name: "forgeState", isMut: true, isSigner: false },
        { name: "claimRecord", isMut: true, isSigner: false },
        { name: "orbMint", isMut: false, isSigner: false },
        { name: "orbMetadata", isMut: false, isSigner: false },
        { name: "rariMint", isMut: true, isSigner: false },
        { name: "userRariAccount", isMut: true, isSigner: false },
        { name: "user", isMut: true, isSigner: true },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "chainId", type: "u16" }],
    },
  ],
};

interface MintAgentSolanaParams {
  orbId: string;
  userPublicKey: PublicKey;
  sendTransaction: (
    transaction: Transaction,
    connection: Connection,
    options?: SendTransactionOptions
  ) => Promise<string>;
}

export async function mintAgentSolana({
  orbId,
  userPublicKey,
  sendTransaction,
}: MintAgentSolanaParams): Promise<TransactionResult> {
  try {
    const connection = new Connection(config.chains.solana.rpcUrl, 'confirmed');
    
    // Convert orbId to mint public key
    const orbMint = new PublicKey(orbId);
    const rariMint = new PublicKey(config.contracts.solana.rariMint);
    const orbForgeProgram = new PublicKey(config.contracts.solana.orbForge);
    
    // Derive PDAs
    const [forgeState] = PublicKey.findProgramAddressSync(
      [Buffer.from('forge_state')],
      orbForgeProgram
    );
    
    const [claimRecord] = PublicKey.findProgramAddressSync(
      [Buffer.from('claim'), orbMint.toBuffer()],
      orbForgeProgram
    );
    
    // Get user's RARI token account
    const userRariAccount = await getAssociatedTokenAddress(
      rariMint,
      userPublicKey
    );
    
    // Check RARI balance
    const rariBalance = await connection.getTokenAccountBalance(userRariAccount);
    const balanceAmount = rariBalance.value.uiAmount || 0;
    
    if (balanceAmount < RARI_THRESHOLD) {
      throw new Error(`Insufficient RARI balance. Required: ${RARI_THRESHOLD}, Available: ${balanceAmount}`);
    }
    
    // Get Orb metadata account (Metaplex standard)
    const [orbMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
        orbMint.toBuffer(),
      ],
      new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s') // Metaplex program
    );
    
    // Create instruction data
    const chainId = 1; // Solana chain ID (same-chain minting)
    const instructionData = Buffer.alloc(3);
    instructionData.writeUInt8(0, 0); // feedOrb instruction discriminator
    instructionData.writeUInt16LE(chainId, 1);
    
    // Create feed orb instruction
    const feedOrbInstruction = new TransactionInstruction({
      keys: [
        { pubkey: forgeState, isSigner: false, isWritable: true },
        { pubkey: claimRecord, isSigner: false, isWritable: true },
        { pubkey: orbMint, isSigner: false, isWritable: false },
        { pubkey: orbMetadata, isSigner: false, isWritable: false },
        { pubkey: rariMint, isSigner: false, isWritable: true },
        { pubkey: userRariAccount, isSigner: false, isWritable: true },
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: orbForgeProgram,
      data: instructionData,
    });
    
    // Create transaction
    const transaction = new Transaction();
    transaction.add(feedOrbInstruction);
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;
    
    // Send transaction
    const signature = await sendTransaction(transaction, connection, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    
    // Get agent data
    const agentData = await getAgentData(parseInt(orbId));
    
    return {
      success: true,
      txHash: signature,
      agentData,
    };
  } catch (error) {
    console.error('Solana minting error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getRariBalance(
  userPublicKey: PublicKey
): Promise<number> {
  try {
    const connection = new Connection(config.chains.solana.rpcUrl, 'confirmed');
    const rariMint = new PublicKey(config.contracts.solana.rariMint);
    
    const userRariAccount = await getAssociatedTokenAddress(
      rariMint,
      userPublicKey
    );
    
    const balance = await connection.getTokenAccountBalance(userRariAccount);
    return balance.value.uiAmount || 0;
  } catch (error) {
    console.error('Error getting RARI balance:', error);
    return 0;
  }
}

export async function getUserOrbs(
  userPublicKey: PublicKey
): Promise<Array<{ mint: string; metadata: any }>> {
  try {
    const connection = new Connection(config.chains.solana.rpcUrl, 'confirmed');
    
    // Get all token accounts for the user
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      userPublicKey,
      { programId: TOKEN_PROGRAM_ID }
    );
    
    const orbs = [];
    
    for (const { account } of tokenAccounts.value) {
      const parsedInfo = account.data.parsed.info;
      
      // Check if this is an NFT (amount = 1, decimals = 0)
      if (parsedInfo.tokenAmount.amount === '1' && parsedInfo.tokenAmount.decimals === 0) {
        const mint = parsedInfo.mint;
        
        try {
          // Fetch metadata for this NFT
          const [metadataAddress] = PublicKey.findProgramAddressSync(
            [
              Buffer.from('metadata'),
              new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
              new PublicKey(mint).toBuffer(),
            ],
            new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
          );
          
          const metadataAccount = await connection.getAccountInfo(metadataAddress);
          if (metadataAccount) {
            // Parse metadata (simplified - in production, use Metaplex SDK)
            orbs.push({
              mint,
              metadata: {
                name: `Orb #${mint.slice(-4)}`,
                image: `https://api.orbs.com/image/${mint}`,
                // Add more metadata parsing as needed
              },
            });
          }
        } catch (error) {
          console.warn(`Failed to get metadata for ${mint}:`, error);
        }
      }
    }
    
    return orbs;
  } catch (error) {
    console.error('Error getting user orbs:', error);
    return [];
  }
}