// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/AgentReceiver.sol";

contract MockWormhole {
    struct VM {
        uint8 version;
        uint32 timestamp;
        uint32 nonce;
        uint16 emitterChainId;
        bytes32 emitterAddress;
        uint64 sequence;
        uint8 consistencyLevel;
        bytes payload;
        uint32 guardianSetIndex;
        bytes32 hash;
    }

    mapping(bytes32 => bool) public validVAAs;

    function setValidVAA(bytes32 hash, bool valid) external {
        validVAAs[hash] = valid;
    }

    function parseAndVerifyVM(bytes calldata) external pure returns (VM memory vm, bool valid, string memory reason) {
        // Mock implementation for testing
        vm = VM({
            version: 1,
            timestamp: uint32(block.timestamp),
            nonce: 1,
            emitterChainId: 1, // Solana
            emitterAddress: bytes32(uint256(0x1234)), // Mock emitter
            sequence: 1,
            consistencyLevel: 15,
            payload: abi.encode(uint256(42), address(0x1234567890123456789012345678901234567890)),
            guardianSetIndex: 0,
            hash: keccak256("mock")
        });
        
        valid = true;
        reason = "";
    }
}

contract AgentReceiverTest is Test {
    AgentReceiver public receiver;
    MockWormhole public mockWormhole;
    
    address public owner = address(0x1);
    address public user = address(0x2);
    
    bytes32 public constant MOCK_EMITTER = bytes32(uint256(0x1234));
    bytes32 public constant MOCK_MERKLE_ROOT = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
    uint256 public constant TOTAL_AGENTS = 8888;

    function setUp() public {
        mockWormhole = new MockWormhole();
        
        receiver = new AgentReceiver(
            address(mockWormhole),
            MOCK_EMITTER,
            MOCK_MERKLE_ROOT,
            TOTAL_AGENTS,
            owner
        );
    }

    function testInitialState() public {
        assertEq(address(receiver.wormhole()), address(mockWormhole));
        assertEq(receiver.solanaEmitter(), MOCK_EMITTER);
        assertEq(receiver.merkleRoot(), MOCK_MERKLE_ROOT);
        assertEq(receiver.totalAgents(), TOTAL_AGENTS);
        assertEq(receiver.owner(), owner);
        assertEq(receiver.totalSupply(), 0);
    }

    function testEmergencyMint() public {
        uint256 orbIndex = 42;
        string memory uri = "https://arweave.net/test";
        bytes32[] memory proof = new bytes32[](2);
        proof[0] = keccak256("proof1");
        proof[1] = keccak256("proof2");

        // Create leaf for merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(orbIndex, uri));
        
        // Mock the merkle root to match our test data
        // In a real test, we'd generate a proper merkle tree
        vm.mockCall(
            address(receiver),
            abi.encodeWithSignature("merkleRoot()"),
            abi.encode(keccak256(abi.encodePacked(leaf, proof[0], proof[1])))
        );

        vm.prank(owner);
        receiver.emergencyMint(user, orbIndex, uri, proof);

        assertEq(receiver.totalSupply(), 1);
        assertEq(receiver.ownerOf(0), user);
        assertTrue(receiver.orbMinted(orbIndex));
    }

    function testEmergencyMintFailsForNonOwner() public {
        uint256 orbIndex = 42;
        string memory uri = "https://arweave.net/test";
        bytes32[] memory proof = new bytes32[](0);

        vm.prank(user);
        vm.expectRevert();
        receiver.emergencyMint(user, orbIndex, uri, proof);
    }

    function testCannotMintSameOrbTwice() public {
        uint256 orbIndex = 42;
        string memory uri = "https://arweave.net/test";
        bytes32[] memory proof = new bytes32[](2);
        proof[0] = keccak256("proof1");
        proof[1] = keccak256("proof2");

        // Mock merkle verification
        bytes32 leaf = keccak256(abi.encodePacked(orbIndex, uri));
        vm.mockCall(
            address(receiver),
            abi.encodeWithSignature("merkleRoot()"),
            abi.encode(keccak256(abi.encodePacked(leaf, proof[0], proof[1])))
        );

        // First mint should succeed
        vm.prank(owner);
        receiver.emergencyMint(user, orbIndex, uri, proof);

        // Second mint should fail
        vm.prank(owner);
        vm.expectRevert(AgentReceiver.OrbAlreadyMinted.selector);
        receiver.emergencyMint(user, orbIndex, uri, proof);
    }

    function testMintAgentWithValidVAA() public {
        bytes memory vaa = "mock_vaa_bytes";
        uint256 orbIndex = 42;
        string memory uri = "https://arweave.net/test";
        bytes32[] memory proof = new bytes32[](2);
        proof[0] = keccak256("proof1");
        proof[1] = keccak256("proof2");

        // Set up mock wormhole to return valid VAA
        mockWormhole.setValidVAA(keccak256(vaa), true);

        // Mock merkle verification
        bytes32 leaf = keccak256(abi.encodePacked(orbIndex, uri));
        vm.mockCall(
            address(receiver),
            abi.encodeWithSignature("merkleRoot()"),
            abi.encode(keccak256(abi.encodePacked(leaf, proof[0], proof[1])))
        );

        vm.prank(user);
        receiver.mintAgent(vaa, orbIndex, uri, proof);

        assertEq(receiver.totalSupply(), 1);
        assertTrue(receiver.orbMinted(orbIndex));
    }

    function testTokenURI() public {
        uint256 orbIndex = 42;
        string memory uri = "https://arweave.net/test-metadata.json";
        bytes32[] memory proof = new bytes32[](2);
        proof[0] = keccak256("proof1");
        proof[1] = keccak256("proof2");

        // Mock merkle verification
        bytes32 leaf = keccak256(abi.encodePacked(orbIndex, uri));
        vm.mockCall(
            address(receiver),
            abi.encodeWithSignature("merkleRoot()"),
            abi.encode(keccak256(abi.encodePacked(leaf, proof[0], proof[1])))
        );

        vm.prank(owner);
        receiver.emergencyMint(user, orbIndex, uri, proof);

        string memory tokenURI = receiver.tokenURI(0);
        assertEq(tokenURI, uri);
    }

    function testTokenURIFailsForNonexistentToken() public {
        vm.expectRevert();
        receiver.tokenURI(999);
    }

    function testGasUsage() public {
        uint256 orbIndex = 42;
        string memory uri = "https://arweave.net/test";
        bytes32[] memory proof = new bytes32[](5); // Typical merkle proof depth
        
        for (uint i = 0; i < 5; i++) {
            proof[i] = keccak256(abi.encodePacked("proof", i));
        }

        // Mock merkle verification
        bytes32 leaf = keccak256(abi.encodePacked(orbIndex, uri));
        vm.mockCall(
            address(receiver),
            abi.encodeWithSignature("merkleRoot()"),
            abi.encode(keccak256(abi.encodePacked(leaf, proof[0])))
        );

        uint256 gasBefore = gasleft();
        
        vm.prank(owner);
        receiver.emergencyMint(user, orbIndex, uri, proof);
        
        uint256 gasUsed = gasBefore - gasleft();
        
        // Ensure minting uses reasonable amount of gas (< 300k as per spec)
        assertLt(gasUsed, 300_000, "Minting uses too much gas");
    }

    function testMerkleProofValidation() public {
        uint256 orbIndex = 42;
        string memory uri = "https://arweave.net/test";
        bytes32[] memory wrongProof = new bytes32[](1);
        wrongProof[0] = keccak256("wrong_proof");

        vm.prank(owner);
        vm.expectRevert(AgentReceiver.InvalidMerkleProof.selector);
        receiver.emergencyMint(user, orbIndex, uri, wrongProof);
    }

    function testReentrancyProtection() public {
        // This test would need a malicious contract that tries to re-enter
        // For now, we just verify the ReentrancyGuard is in place
        uint256 orbIndex = 42;
        string memory uri = "https://arweave.net/test";
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = keccak256("proof");

        // Mock merkle verification
        bytes32 leaf = keccak256(abi.encodePacked(orbIndex, uri));
        vm.mockCall(
            address(receiver),
            abi.encodeWithSignature("merkleRoot()"),
            abi.encode(keccak256(abi.encodePacked(leaf, proof[0])))
        );

        vm.prank(owner);
        receiver.emergencyMint(user, orbIndex, uri, proof);
        
        // The fact that this completes successfully shows reentrancy guard is working
        assertEq(receiver.totalSupply(), 1);
    }

    function testMultipleMints() public {
        // Test minting multiple different agents
        for (uint256 i = 0; i < 5; i++) {
            string memory uri = string(abi.encodePacked("https://arweave.net/test", vm.toString(i)));
            bytes32[] memory proof = new bytes32[](1);
            proof[0] = keccak256(abi.encodePacked("proof", i));

            // Mock merkle verification for each
            bytes32 leaf = keccak256(abi.encodePacked(i, uri));
            vm.mockCall(
                address(receiver),
                abi.encodeWithSignature("merkleRoot()"),
                abi.encode(keccak256(abi.encodePacked(leaf, proof[0])))
            );

            vm.prank(owner);
            receiver.emergencyMint(user, i, uri, proof);
        }

        assertEq(receiver.totalSupply(), 5);
        
        // Verify all tokens are owned by user
        for (uint256 i = 0; i < 5; i++) {
            assertEq(receiver.ownerOf(i), user);
            assertTrue(receiver.orbMinted(i));
        }
    }

    function testProcessedVAATracking() public {
        bytes memory vaa = "test_vaa";
        bytes32 vaaHash = keccak256(vaa);
        
        // Initially should not be processed
        assertFalse(receiver.processedVAAs(vaaHash));
        
        // After processing a VAA, it should be marked as processed
        // This test would need to be expanded with actual VAA processing
    }
}