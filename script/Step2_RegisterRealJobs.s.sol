// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {Script, console}  from "forge-std/Script.sol";
import {JobRegistry}      from "../src/JobRegistry.sol";
import {IJobRegistry}     from "../src/interfaces/IJobRegistry.sol";
import {MockProcessor}    from "../test/mocks/MockProcessor.sol";

contract Step2_RegisterRealJobs is Script {
    address constant REGISTRY     = 0x891166Ac81f4b9cD646e9Cd645c1D6eA5d78E853;
    address constant MOCK         = 0xe2215f60f1686E6e7D576dCfa2A5ea22112c8880;
    address constant DEMO_TARGET  = 0xE1DCFFa345BcE59dFB2dAC02a853ec45A458cc31;

    function run() external {
        vm.startBroadcast(vm.envUint("DEPLOYER_KEY"));

        JobRegistry   registry = JobRegistry(payable(REGISTRY));
        MockProcessor mock     = MockProcessor(MOCK);

        // Cancel junk jobs 2, 3, 4
        for (uint256 i = 2; i <= 4; i++) {
            try registry.cancelJob(i) {
                console.log("Cancelled job", i);
            } catch { console.log("Skip cancel", i); }
        }

        // Setup echo circuits
        mock.setEchoMode(20);
        mock.setEchoMode(21);
        mock.setEchoMode(22);

        IJobRegistry.InputSource[] memory inp1 = new IJobRegistry.InputSource[](1);

        // ── Job: Portfolio Rebalancer (every 3 min) ───────────────────────────
        inp1[0] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.TIMESTAMP_MOD,
            target: address(0), threshold: 3 minutes,
            data: abi.encode(uint256(60), true)
        });
        uint256 idA = registry.registerJob{value: 0.03 ether}(
            MOCK, 20, 1, 0, inp1,
            DEMO_TARGET, abi.encodeWithSignature("rebalance()"),
            300_000, 0.001 ether, 3 minutes
        );
        console.log("Job: Portfolio Rebalancer (3min) =>", idA);

        // ── Job: Yield Harvester (every 5 min) ───────────────────────────────
        inp1[0] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.TIMESTAMP_MOD,
            target: address(0), threshold: 5 minutes,
            data: abi.encode(uint256(90), true)
        });
        uint256 idB = registry.registerJob{value: 0.03 ether}(
            MOCK, 21, 1, 0, inp1,
            DEMO_TARGET, abi.encodeWithSignature("harvest()"),
            300_000, 0.001 ether, 5 minutes
        );
        console.log("Job: Yield Harvester (5min)       =>", idB);

        // ── Job: Liquidation Guard (every 2 min) ─────────────────────────────
        inp1[0] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.TIMESTAMP_MOD,
            target: address(0), threshold: 2 minutes,
            data: abi.encode(uint256(45), true)
        });
        uint256 idC = registry.registerJob{value: 0.03 ether}(
            MOCK, 22, 1, 0, inp1,
            DEMO_TARGET, abi.encodeWithSignature("preventLiquidation()"),
            300_000, 0.001 ether, 2 minutes
        );
        console.log("Job: Liquidation Guard (2min)     =>", idC);

        vm.stopBroadcast();
    }
}
