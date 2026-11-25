// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockTarget
/// @notice Simulates a contract that gets called by Circuit Keeper's executeJob
contract MockTarget {
    uint256 public callCount;
    bytes   public lastCallData;
    bool    public shouldRevert;
    string  public revertReason;

    function setShouldRevert(bool revert_, string calldata reason) external {
        shouldRevert = revert_;
        revertReason = reason;
    }

    // The function that gets called by the keeper
    function execute(bytes calldata data) external {
        if (shouldRevert) revert(revertReason);
        callCount++;
        lastCallData = data;
    }

    // Fallback: accept any call (for testing raw calldata)
    fallback() external {
        if (shouldRevert) revert(revertReason);
        callCount++;
        lastCallData = msg.data;
    }

    receive() external payable {}
}
