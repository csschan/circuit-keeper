// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IInputAdapter} from "../interfaces/IInputAdapter.sol";
import {ITapeOutProcessor} from "../interfaces/ITapeOutProcessor.sol";

/// @title CircuitAdapter
/// @notice Resolves a sub-circuit's output bit 0 as a boolean
/// @dev Enables circuit composition: one circuit's output feeds into another's input.
///      Sub-circuit is called with zero-byte input (combinational, no inputs needed).
///      For sub-circuits with inputs, use StaticCallAdapter instead.
contract CircuitAdapter is IInputAdapter {
    error EmptyCircuitOutput(address processor, uint256 circuitId);

    /// @param target    TapeOut processor contract address
    /// @param threshold Sub-circuit ID
    /// @param data      Bit-packed input bytes for the sub-circuit (can be empty for 0-input circuits)
    function resolve(
        address target,
        uint256 threshold,
        bytes calldata data
    ) external view override returns (bool bit) {
        bytes memory output = ITapeOutProcessor(target).eval(threshold, data);

        if (output.length == 0) revert EmptyCircuitOutput(target, threshold);

        // Check output bit 0 (LSB first)
        return (uint8(output[0]) & 0x01) == 1;
    }
}
