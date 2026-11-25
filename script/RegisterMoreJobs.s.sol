// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {JobRegistry}     from "../src/JobRegistry.sol";
import {IJobRegistry}    from "../src/interfaces/IJobRegistry.sol";
import {MockProcessor}   from "../test/mocks/MockProcessor.sol";

contract RegisterMoreJobs is Script {
    function run() external {
        address registryAddr  = vm.envAddress("REGISTRY_ADDRESS");
        address mockProcessor = vm.envAddress("MOCK_PROCESSOR");
        uint256 deployerKey   = vm.envUint("DEPLOYER_KEY");

        JobRegistry registry = JobRegistry(payable(registryAddr));
        MockProcessor mock   = MockProcessor(mockProcessor);

        vm.startBroadcast(deployerKey);

        bytes memory noopCall = abi.encodeWithSelector(JobRegistry.getActiveJobs.selector);

        // ── Job C: "Fast Pulse 1min" ──────────────────────────────────────────
        {
            mock.setEchoMode(4);
            IJobRegistry.InputSource[] memory inputs = new IJobRegistry.InputSource[](1);
            inputs[0] = IJobRegistry.InputSource({
                inputType: IJobRegistry.InputType.TIMESTAMP_MOD,
                target:    address(0),
                threshold: 1 minutes,
                data:      abi.encode(uint256(30), true)
            });
            uint256 id = registry.registerJob{value: 0.03 ether}(
                mockProcessor, 4, 1, 0, inputs,
                registryAddr, noopCall, 200_000, 0.001 ether, 1 minutes
            );
            console.log("Job C (Fast Pulse 1min) ID:", id);
        }

        // ── Job D: "Slow Sentinel 10min" ──────────────────────────────────────
        {
            mock.setEchoMode(5);
            IJobRegistry.InputSource[] memory inputs = new IJobRegistry.InputSource[](1);
            inputs[0] = IJobRegistry.InputSource({
                inputType: IJobRegistry.InputType.TIMESTAMP_MOD,
                target:    address(0),
                threshold: 10 minutes,
                data:      abi.encode(uint256(120), true)
            });
            uint256 id = registry.registerJob{value: 0.03 ether}(
                mockProcessor, 5, 1, 0, inputs,
                registryAddr, noopCall, 200_000, 0.001 ether, 10 minutes
            );
            console.log("Job D (Slow Sentinel 10min) ID:", id);
        }

        vm.stopBroadcast();
        console.log("=== Done ===");
    }
}
