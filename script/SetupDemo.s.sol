// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {JobRegistry}     from "../src/JobRegistry.sol";
import {IJobRegistry}    from "../src/interfaces/IJobRegistry.sol";
import {MockProcessor}   from "../test/mocks/MockProcessor.sol";
import {DemoTarget}      from "../src/demo/DemoTarget.sol";

/// @notice Full demo setup:
///         1. Deploy DemoTarget
///         2. Cancel existing junk jobs
///         3. Register 4 meaningful jobs pointing to DemoTarget
contract SetupDemo is Script {
    function run() external {
        address registryAddr  = vm.envAddress("REGISTRY_ADDRESS");
        address mockProcessor = vm.envAddress("MOCK_PROCESSOR");
        uint256 deployerKey   = vm.envUint("DEPLOYER_KEY");

        JobRegistry   registry = JobRegistry(payable(registryAddr));
        MockProcessor mock     = MockProcessor(mockProcessor);

        vm.startBroadcast(deployerKey);

        // ── 1. Deploy DemoTarget ──────────────────────────────────────────────
        DemoTarget target = new DemoTarget();
        console.log("DemoTarget deployed:", address(target));

        // ── 2. Cancel existing junk jobs (1, 2, 3) ───────────────────────────
        for (uint256 i = 1; i <= 3; i++) {
            try registry.cancelJob(i) {
                console.log("Cancelled job", i);
            } catch {
                console.log("Job", i, "skip (already inactive)");
            }
        }

        // ── 3. Setup echo circuits on MockProcessor ───────────────────────────
        for (uint256 i = 10; i <= 13; i++) {
            mock.setEchoMode(i);
        }

        // ── Helper: 1-input TIMESTAMP_MOD source ─────────────────────────────
        // Job A: "Portfolio Rebalancer" — every 3 min
        {
            IJobRegistry.InputSource[] memory inputs = new IJobRegistry.InputSource[](1);
            inputs[0] = IJobRegistry.InputSource({
                inputType: IJobRegistry.InputType.TIMESTAMP_MOD,
                target:    address(0),
                threshold: 3 minutes,
                data:      abi.encode(uint256(60), true)
            });
            bytes memory callData = abi.encodeWithSignature("rebalance()");
            uint256 id = registry.registerJob{value: 0.05 ether}(
                mockProcessor, 10, 1, 0, inputs,
                address(target), callData, 300_000, 0.001 ether, 3 minutes
            );
            console.log("Job A (Portfolio Rebalancer, 3min) ID:", id);
        }

        // Job B: "Yield Harvester" — every 5 min
        {
            IJobRegistry.InputSource[] memory inputs = new IJobRegistry.InputSource[](1);
            inputs[0] = IJobRegistry.InputSource({
                inputType: IJobRegistry.InputType.TIMESTAMP_MOD,
                target:    address(0),
                threshold: 5 minutes,
                data:      abi.encode(uint256(90), true)
            });
            bytes memory callData = abi.encodeWithSignature("harvest()");
            uint256 id = registry.registerJob{value: 0.05 ether}(
                mockProcessor, 11, 1, 0, inputs,
                address(target), callData, 300_000, 0.001 ether, 5 minutes
            );
            console.log("Job B (Yield Harvester, 5min) ID:", id);
        }

        // Job C: "Liquidation Guard" — every 2 min
        {
            IJobRegistry.InputSource[] memory inputs = new IJobRegistry.InputSource[](1);
            inputs[0] = IJobRegistry.InputSource({
                inputType: IJobRegistry.InputType.TIMESTAMP_MOD,
                target:    address(0),
                threshold: 2 minutes,
                data:      abi.encode(uint256(45), true)
            });
            bytes memory callData = abi.encodeWithSignature("preventLiquidation()");
            uint256 id = registry.registerJob{value: 0.05 ether}(
                mockProcessor, 12, 1, 0, inputs,
                address(target), callData, 300_000, 0.001 ether, 2 minutes
            );
            console.log("Job C (Liquidation Guard, 2min) ID:", id);
        }

        // Job D: "Oracle Updater" — every 1 min
        {
            IJobRegistry.InputSource[] memory inputs = new IJobRegistry.InputSource[](1);
            inputs[0] = IJobRegistry.InputSource({
                inputType: IJobRegistry.InputType.TIMESTAMP_MOD,
                target:    address(0),
                threshold: 1 minutes,
                data:      abi.encode(uint256(20), true)
            });
            bytes memory callData = abi.encodeWithSignature("updateOracle()");
            uint256 id = registry.registerJob{value: 0.03 ether}(
                mockProcessor, 13, 1, 0, inputs,
                address(target), callData, 300_000, 0.001 ether, 1 minutes
            );
            console.log("Job D (Oracle Updater, 1min) ID:", id);
        }

        vm.stopBroadcast();

        console.log("");
        console.log("=== Demo Setup Complete ===");
        console.log("DemoTarget:", address(target));
        console.log("Add to frontend/lib/config.ts: demoTarget =", address(target));
    }
}
