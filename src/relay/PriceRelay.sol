// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PriceRelay
/// @notice Relays mainnet Chainlink price data to testnet.
///         Implements AggregatorV3Interface so PriceFeedAdapter can read it directly.
///         Keeper bot reads from mainnet Chainlink → pushes here on testnet.
contract PriceRelay {
    struct PriceData {
        int256  price;
        uint256 updatedAt;
        uint80  roundId;
    }

    address public owner;
    address public relayer;    // keeper bot address

    // pair name → price data (e.g. "OKB/USD", "ETH/USD")
    mapping(string => PriceData) public prices;
    mapping(string => uint8)     public decimalsOf;

    // address-indexed for adapter compatibility (adapter calls by address)
    mapping(address => string)   public feedName;

    uint256 public totalUpdates;

    event PriceUpdated(string indexed pair, int256 price, uint256 timestamp);

    modifier onlyRelayer() {
        require(msg.sender == relayer || msg.sender == owner, "not relayer");
        _;
    }

    constructor(address _relayer) {
        owner = msg.sender;
        relayer = _relayer;
    }

    /// @notice Register a price feed pair with its decimal precision
    function registerFeed(string calldata pair, uint8 _decimals) external {
        require(msg.sender == owner, "not owner");
        decimalsOf[pair] = _decimals;
    }

    /// @notice Push a new price from mainnet
    function updatePrice(string calldata pair, int256 price) external onlyRelayer {
        prices[pair] = PriceData({
            price: price,
            updatedAt: block.timestamp,
            roundId: prices[pair].roundId + 1
        });
        totalUpdates++;
        emit PriceUpdated(pair, price, block.timestamp);
    }

    /// @notice Batch update multiple prices in one tx
    function batchUpdate(
        string[] calldata pairs,
        int256[] calldata _prices
    ) external onlyRelayer {
        require(pairs.length == _prices.length, "length mismatch");
        for (uint256 i = 0; i < pairs.length; i++) {
            prices[pairs[i]] = PriceData({
                price: _prices[i],
                updatedAt: block.timestamp,
                roundId: prices[pairs[i]].roundId + 1
            });
            emit PriceUpdated(pairs[i], _prices[i], block.timestamp);
        }
        totalUpdates += pairs.length;
    }

    // ─── AggregatorV3Interface (read by PriceFeedAdapter) ────────────────────

    /// @notice Returns price for a registered pair.
    ///         Call via the feed's self-address: feedName[address(this)] maps to pair.
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        // Default pair for direct calls — use "OKB/USD"
        PriceData memory d = prices["OKB/USD"];
        return (d.roundId, d.price, d.updatedAt, d.updatedAt, d.roundId);
    }

    /// @notice Get price for a specific pair
    function getPrice(string calldata pair) external view returns (int256 price, uint256 updatedAt) {
        PriceData memory d = prices[pair];
        return (d.price, d.updatedAt);
    }

    function decimals() external pure returns (uint8) {
        return 8; // Chainlink standard
    }
}
