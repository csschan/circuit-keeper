// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ITapeOutProcessor} from "../../src/interfaces/ITapeOutProcessor.sol";

/// @title MockProcessor
/// @notice Test double for TapeOut processor
/// @dev Supports two modes:
///      1. Fixed output: always returns a preset bytes value
///      2. Echo mode: returns input as output (bit 0 = input bit 0)
contract MockProcessor is ITapeOutProcessor {
    // circuitId → fixed output bytes (if set)
    mapping(uint256 => bytes) private _fixedOutputs;
    // circuitId → whether to use echo mode
    mapping(uint256 => bool)  private _echoMode;

    // ─── Setup helpers ───────────────────────────────────────────────────────

    /// @notice Set a fixed output for a circuit (overrides echo mode)
    function setOutput(uint256 circuitId, bytes calldata output) external {
        _fixedOutputs[circuitId] = output;
        _echoMode[circuitId] = false;
    }

    /// @notice Set a single-bit output: true → 0x01, false → 0x00
    function setOutputBit(uint256 circuitId, bool bit) external {
        _fixedOutputs[circuitId] = bit ? bytes(hex"01") : bytes(hex"00");
        _echoMode[circuitId] = false;
    }

    /// @notice Enable echo mode: output[0] bit 0 mirrors input[0] bit 0
    function setEchoMode(uint256 circuitId) external {
        _echoMode[circuitId] = true;
        delete _fixedOutputs[circuitId];
    }

    // ─── ITapeOutProcessor ───────────────────────────────────────────────────

    function eval(uint256 circuitId, bytes calldata input)
        external
        view
        override
        returns (bytes memory output)
    {
        if (_echoMode[circuitId]) {
            if (input.length == 0) return bytes(hex"00");
            // Mirror bit 0 of first byte
            bytes memory result = new bytes(1);
            result[0] = bytes1(uint8(input[0]) & 0x01);
            return result;
        }
        return _fixedOutputs[circuitId];
    }

    function step(
        uint256 circuitId,
        bytes calldata state,
        bytes calldata input
    ) external view override returns (bytes memory nextState, bytes memory output) {
        // For tests, state passes through unchanged
        output = this.eval(circuitId, input);
        nextState = state;
    }
}
