// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {Script, console} from "forge-std/Script.sol";
import {MockProcessor}   from "../test/mocks/MockProcessor.sol";
import {DemoTarget}      from "../src/demo/DemoTarget.sol";

contract DeployMainnetAll is Script {
    function run() external {
        uint256 key = vm.envUint("DEPLOYER_KEY");
        vm.startBroadcast(key);

        // Deploy MockProcessor (for time-based templates)
        MockProcessor mock = new MockProcessor();
        // Set echo mode for all template circuit IDs
        for (uint256 i = 50; i <= 57; i++) {
            mock.setEchoMode(i);
        }
        console.log("MockProcessor:", address(mock));

        // Deploy DemoTarget
        DemoTarget target = new DemoTarget();
        console.log("DemoTarget:", address(target));

        vm.stopBroadcast();
    }
}
