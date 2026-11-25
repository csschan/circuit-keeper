// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {JobRegistry}     from "../src/JobRegistry.sol";
import {IJobRegistry}    from "../src/interfaces/IJobRegistry.sol";
import {MockProcessor}   from "../test/mocks/MockProcessor.sol";

/// @title DeployMockAndJob
/// @notice Testnet helper:
///         1. Deploys MockProcessor (since TapeOut only exists on Mainnet)
///         2. Configures circuit ID 1 to use TIMESTAMP_MOD echo mode
///         3. Cancels old Demo Job (if job ID provided)
///         4. Registers new Demo Job using MockProcessor
///
/// The circuit has 1 input (TIMESTAMP_MOD result) and echoes it as output bit 0.
/// So the job fires within a 60-second window every 2 minutes.
contract DeployMockAndJob is Script {
    function run() external {
        address registryAddr = vm.envAddress("REGISTRY_ADDRESS");
        uint256 deployerKey  = vm.envUint("DEPLOYER_KEY");

        JobRegistry registry = JobRegistry(payable(registryAddr));

        vm.startBroadcast(deployerKey);

        // ─── 1. Deploy MockProcessor ──────────────────────────────────────────
        MockProcessor mock = new MockProcessor();

        // Circuit ID 1: echo mode — output bit 0 = input bit 0
        // So whatever TIMESTAMP_MOD resolves to, the circuit passes it through
        mock.setEchoMode(1);

        console.log("MockProcessor deployed:", address(mock));

        // ─── 2. Cancel old Job 0 (refund budget) ─────────────────────────────
        try registry.cancelJob(0) {
            console.log("Old Job 0 cancelled, budget refunded");
        } catch {
            console.log("Job 0 cancel skipped (may not exist or already inactive)");
        }

        // ─── 3. Register new Demo Job ─────────────────────────────────────────
        // Input: TIMESTAMP_MOD — fires within 60s window every 2 minutes
        IJobRegistry.InputSource[] memory inputs = new IJobRegistry.InputSource[](1);
        inputs[0] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.TIMESTAMP_MOD,
            target:    address(0),
            threshold: 2 minutes,                       // period = 2 min
            data:      abi.encode(uint256(60), true)    // window = 60s, modulo mode
        });

        // Target: call registry.getActiveJobs() as a no-op demo
        bytes memory callData = abi.encodeWithSelector(
            JobRegistry.getActiveJobs.selector
        );

        uint256 jobId = registry.registerJob{value: 0.05 ether}(
            address(mock),  // MockProcessor instead of TapeOut factory
            1,              // circuit ID 1 (echo mode)
            1,              // nIn = 1
            0,              // outputPin = 0
            inputs,
            registryAddr,   // target = registry itself (no-op demo)
            callData,
            200_000,        // gasLimit
            0.001 ether,    // feePerRun
            2 minutes       // cooldown = same as period
        );

        vm.stopBroadcast();

        console.log("=== New Demo Job ===");
        console.log("Job ID:       ", jobId);
        console.log("MockProcessor:", address(mock));
        console.log("Trigger:       every 2 minutes (60s window)");
        console.log("Budget:        0.05 OKB (~50 runs)");
        console.log("");
        console.log("Add to keeper/.env:");
        console.log("MOCK_PROCESSOR=", address(mock));
    }
}
