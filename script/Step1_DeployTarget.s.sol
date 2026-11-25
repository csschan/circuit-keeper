// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {Script, console} from "forge-std/Script.sol";
import {DemoTarget} from "../src/demo/DemoTarget.sol";
contract Step1_DeployTarget is Script {
    function run() external {
        vm.startBroadcast(vm.envUint("DEPLOYER_KEY"));
        DemoTarget t = new DemoTarget();
        vm.stopBroadcast();
        console.log("DemoTarget:", address(t));
    }
}
