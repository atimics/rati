// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "wormhole-solidity-sdk/interfaces/IWormhole.sol";

/**
 * @title AgentReceiver
 * @notice Receives Wormhole messages from Solana OrbForge and mints Agent NFTs
 * @dev Implements secure cross-chain minting with Merkle proof validation
 */
contract AgentReceiver is ERC721, Ownable, ReentrancyGuard {
    /// @notice Wormhole core bridge contract
    IWormhole public immutable wormhole;
    
    /// @notice Solana chain ID in Wormhole
    uint16 public constant SOLANA_CHAIN_ID = 1;
    
    /// @notice OrbForge program address on Solana (emitter)
    bytes32 public immutable solanaEmitter;
    
    /// @notice Merkle root of all valid (orbIndex, uri) pairs
    bytes32 public immutable merkleRoot;
    
    /// @notice Total number of possible agents
    uint256 public immutable totalAgents;
    
    /// @notice Mapping of processed VAA hashes to prevent replay
    mapping(bytes32 => bool) public processedVAAs;
    
    /// @notice Mapping of orb indices to minted status
    mapping(uint256 => bool) public orbMinted;
    
    /// @notice Current token ID counter
    uint256 private _tokenIdCounter;

    /// @notice Emitted when an Agent NFT is minted
    event AgentMinted(
        uint256 indexed tokenId,
        address indexed to,
        uint256 indexed orbIndex,
        string uri,
        bytes32 vaaHash
    );

    /// @notice Emitted when a VAA is processed
    event VAAProcessed(bytes32 indexed vaaHash, uint256 orbIndex);

    error InvalidVAA();
    error VAAAlreadyProcessed();
    error InvalidChainId();
    error InvalidEmitter();
    error InvalidMerkleProof();
    error OrbAlreadyMinted();
    error InvalidOrbIndex();

    /**
     * @notice Initialize the AgentReceiver contract
     * @param _wormhole Address of the Wormhole core bridge
     * @param _solanaEmitter OrbForge program address on Solana
     * @param _merkleRoot Merkle root of valid agent metadata
     * @param _totalAgents Total number of possible agents
     * @param _initialOwner Initial contract owner
     */
    constructor(
        address _wormhole,
        bytes32 _solanaEmitter,
        bytes32 _merkleRoot,
        uint256 _totalAgents,
        address _initialOwner
    ) ERC721("Agent NFT", "AGENT") Ownable(_initialOwner) {
        wormhole = IWormhole(_wormhole);
        solanaEmitter = _solanaEmitter;
        merkleRoot = _merkleRoot;
        totalAgents = _totalAgents;
    }

    /**
     * @notice Mint an Agent NFT by providing a Wormhole VAA and Merkle proof
     * @param vaa The Wormhole VAA containing the mint instruction
     * @param orbIndex The index of the Orb being transformed
     * @param uri The metadata URI for the Agent NFT
     * @param merkleProof Merkle proof validating the (orbIndex, uri) pair
     */
    function mintAgent(
        bytes memory vaa,
        uint256 orbIndex,
        string memory uri,
        bytes32[] memory merkleProof
    ) external nonReentrant {
        // Parse and verify the VAA
        (IWormhole.VM memory vm, bool valid, string memory reason) = wormhole.parseAndVerifyVM(vaa);
        
        if (!valid) revert InvalidVAA();
        
        // Verify the VAA comes from Solana
        if (vm.emitterChainId != SOLANA_CHAIN_ID) revert InvalidChainId();
        
        // Verify the VAA comes from our OrbForge program
        if (vm.emitterAddress != solanaEmitter) revert InvalidEmitter();
        
        // Check if this VAA has already been processed
        bytes32 vaaHash = keccak256(vaa);
        if (processedVAAs[vaaHash]) revert VAAAlreadyProcessed();
        
        // Decode the payload to get orb information
        (uint256 vaaOrbIndex, address recipient) = abi.decode(vm.payload, (uint256, address));
        
        // Verify the orb index matches
        if (vaaOrbIndex != orbIndex) revert InvalidOrbIndex();
        
        // Verify orb hasn't been minted yet
        if (orbMinted[orbIndex]) revert OrbAlreadyMinted();
        
        // Verify the Merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(orbIndex, uri));
        if (!MerkleProof.verify(merkleProof, merkleRoot, leaf)) {
            revert InvalidMerkleProof();
        }
        
        // Mark VAA as processed and orb as minted
        processedVAAs[vaaHash] = true;
        orbMinted[orbIndex] = true;
        
        // Mint the NFT
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, uri);
        
        emit VAAProcessed(vaaHash, orbIndex);
        emit AgentMinted(tokenId, recipient, orbIndex, uri, vaaHash);
    }

    /**
     * @notice Emergency function to mint agents directly (owner only)
     * @param to Address to mint to
     * @param orbIndex Orb index
     * @param uri Metadata URI
     * @param merkleProof Merkle proof
     */
    function emergencyMint(
        address to,
        uint256 orbIndex,
        string memory uri,
        bytes32[] memory merkleProof
    ) external onlyOwner {
        if (orbMinted[orbIndex]) revert OrbAlreadyMinted();
        
        bytes32 leaf = keccak256(abi.encodePacked(orbIndex, uri));
        if (!MerkleProof.verify(merkleProof, merkleRoot, leaf)) {
            revert InvalidMerkleProof();
        }
        
        orbMinted[orbIndex] = true;
        
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        emit AgentMinted(tokenId, to, orbIndex, uri, bytes32(0));
    }

    /**
     * @notice Get the total number of minted tokens
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }

    /**
     * @notice Override tokenURI to support dynamic metadata
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        return super.tokenURI(tokenId);
    }

    // Storage for token URIs (if not using baseURI)
    mapping(uint256 => string) private _tokenURIs;

    /**
     * @notice Set token URI for a specific token
     */
    function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal {
        _tokenURIs[tokenId] = _tokenURI;
    }

    /**
     * @notice Override tokenURI to return stored URI
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        
        string memory _tokenURI = _tokenURIs[tokenId];
        
        // If there is no specific URI, return empty string
        if (bytes(_tokenURI).length == 0) {
            return "";
        }
        
        return _tokenURI;
    }
}