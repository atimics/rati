import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { OrbForge } from "../target/types/orb_forge";
import { 
  PublicKey, 
  Keypair, 
  LAMPORTS_PER_SOL,
  SystemProgram,
  SYSVAR_RENT_PUBKEY 
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";

describe("orb_forge", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.OrbForge as Program<OrbForge>;
  const authority = provider.wallet.publicKey;
  
  let rariMint: PublicKey;
  let orbMint: PublicKey;
  let userRariAccount: PublicKey;
  let forgeState: PublicKey;

  before(async () => {
    // Create RARI token mint
    rariMint = await createMint(
      provider.connection,
      provider.wallet.payer,
      authority,
      null,
      9 // 9 decimals for RARI
    );

    // Create Orb NFT mint
    orbMint = await createMint(
      provider.connection,
      provider.wallet.payer,
      authority,
      null,
      0 // NFT has 0 decimals
    );

    // Create user RARI token account
    userRariAccount = await createAccount(
      provider.connection,
      provider.wallet.payer,
      rariMint,
      authority
    );

    // Mint RARI tokens to user
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      rariMint,
      userRariAccount,
      authority,
      1000 * LAMPORTS_PER_SOL // 1000 RARI tokens
    );

    // Derive forge state PDA
    [forgeState] = PublicKey.findProgramAddressSync(
      [Buffer.from("forge_state")],
      program.programId
    );
  });

  it("Initializes the forge state", async () => {
    const wormholeBridge = new PublicKey("Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o");
    const rariThreshold = new anchor.BN(100 * LAMPORTS_PER_SOL); // 100 RARI

    await program.methods
      .initialize({
        wormholeBridge,
        rariMint,
        rariThreshold,
      })
      .accounts({
        forgeState,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const forgeStateAccount = await program.account.forgeState.fetch(forgeState);
    
    expect(forgeStateAccount.authority.toBase58()).to.equal(authority.toBase58());
    expect(forgeStateAccount.rariMint.toBase58()).to.equal(rariMint.toBase58());
    expect(forgeStateAccount.rariThreshold.toNumber()).to.equal(rariThreshold.toNumber());
    expect(forgeStateAccount.totalClaimed.toNumber()).to.equal(0);
    expect(forgeStateAccount.paused).to.be.false;
  });

  it("Feeds an orb for same-chain minting", async () => {
    const chainId = 1; // Solana chain ID
    
    // Derive claim record PDA
    const [claimRecord] = PublicKey.findProgramAddressSync(
      [Buffer.from("claim"), orbMint.toBuffer()],
      program.programId
    );

    // Mock Orb metadata account (in production, this would be from Metaplex)
    const [orbMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
        orbMint.toBuffer(),
      ],
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
    );

    // Get initial RARI balance
    const initialBalance = await getAccount(provider.connection, userRariAccount);
    
    await program.methods
      .feedOrb(chainId)
      .accounts({
        forgeState,
        claimRecord,
        orbMint,
        orbMetadata,
        rariMint,
        userRariAccount,
        user: authority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Verify claim record was created
    const claimRecordAccount = await program.account.claimRecord.fetch(claimRecord);
    expect(claimRecordAccount.orbMint.toBase58()).to.equal(orbMint.toBase58());
    expect(claimRecordAccount.claimer.toBase58()).to.equal(authority.toBase58());
    expect(claimRecordAccount.targetChain).to.equal(chainId);

    // Verify RARI tokens were burned
    const finalBalance = await getAccount(provider.connection, userRariAccount);
    const burnedAmount = Number(initialBalance.amount) - Number(finalBalance.amount);
    expect(burnedAmount).to.equal(100 * LAMPORTS_PER_SOL);

    // Verify forge state was updated
    const forgeStateAccount = await program.account.forgeState.fetch(forgeState);
    expect(forgeStateAccount.totalClaimed.toNumber()).to.equal(1);
  });

  it("Feeds an orb for cross-chain minting", async () => {
    const chainId = 8453; // Base chain ID
    
    // Create another orb for testing
    const orbMint2 = await createMint(
      provider.connection,
      provider.wallet.payer,
      authority,
      null,
      0
    );

    const [claimRecord2] = PublicKey.findProgramAddressSync(
      [Buffer.from("claim"), orbMint2.toBuffer()],
      program.programId
    );

    const [orbMetadata2] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
        orbMint2.toBuffer(),
      ],
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
    );

    await program.methods
      .feedOrb(chainId)
      .accounts({
        forgeState,
        claimRecord: claimRecord2,
        orbMint: orbMint2,
        orbMetadata: orbMetadata2,
        rariMint,
        userRariAccount,
        user: authority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const claimRecordAccount = await program.account.claimRecord.fetch(claimRecord2);
    expect(claimRecordAccount.targetChain).to.equal(chainId);

    // Verify total claimed count increased
    const forgeStateAccount = await program.account.forgeState.fetch(forgeState);
    expect(forgeStateAccount.totalClaimed.toNumber()).to.equal(2);
  });

  it("Fails when user has insufficient RARI balance", async () => {
    // Create a user with insufficient RARI
    const poorUser = Keypair.generate();
    
    // Airdrop SOL for transaction fees
    await provider.connection.requestAirdrop(poorUser.publicKey, LAMPORTS_PER_SOL);
    
    const poorUserRariAccount = await createAccount(
      provider.connection,
      provider.wallet.payer,
      rariMint,
      poorUser.publicKey
    );

    // Mint only 50 RARI (less than threshold of 100)
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      rariMint,
      poorUserRariAccount,
      authority,
      50 * LAMPORTS_PER_SOL
    );

    const orbMint3 = await createMint(
      provider.connection,
      provider.wallet.payer,
      authority,
      null,
      0
    );

    const [claimRecord3] = PublicKey.findProgramAddressSync(
      [Buffer.from("claim"), orbMint3.toBuffer()],
      program.programId
    );

    const [orbMetadata3] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
        orbMint3.toBuffer(),
      ],
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
    );

    try {
      await program.methods
        .feedOrb(1)
        .accounts({
          forgeState,
          claimRecord: claimRecord3,
          orbMint: orbMint3,
          orbMetadata: orbMetadata3,
          rariMint,
          userRariAccount: poorUserRariAccount,
          user: poorUser.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([poorUser])
        .rpc();
      
      expect.fail("Should have failed with insufficient balance");
    } catch (error) {
      expect(error.message).to.include("insufficient");
    }
  });

  it("Allows authority to toggle pause", async () => {
    await program.methods
      .togglePause()
      .accounts({
        forgeState,
        authority,
      })
      .rpc();

    let forgeStateAccount = await program.account.forgeState.fetch(forgeState);
    expect(forgeStateAccount.paused).to.be.true;

    // Try to feed orb while paused (should fail)
    const orbMint4 = await createMint(
      provider.connection,
      provider.wallet.payer,
      authority,
      null,
      0
    );

    try {
      await program.methods
        .feedOrb(1)
        .accounts({
          forgeState,
          claimRecord: PublicKey.findProgramAddressSync(
            [Buffer.from("claim"), orbMint4.toBuffer()],
            program.programId
          )[0],
          orbMint: orbMint4,
          orbMetadata: PublicKey.findProgramAddressSync(
            [
              Buffer.from("metadata"),
              new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
              orbMint4.toBuffer(),
            ],
            new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
          )[0],
          rariMint,
          userRariAccount,
          user: authority,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      expect.fail("Should have failed while paused");
    } catch (error) {
      expect(error.message).to.include("paused");
    }

    // Unpause
    await program.methods
      .togglePause()
      .accounts({
        forgeState,
        authority,
      })
      .rpc();

    forgeStateAccount = await program.account.forgeState.fetch(forgeState);
    expect(forgeStateAccount.paused).to.be.false;
  });

  it("Allows authority to update threshold", async () => {
    const newThreshold = new anchor.BN(200 * LAMPORTS_PER_SOL); // 200 RARI

    await program.methods
      .updateThreshold(newThreshold)
      .accounts({
        forgeState,
        authority,
      })
      .rpc();

    const forgeStateAccount = await program.account.forgeState.fetch(forgeState);
    expect(forgeStateAccount.rariThreshold.toNumber()).to.equal(newThreshold.toNumber());
  });

  it("Fails when non-authority tries to pause", async () => {
    const nonAuthority = Keypair.generate();
    
    try {
      await program.methods
        .togglePause()
        .accounts({
          forgeState,
          authority: nonAuthority.publicKey,
        })
        .signers([nonAuthority])
        .rpc();
      
      expect.fail("Should have failed with unauthorized access");
    } catch (error) {
      expect(error.message).to.include("constraint");
    }
  });
});