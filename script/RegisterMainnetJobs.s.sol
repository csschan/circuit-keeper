// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {Script, console}  from "forge-std/Script.sol";
import {IJobRegistry}     from "../src/interfaces/IJobRegistry.sol";

contract RegisterMainnetJobs is Script {
    address constant REGISTRY    = 0x891166Ac81f4b9cD646e9Cd645c1D6eA5d78E853;
    address constant PRICE_RELAY = 0xe60A1b35Adacc16B00eF16d5542cE86E21F22d55;

    // Real TapeOut processor on X Layer mainnet
    address constant XBOT_PROCESSOR = 0xa5fc69Ca2D3d462CCa204D894D85ac8071c4F0f0;
    // Circuit 1 = NAND-2 (2 inputs → 1 output), nIn=2, nOut=1
    // NAND truth: only outputs 0 when BOTH inputs are 1
    // We want: trigger when price > threshold → input bit = 1
    // With NAND gate: if we wire input 0 = price condition, input 1 = always TRUE (1)
    //   price TRUE  + TRUE → NAND → 0 (don't trigger)
    //   price FALSE + TRUE → NAND → 1 (trigger)
    // So we use it as a NOT gate: triggers when price condition is FALSE
    // For "trigger when OKB > $80": use PRICE_BELOW $80 as input → NOT → triggers when NOT below $80 = above $80

    function run() external {
        vm.startBroadcast(vm.envUint("DEPLOYER_KEY"));

        // ── Job: "OKB Price Rebalancer" ─────────────────────────────────

        // Using real TapeOut NAND circuit as NOT gate
        // Input 0: PRICE_BELOW $80 (true when price < $80)
        // Input 1: TIMESTAMP_MOD 2min window (always true as scheduling gate)
        // NAND(below_80, in_window) → triggers when NOT(below AND in_window)
        //   = triggers when price >= $80 OR not in window
        // For simplicity: use NAND-2 as pure logic gate demo
        {
            IJobRegistry.InputSource[] memory inputs = new IJobRegistry.InputSource[](2);
            // Input 0: Price condition — OKB > $80
            inputs[0] = IJobRegistry.InputSource({
                inputType: IJobRegistry.InputType.PRICE_ABOVE,
                target:    PRICE_RELAY,
                threshold: 80_00000000,  // $80 in 8 decimals
                data:      abi.encode(true)
            });
            // Input 1: Time window — every 3 minutes
            inputs[1] = IJobRegistry.InputSource({
                inputType: IJobRegistry.InputType.TIMESTAMP_MOD,
                target:    address(0),
                threshold: 3 minutes,
                data:      abi.encode(uint256(60), true)
            });

            uint256 id = IJobRegistry(REGISTRY).registerJob{value: 0.01 ether}(
                XBOT_PROCESSOR,     // Real TapeOut processor!
                1,                  // Circuit 1 = NAND-2
                2,                  // nIn = 2 (matches circuit)
                0,                  // outputPin = 0
                inputs,
                REGISTRY,           // target = self (no-op demo, just proving circuit works)
                abi.encodeWithSignature("getActiveJobs()"),
                200_000,
                0.0005 ether,       // feePerRun
                3 minutes
            );
            console.log("Job: OKB NAND Price Guard (real TapeOut) ID:", id);
        }

        vm.stopBroadcast();
    }
}
