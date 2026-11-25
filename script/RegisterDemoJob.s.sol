// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {JobRegistry}     from "../src/JobRegistry.sol";
import {IJobRegistry}    from "../src/interfaces/IJobRegistry.sol";

/// @title RegisterDemoJob
/// @notice Registers a demo Job: fires every 10 minutes (timestamp mod trigger)
///         Calls a dummy no-op on the registry itself just to demonstrate.
///
/// Requires:
///   REGISTRY_ADDRESS  — deployed JobRegistry
///   DEPLOYER_KEY      — private key of job owner
///   CIRCUIT_PROCESSOR — TapeOut processor address
///   CIRCUIT_ID        — circuit ID to use as condition
///
/// Usage:
///   forge script script/RegisterDemoJob.s.sol \
///     --rpc-url https://rpc.xlayer.tech \
///     --private-key $DEPLOYER_KEY \
///     --broadcast
contract RegisterDemoJob is Script {
    function run() external {
        address registryAddr  = vm.envAddress("REGISTRY_ADDRESS");
        uint256 deployerKey   = vm.envUint("DEPLOYER_KEY");
        address processor     = vm.envAddress("CIRCUIT_PROCESSOR");
        uint256 circuitId     = vm.envUint("CIRCUIT_ID");

        JobRegistry registry = JobRegistry(payable(registryAddr));

        // ─── Build a 1-pin TIMESTAMP_MOD input ───────────────────────────────
        // Fires within a 60-second window every 10 minutes
        IJobRegistry.InputSource[] memory inputs = new IJobRegistry.InputSource[](1);
        inputs[0] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.TIMESTAMP_MOD,
            target:    address(0),
            threshold: 10 minutes,          // period
            data:      abi.encode(uint256(60), true)  // window=60s, modulo mode
        });

        // ─── Target: call registry.getActiveJobs() as a no-op demo ────────────
        // In production this would be a DEX swap, repay, DAO execution, etc.
        bytes memory callData = abi.encodeWithSelector(
            JobRegistry.getActiveJobs.selector
        );

        vm.startBroadcast(deployerKey);

        uint256 jobId = registry.registerJob{value: 0.05 ether}(
            processor,
            circuitId,
            1,            // nIn
            0,            // outputPin
            inputs,
            registryAddr, // target (calling itself as demo)
            callData,
            200_000,      // gasLimit
            0.001 ether,  // feePerRun
            10 minutes    // cooldown
        );

        vm.stopBroadcast();

        console.log("Demo Job registered:");
        console.log("  Job ID:    ", jobId);
        console.log("  Processor: ", processor);
        console.log("  Circuit:   ", circuitId);
        console.log("  Cooldown:  10 minutes");
        console.log("  Budget:    0.05 OKB (~50 runs)");
    }
}
