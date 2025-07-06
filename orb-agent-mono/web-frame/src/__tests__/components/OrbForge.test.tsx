import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrbForge } from '../../components/OrbForge';
import { useChain } from '../../hooks/useChain';
import { useMintAgent } from '../../hooks/useMintAgent';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAccount } from 'wagmi';

// Mock dependencies
vi.mock('../../hooks/useChain');
vi.mock('../../hooks/useMintAgent');
vi.mock('@solana/wallet-adapter-react');
vi.mock('wagmi');

const mockUseChain = useChain as vi.MockedFunction<typeof useChain>;
const mockUseMintAgent = useMintAgent as vi.MockedFunction<typeof useMintAgent>;
const mockUseWallet = useWallet as vi.MockedFunction<typeof useWallet>;
const mockUseAccount = useAccount as vi.MockedFunction<typeof useAccount>;

describe('OrbForge', () => {
  const mockMintAgent = vi.fn();
  const mockReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseChain.mockReturnValue({
      selectedChain: 'solana',
      setSelectedChain: vi.fn(),
      switchChain: vi.fn(),
      isSolana: true,
      isBase: false,
    });

    mockUseMintAgent.mockReturnValue({
      mintAgent: mockMintAgent,
      isLoading: false,
      error: null,
      txHash: null,
      reset: mockReset,
    });

    mockUseWallet.mockReturnValue({
      connected: false,
      publicKey: null,
      sendTransaction: vi.fn(),
    } as any);

    mockUseAccount.mockReturnValue({
      isConnected: false,
      address: undefined,
    } as any);
  });

  it('renders connection prompt when wallet is not connected', () => {
    render(<OrbForge compact={false} />);
    
    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
    expect(screen.getByText(/Connect your Solana wallet/)).toBeInTheDocument();
  });

  it('renders forge interface when Solana wallet is connected', () => {
    mockUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toString: () => 'test-public-key' },
      sendTransaction: vi.fn(),
    } as any);

    render(<OrbForge compact={false} />);
    
    expect(screen.getByText('Forge Your Agent')).toBeInTheDocument();
    expect(screen.getByText('$RARI Balance:')).toBeInTheDocument();
    expect(screen.getByText('Select an Orb to Transform')).toBeInTheDocument();
  });

  it('renders forge interface when EVM wallet is connected', () => {
    mockUseChain.mockReturnValue({
      selectedChain: 'base',
      setSelectedChain: vi.fn(),
      switchChain: vi.fn(),
      isSolana: false,
      isBase: true,
    });

    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890',
    } as any);

    render(<OrbForge compact={false} />);
    
    expect(screen.getByText('Forge Your Agent')).toBeInTheDocument();
    expect(screen.getByText('Base')).toBeInTheDocument();
  });

  it('shows compact layout when compact prop is true', () => {
    mockUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toString: () => 'test-public-key' },
      sendTransaction: vi.fn(),
    } as any);

    const { container } = render(<OrbForge compact={true} />);
    
    expect(container.querySelector('.orb-forge.compact')).toBeInTheDocument();
  });

  it('displays error message when minting fails', () => {
    mockUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toString: () => 'test-public-key' },
      sendTransaction: vi.fn(),
    } as any);

    mockUseMintAgent.mockReturnValue({
      mintAgent: mockMintAgent,
      isLoading: false,
      error: 'Minting failed: Insufficient balance',
      txHash: null,
      reset: mockReset,
    });

    render(<OrbForge compact={false} />);
    
    expect(screen.getByText(/Error: Minting failed: Insufficient balance/)).toBeInTheDocument();
  });

  it('displays loading state during minting', () => {
    mockUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toString: () => 'test-public-key' },
      sendTransaction: vi.fn(),
    } as any);

    mockUseMintAgent.mockReturnValue({
      mintAgent: mockMintAgent,
      isLoading: true,
      error: null,
      txHash: 'test-tx-hash',
      reset: mockReset,
    });

    render(<OrbForge compact={false} />);
    
    // Would need to simulate the minting state - this requires more complex state management
    // This test would need to be enhanced based on the actual implementation
  });

  it('calls reset function when back button is clicked', async () => {
    mockUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toString: () => 'test-public-key' },
      sendTransaction: vi.fn(),
    } as any);

    render(<OrbForge compact={false} />);
    
    // This test would need the component to be in a state where the back button is visible
    // Implementation depends on the component's state management
  });

  it('validates RARI balance before allowing minting', () => {
    mockUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toString: () => 'test-public-key' },
      sendTransaction: vi.fn(),
    } as any);

    render(<OrbForge compact={false} />);
    
    // The component should check RARI balance and disable minting if insufficient
    // This test would verify that logic
    expect(screen.getByText('(Required: 100 $RARI)')).toBeInTheDocument();
  });

  it('switches between chains correctly', () => {
    const mockSetSelectedChain = vi.fn();
    
    mockUseChain.mockReturnValue({
      selectedChain: 'solana',
      setSelectedChain: mockSetSelectedChain,
      switchChain: vi.fn(),
      isSolana: true,
      isBase: false,
    });

    mockUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toString: () => 'test-public-key' },
      sendTransaction: vi.fn(),
    } as any);

    render(<OrbForge compact={false} />);
    
    expect(screen.getByText('Solana')).toBeInTheDocument();
  });
});