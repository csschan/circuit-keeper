// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IInputAdapter} from "../interfaces/IInputAdapter.sol";

/// @title StaticCallAdapter
/// @notice Resolves an arbitrary view-call result to a boolean
/// @dev Calls target with provided calldata and decodes the first return value as bool.
///      Useful for health factors, proposal status, any on-chain bool getter.
contract StaticCallAdapter is IInputAdapter {
    error CallFailed(address target);
    error EmptyReturnData(address target);

    /// @param target    Contract to call
    /// @param threshold Unused (pass 0)
    /// @param data      Raw calldata to send (e.g. abi.encodeWithSelector(selector, args...))
    function resolve(
        address target,
        uint256 threshold,
        bytes calldata data
    ) external view override returns (bool bit) {
        (bool success, bytes memory returnData) = target.staticcall(data);

        if (!success) revert CallFailed(target);
        if (returnData.length == 0) revert EmptyReturnData(target);

        return abi.decode(returnData, (bool));
    }
}
