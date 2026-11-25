// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {JobRegistry}     from "../src/JobRegistry.sol";
import {PriceRelay}      from "../src/relay/PriceRelay.sol";

contract DeployMainnet is Script {
    function run() external {
        uint256 key = vm.envUint("DEPLOYER_KEY");
        address deployer = vm.addr(key);

        vm.startBroadcast(key);

        // 1. Deploy JobRegistry
        JobRegistry registry = new JobRegistry(deployer);
        console.log("JobRegistry:", address(registry));

        // 2. Deploy PriceRelay
        PriceRelay relay = new PriceRelay(deployer);
        relay.registerFeed("OKB/USD", 8);
        relay.registerFeed("USDC/USD", 8);
        relay.registerFeed("ETH/USD", 8);
        relay.registerFeed("BTC/USD", 8);
        console.log("PriceRelay:", address(relay));

        vm.stopBroadcast();
    }
}
