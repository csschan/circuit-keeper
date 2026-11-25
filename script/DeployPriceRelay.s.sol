// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {Script, console} from "forge-std/Script.sol";
import {PriceRelay} from "../src/relay/PriceRelay.sol";
contract DeployPriceRelay is Script {
    function run() external {
        uint256 key = vm.envUint("DEPLOYER_KEY");
        address relayer = vm.addr(key); // keeper wallet is the relayer
        vm.startBroadcast(key);
        PriceRelay relay = new PriceRelay(relayer);
        relay.registerFeed("OKB/USD", 8);
        relay.registerFeed("USDC/USD", 8);
        vm.stopBroadcast();
        console.log("PriceRelay:", address(relay));
    }
}
