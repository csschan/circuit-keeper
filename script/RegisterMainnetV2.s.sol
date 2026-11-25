// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {Script, console}  from "forge-std/Script.sol";
import {IJobRegistry}     from "../src/interfaces/IJobRegistry.sol";

contract RegisterMainnetV2 is Script {
    address constant REGISTRY    = 0x891166Ac81f4b9cD646e9Cd645c1D6eA5d78E853;
    address constant PRICE_RELAY = 0xe60A1b35Adacc16B00eF16d5542cE86E21F22d55;

    // Real TapeOut processor on X Layer mainnet
    address constant XBOT = 0xa5fc69Ca2D3d462CCa204D894D85ac8071c4F0f0;
    // Circuit 1 = NAND-2: nIn=2, nOut=1
    // NAND(A,A) = NOT(A)
    // Wire BOTH inputs to same condition: PRICE_BELOW $80
    // NOT(PRICE_BELOW $80) = PRICE_ABOVE $80 → trigger!

    function run() external {
        vm.startBroadcast(vm.envUint("DEPLOYER_KEY"));

        // ── Job: "OKB > $80 Rebalancer" using real TapeOut NAND as NOT gate ─
        {
            IJobRegistry.InputSource[] memory inputs = new IJobRegistry.InputSource[](2);
            // Both inputs = same condition: PRICE_BELOW $80
            // When OKB < $80: both inputs = TRUE → NAND(1,1) = 0 → no trigger
            // When OKB >= $80: both inputs = FALSE → NAND(0,0) = 1 → TRIGGER!
            inputs[0] = IJobRegistry.InputSource({
                inputType: IJobRegistry.InputType.PRICE_BELOW,
                target:    PRICE_RELAY,
                threshold: 80_00000000,  // $80
                data:      abi.encode(false)
            });
            inputs[1] = IJobRegistry.InputSource({
                inputType: IJobRegistry.InputType.PRICE_BELOW,
                target:    PRICE_RELAY,
                threshold: 80_00000000,
                data:      abi.encode(false)
            });

            uint256 id = IJobRegistry(REGISTRY).registerJob{value: 0.01 ether}(
                XBOT,    // Real TapeOut XBOT processor
                1,       // Circuit 1 = NAND-2 (used as NOT gate)
                2,       // nIn = 2
                0,       // outputPin = 0
                inputs,
                REGISTRY,
                abi.encodeWithSignature("getActiveJobs()"),
                200_000,
                0.0005 ether,
                3 minutes
            );
            console.log("Job: OKB NOT(below $80) via NAND -> ID:", id);
        }

        vm.stopBroadcast();
    }
}
