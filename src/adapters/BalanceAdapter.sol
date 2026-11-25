// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IInputAdapter} from "../interfaces/IInputAdapter.sol";

interface IERC20Minimal {
    function balanceOf(address account) external view returns (uint256);
}

/// @title BalanceAdapter
/// @notice Resolves an ERC20 balance comparison to a boolean
contract BalanceAdapter is IInputAdapter {
    /// @param target    ERC20 token contract address
    /// @param threshold Balance threshold (in token's native units)
    /// @param data      abi.encode(address account, bool aboveNotBelow)
    ///                  account = whose balance to check
    ///                  aboveNotBelow = true means balance > threshold
    function resolve(
        address target,
        uint256 threshold,
        bytes calldata data
    ) external view override returns (bool bit) {
        (address account, bool aboveNotBelow) = abi.decode(data, (address, bool));

        uint256 balance = IERC20Minimal(target).balanceOf(account);
        return aboveNotBelow ? balance > threshold : balance < threshold;
    }
}
