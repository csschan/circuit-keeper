// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IInputAdapter} from "../interfaces/IInputAdapter.sol";

interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80  roundId,
            int256  answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80  answeredInRound
        );
    function decimals() external view returns (uint8);
}

/// @title PriceFeedAdapter
/// @notice Resolves a Chainlink price feed comparison to a boolean
/// @dev threshold is in the same units as the feed's raw answer (8 decimals for USD feeds)
///      data encodes the InputType: 0 = PRICE_ABOVE, 1 = PRICE_BELOW
///      Staleness check: rejects prices older than 1 hour
contract PriceFeedAdapter is IInputAdapter {
    uint256 public constant STALENESS_THRESHOLD = 1 hours;

    error StalePrice(address feed, uint256 updatedAt);
    error NegativePrice(address feed, int256 answer);

    /// @param target    Chainlink AggregatorV3 feed address
    /// @param threshold Price threshold (raw feed units, e.g. 1800_0000_0000 = $1800 for 8-decimal feed)
    /// @param data      abi.encode(bool aboveNotBelow) — true = PRICE_ABOVE, false = PRICE_BELOW
    function resolve(
        address target,
        uint256 threshold,
        bytes calldata data
    ) external view override returns (bool bit) {
        bool aboveNotBelow = abi.decode(data, (bool));

        (, int256 answer,, uint256 updatedAt,) =
            AggregatorV3Interface(target).latestRoundData();

        if (block.timestamp - updatedAt > STALENESS_THRESHOLD) {
            revert StalePrice(target, updatedAt);
        }
        if (answer < 0) {
            revert NegativePrice(target, answer);
        }

        uint256 price = uint256(answer);
        return aboveNotBelow ? price > threshold : price < threshold;
    }
}
