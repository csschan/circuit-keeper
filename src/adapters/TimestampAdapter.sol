// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IInputAdapter} from "../interfaces/IInputAdapter.sol";

/// @title TimestampAdapter
/// @notice Resolves time-based conditions to a boolean
/// @dev Supports two modes:
///      1. MODULO: block.timestamp % period < window  (recurring — daily, weekly, etc.)
///      2. AFTER:  block.timestamp >= target timestamp (one-shot deadline)
contract TimestampAdapter is IInputAdapter {
    /// @param target    Unused (pass address(0))
    /// @param threshold The period in seconds (MODULO mode) or deadline timestamp (AFTER mode)
    /// @param data      abi.encode(uint256 window, bool moduloNotAfter)
    ///                  window        = trigger window in seconds (only used in MODULO mode)
    ///                  moduloNotAfter = true = MODULO, false = AFTER
    function resolve(
        address target,
        uint256 threshold,
        bytes calldata data
    ) external view override returns (bool bit) {
        (uint256 window, bool moduloNotAfter) = abi.decode(data, (uint256, bool));

        if (moduloNotAfter) {
            // Recurring: fires when we're within `window` seconds of the period boundary
            return block.timestamp % threshold < window;
        } else {
            // One-shot: fires after the deadline
            return block.timestamp >= threshold;
        }
    }
}
