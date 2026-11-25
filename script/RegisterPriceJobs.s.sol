// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {Script, console}  from "forge-std/Script.sol";
import {IJobRegistry}     from "../src/interfaces/IJobRegistry.sol";
import {MockProcessor}    from "../test/mocks/MockProcessor.sol";

contract RegisterPriceJobs is Script {
    address constant REGISTRY     = 0x891166Ac81f4b9cD646e9Cd645c1D6eA5d78E853;
    address constant MOCK         = 0xe2215f60f1686E6e7D576dCfa2A5ea22112c8880;
    address constant DEMO_TARGET  = 0xE1DCFFa345BcE59dFB2dAC02a853ec45A458cc31;
    address constant PRICE_RELAY  = 0x2e45e4378AfbF1de93ef1aC903DcD66DDEE9165e;

    function run() external {
        vm.startBroadcast(vm.envUint("DEPLOYER_KEY"));

        MockProcessor(MOCK).setEchoMode(40);
        MockProcessor(MOCK).setEchoMode(41);

        // ── Job: "OKB Price Guard" — trigger when OKB > $80 ──────────────────
        // Uses PRICE_ABOVE with PriceRelay as the feed
        // PriceRelay implements latestRoundData() returning OKB/USD price
        // threshold = $80 = 80 * 1e8 = 8000000000
        {
            IJobRegistry.InputSource[] memory inputs = new IJobRegistry.InputSource[](1);
            inputs[0] = IJobRegistry.InputSource({
                inputType: IJobRegistry.InputType.PRICE_ABOVE,  // 0
                target:    PRICE_RELAY,
                threshold: 80_00000000,   // $80.00 in 8 decimals
                data:      abi.encode(true)   // aboveNotBelow = true
            });
            uint256 id = IJobRegistry(REGISTRY).registerJob{value: 0.02 ether}(
                MOCK, 40, 1, 0, inputs,
                DEMO_TARGET,
                abi.encodeWithSignature("rebalance()"),
                300_000, 0.001 ether, 2 minutes
            );
            console.log("Job: OKB > $80 -> rebalance() ID:", id);
        }

        // ── Job: "BTC Whale Alert" — trigger when OKB > $82 ──────────────────
        {
            IJobRegistry.InputSource[] memory inputs = new IJobRegistry.InputSource[](1);
            inputs[0] = IJobRegistry.InputSource({
                inputType: IJobRegistry.InputType.PRICE_ABOVE,
                target:    PRICE_RELAY,
                threshold: 82_00000000,   // $82.00
                data:      abi.encode(true)
            });
            uint256 id = IJobRegistry(REGISTRY).registerJob{value: 0.02 ether}(
                MOCK, 41, 1, 0, inputs,
                DEMO_TARGET,
                abi.encodeWithSignature("preventLiquidation()"),
                300_000, 0.001 ether, 3 minutes
            );
            console.log("Job: OKB > $82 -> preventLiquidation() ID:", id);
        }

        vm.stopBroadcast();
    }
}
