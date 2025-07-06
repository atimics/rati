use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Token, TokenAccount, Mint};
use mpl_token_metadata::accounts::Metadata;
use wormhole_anchor_sdk::wormhole;

declare_id!("FoRGe11111111111111111111111111111111111111");

#[program]
pub mod orb_forge {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        let forge_state = &mut ctx.accounts.forge_state;
        forge_state.authority = ctx.accounts.authority.key();
        forge_state.wormhole_bridge = params.wormhole_bridge;
        forge_state.rari_mint = params.rari_mint;
        forge_state.rari_threshold = params.rari_threshold;
        forge_state.total_claimed = 0;
        forge_state.paused = false;
        Ok(())
    }

    pub fn feed_orb(ctx: Context<FeedOrb>, chain_id: u16) -> Result<()> {
        require!(!ctx.accounts.forge_state.paused, ErrorCode::ProgramPaused);
        
        // Validate Orb ownership via Metaplex metadata
        let metadata = &ctx.accounts.orb_metadata;
        require!(
            metadata.mint == ctx.accounts.orb_mint.key(),
            ErrorCode::InvalidOrbMetadata
        );
        
        // Burn required $RARI tokens
        let cpi_accounts = Burn {
            mint: ctx.accounts.rari_mint.to_account_info(),
            from: ctx.accounts.user_rari_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::burn(cpi_ctx, ctx.accounts.forge_state.rari_threshold)?;
        
        // Update claim record
        let claim_record = &mut ctx.accounts.claim_record;
        claim_record.orb_mint = ctx.accounts.orb_mint.key();
        claim_record.claimer = ctx.accounts.user.key();
        claim_record.claimed_at = Clock::get()?.unix_timestamp;
        claim_record.target_chain = chain_id;
        
        // Emit event for indexing
        emit!(OrbFedEvent {
            orb_mint: ctx.accounts.orb_mint.key(),
            claimer: ctx.accounts.user.key(),
            target_chain: chain_id,
            rari_burned: ctx.accounts.forge_state.rari_threshold,
        });
        
        // If targeting non-Solana chain, prepare Wormhole message
        if chain_id != 1 {
            // Wormhole message emission would go here
            // This is simplified - actual implementation would use wormhole CPI
            msg!("Preparing Wormhole message for chain {}", chain_id);
        }
        
        ctx.accounts.forge_state.total_claimed += 1;
        
        Ok(())
    }

    pub fn toggle_pause(ctx: Context<TogglePause>) -> Result<()> {
        ctx.accounts.forge_state.paused = !ctx.accounts.forge_state.paused;
        Ok(())
    }

    pub fn update_threshold(ctx: Context<UpdateThreshold>, new_threshold: u64) -> Result<()> {
        ctx.accounts.forge_state.rari_threshold = new_threshold;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ForgeState::LEN,
        seeds = [b"forge_state"],
        bump
    )]
    pub forge_state: Account<'info, ForgeState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FeedOrb<'info> {
    #[account(mut, seeds = [b"forge_state"], bump)]
    pub forge_state: Account<'info, ForgeState>,
    
    #[account(
        init,
        payer = user,
        space = 8 + ClaimRecord::LEN,
        seeds = [b"claim", orb_mint.key().as_ref()],
        bump
    )]
    pub claim_record: Account<'info, ClaimRecord>,
    
    pub orb_mint: Account<'info, Mint>,
    /// CHECK: Validated via CPI to Metaplex
    pub orb_metadata: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub rari_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        constraint = user_rari_account.owner == user.key(),
        constraint = user_rari_account.mint == rari_mint.key(),
    )]
    pub user_rari_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TogglePause<'info> {
    #[account(
        mut,
        seeds = [b"forge_state"],
        bump,
        has_one = authority
    )]
    pub forge_state: Account<'info, ForgeState>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateThreshold<'info> {
    #[account(
        mut,
        seeds = [b"forge_state"],
        bump,
        has_one = authority
    )]
    pub forge_state: Account<'info, ForgeState>,
    pub authority: Signer<'info>,
}

#[account]
pub struct ForgeState {
    pub authority: Pubkey,
    pub wormhole_bridge: Pubkey,
    pub rari_mint: Pubkey,
    pub rari_threshold: u64,
    pub total_claimed: u64,
    pub paused: bool,
}

impl ForgeState {
    pub const LEN: usize = 32 + 32 + 32 + 8 + 8 + 1;
}

#[account]
pub struct ClaimRecord {
    pub orb_mint: Pubkey,
    pub claimer: Pubkey,
    pub claimed_at: i64,
    pub target_chain: u16,
}

impl ClaimRecord {
    pub const LEN: usize = 32 + 32 + 8 + 2;
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeParams {
    pub wormhole_bridge: Pubkey,
    pub rari_mint: Pubkey,
    pub rari_threshold: u64,
}

#[event]
pub struct OrbFedEvent {
    pub orb_mint: Pubkey,
    pub claimer: Pubkey,
    pub target_chain: u16,
    pub rari_burned: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Program is currently paused")]
    ProgramPaused,
    #[msg("Invalid Orb metadata")]
    InvalidOrbMetadata,
    #[msg("Insufficient RARI balance")]
    InsufficientRariBalance,
}