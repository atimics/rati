// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/AgentReceiver.sol";

contract DeployAgentReceiver is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        // Base mainnet Wormhole core bridge
        address wormholeBridge = 0x8d2de8d2f73F1F4cAB472AC9A881C9b123C79627;
        
        // OrbForge program ID on Solana (placeholder - update with actual)
        bytes32 solanaEmitter = bytes32(uint256(0xFoRGe11111111111111111111111111111111111111));
        
        // Merkle root (placeholder - update with actual from script 3)
        bytes32 merkleRoot = bytes32(0);
        
        // Total agents (8888 as per spec)
        uint256 totalAgents = 8888;

        AgentReceiver receiver = new AgentReceiver(
            wormholeBridge,
            solanaEmitter,
            merkleRoot,
            totalAgents,
            deployer
        );

        console.log("AgentReceiver deployed to:", address(receiver));
        console.log("Wormhole Bridge:", wormholeBridge);
        console.log("Solana Emitter:", vm.toString(solanaEmitter));
        console.log("Merkle Root:", vm.toString(merkleRoot));
        console.log("Total Agents:", totalAgents);

        vm.stopBroadcast();
    }
}