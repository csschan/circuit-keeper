// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ITapeOutProcessor
/// @notice Interface for TapeOut on-chain circuit processors
/// @dev eval() is a free view call — no gas cost, no state mutation
///      Input/output encoding: bit-packed bytes, LSB first
///      pin[0] → byte[0] bit0, pin[1] → byte[0] bit1, pin[8] → byte[1] bit0
interface ITapeOutProcessor {
    /// @notice Evaluate a combinational circuit (stateless)
    /// @param circuitId The circuit ID within this processor
    /// @param input     Bit-packed input bytes (LSB first), length = ceil(nIn/8)
    /// @return output   Bit-packed output bytes (LSB first), length = ceil(nOut/8)
    function eval(uint256 circuitId, bytes calldata input)
        external
        view
        returns (bytes memory output);

    /// @notice Evaluate a sequential circuit (stateful, uses LATCH)
    /// @param circuitId The circuit ID within this processor
    /// @param state     Current LATCH state bytes
    /// @param input     Bit-packed input bytes (LSB first)
    /// @return nextState Updated LATCH state after this step
    /// @return output    Bit-packed output bytes (LSB first)
    function step(
        uint256 circuitId,
        bytes calldata state,
        bytes calldata input
    ) external view returns (bytes memory nextState, bytes memory output);
}
