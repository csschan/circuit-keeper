// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {Script, console}  from "forge-std/Script.sol";
import {JobRegistry}      from "../src/JobRegistry.sol";
import {IJobRegistry}     from "../src/interfaces/IJobRegistry.sol";
import {MockProcessor}    from "../test/mocks/MockProcessor.sol";

contract Step3_MoreJobs is Script {
    address constant REGISTRY     = 0x891166Ac81f4b9cD646e9Cd645c1D6eA5d78E853;
    address constant MOCK         = 0xe2215f60f1686E6e7D576dCfa2A5ea22112c8880;
    address constant DEMO_TARGET  = 0xE1DCFFa345BcE59dFB2dAC02a853ec45A458cc31;

    function run() external {
        vm.startBroadcast(vm.envUint("DEPLOYER_KEY"));

        MockProcessor mock = MockProcessor(MOCK);

        mock.setEchoMode(30);
        mock.setEchoMode(31);

        IJobRegistry.InputSource[] memory inp = new IJobRegistry.InputSource[](1);

        // ── Job: Oracle Price Updater (every 1 min) ───────────────────────────
        inp[0] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.TIMESTAMP_MOD,
            target: address(0), threshold: 1 minutes,
            data: abi.encode(uint256(20), true)
        });
        uint256 idA = IJobRegistry(REGISTRY).registerJob{value: 0.02 ether}(
            MOCK, 30, 1, 0, inp,
            DEMO_TARGET, abi.encodeWithSignature("updateOracle()"),
            300_000, 0.001 ether, 1 minutes
        );
        console.log("Job: Oracle Updater (1min) =>", idA);

        // ── Job: Auto Compounder (every 10 min) ──────────────────────────────
        inp[0] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.TIMESTAMP_MOD,
            target: address(0), threshold: 10 minutes,
            data: abi.encode(uint256(120), true)
        });
        uint256 idB = IJobRegistry(REGISTRY).registerJob{value: 0.02 ether}(
            MOCK, 31, 1, 0, inp,
            DEMO_TARGET, abi.encodeWithSignature("harvest()"),
            300_000, 0.001 ether, 10 minutes
        );
        console.log("Job: Auto Compounder (10min) =>", idB);

        vm.stopBroadcast();
    }
}
