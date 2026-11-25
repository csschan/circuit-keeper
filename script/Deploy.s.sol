// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {JobRegistry}     from "../src/JobRegistry.sol";

/// @title Deploy
/// @notice Deploys JobRegistry (which internally deploys InputResolver + all adapters)
///
/// Usage:
///   forge script script/Deploy.s.sol \
///     --rpc-url https://rpc.xlayer.tech \
///     --private-key $DEPLOYER_KEY \
///     --broadcast \
///     --verify \
///     --verifier blockscout \
///     --verifier-url https://xlayerscan.io/api
contract Deploy is Script {
    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");

        console.log("Deploying Circuit Keeper contracts...");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerKey);

        JobRegistry registry = new JobRegistry(deployer);

        vm.stopBroadcast();

        // ─── Log deployed addresses ───────────────────────────────────────────

        console.log("=== Deployed Addresses ===");
        console.log("JobRegistry:     ", address(registry));
        console.log("InputResolver:   ", address(registry.resolver()));

        // Adapters are deployed inside InputResolver constructor
        // Read them back for verification
        console.log("");
        console.log("Copy these into keeper/.env:");
        console.log("REGISTRY_ADDRESS=", address(registry));
    }
}
