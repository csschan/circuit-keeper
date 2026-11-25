// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {Script, console} from "forge-std/Script.sol";
import {IJobRegistry}    from "../src/interfaces/IJobRegistry.sol";
import {MockProcessor}   from "../test/mocks/MockProcessor.sol";
contract RegisterJobD is Script {
    function run() external {
        address reg  = vm.envAddress("REGISTRY_ADDRESS");
        address mock = vm.envAddress("MOCK_PROCESSOR");
        uint256 key  = vm.envUint("DEPLOYER_KEY");
        vm.startBroadcast(key);
        MockProcessor(mock).setEchoMode(13);
        IJobRegistry.InputSource[] memory inputs = new IJobRegistry.InputSource[](1);
        inputs[0] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.TIMESTAMP_MOD,
            target: address(0), threshold: 1 minutes,
            data: abi.encode(uint256(20), true)
        });
        uint256 id = IJobRegistry(reg).registerJob{value: 0.02 ether}(
            mock, 13, 1, 0, inputs,
            0x551ca31f78813F78C71cF980AbaAc524abD69c0c,
            abi.encodeWithSignature("updateOracle()"),
            300_000, 0.001 ether, 1 minutes
        );
        vm.stopBroadcast();
        console.log("Job D (Oracle Updater, 1min) ID:", id);
    }
}
