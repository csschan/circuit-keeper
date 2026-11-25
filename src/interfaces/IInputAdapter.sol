// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IInputAdapter
/// @notice Resolves one on-chain data source into a single boolean bit
interface IInputAdapter {
    /// @notice Read on-chain data and return a single boolean
    /// @param target    Contract address to query (price feed, token, etc.)
    /// @param threshold Comparison threshold (interpretation depends on adapter type)
    /// @param data      Extra encoded parameters specific to adapter type
    /// @return bit      true = 1, false = 0
    function resolve(
        address target,
        uint256 threshold,
        bytes calldata data
    ) external view returns (bool bit);
}
