// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DemoTarget
/// @notice Simulates real DeFi automation targets for hackathon demo.
///         Each function represents a common automation use case and emits
///         a meaningful event so on-chain activity is visible in the explorer.
contract DemoTarget {

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;

    struct ActionRecord {
        uint256 timestamp;
        address caller;
        uint256 count;
    }

    mapping(string => ActionRecord) public lastAction;
    mapping(string => uint256)      public actionCount;

    uint256 public totalValueRebalanced; // mock TVL rebalanced (in fake USD)
    uint256 public totalYieldHarvested;  // mock yield harvested (in fake units)
    uint256 public liquidationsPrevented;
    uint256 public priceUpdates;

    // ─── Events ───────────────────────────────────────────────────────────────

    event PortfolioRebalanced(
        address indexed keeper,
        uint256 indexed runNumber,
        uint256 mockTvl,
        uint256 timestamp
    );

    event YieldHarvested(
        address indexed keeper,
        uint256 indexed runNumber,
        uint256 mockYield,
        uint256 timestamp
    );

    event LiquidationPrevented(
        address indexed keeper,
        uint256 indexed runNumber,
        uint256 mockCollateral,
        uint256 timestamp
    );

    event OraclePriceUpdated(
        address indexed keeper,
        uint256 indexed runNumber,
        uint256 mockPrice,
        uint256 timestamp
    );

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ─── Automation targets ───────────────────────────────────────────────────

    /// @notice Rebalance a mock portfolio (e.g. monthly rebalancing strategy)
    function rebalance() external {
        actionCount["rebalance"]++;
        uint256 n = actionCount["rebalance"];

        // Simulate TVL between 10k–50k USD (deterministic pseudo-random)
        uint256 mockTvl = 10_000 + (uint256(keccak256(abi.encode(block.timestamp, n))) % 40_000);
        totalValueRebalanced += mockTvl;

        lastAction["rebalance"] = ActionRecord(block.timestamp, msg.sender, n);
        emit PortfolioRebalanced(msg.sender, n, mockTvl, block.timestamp);
    }

    /// @notice Harvest yield from a mock yield aggregator
    function harvest() external {
        actionCount["harvest"]++;
        uint256 n = actionCount["harvest"];

        // Simulate yield between 1–500 units
        uint256 mockYield = 1 + (uint256(keccak256(abi.encode(block.timestamp, n, "yield"))) % 499);
        totalYieldHarvested += mockYield;

        lastAction["harvest"] = ActionRecord(block.timestamp, msg.sender, n);
        emit YieldHarvested(msg.sender, n, mockYield, block.timestamp);
    }

    /// @notice Top up collateral to prevent liquidation
    function preventLiquidation() external {
        actionCount["liquidation"]++;
        uint256 n = actionCount["liquidation"];

        // Simulate collateral between 500–5000
        uint256 mockCollateral = 500 + (uint256(keccak256(abi.encode(block.timestamp, n, "collat"))) % 4_500);
        liquidationsPrevented++;

        lastAction["liquidation"] = ActionRecord(block.timestamp, msg.sender, n);
        emit LiquidationPrevented(msg.sender, n, mockCollateral, block.timestamp);
    }

    /// @notice Push a fresh price to a mock on-chain oracle
    function updateOracle() external {
        actionCount["oracle"]++;
        uint256 n = actionCount["oracle"];

        // Simulate OKB price between $30–$80
        uint256 mockPrice = 30_00000000 + (uint256(keccak256(abi.encode(block.timestamp, n, "price"))) % 50_00000000);
        priceUpdates++;

        lastAction["oracle"] = ActionRecord(block.timestamp, msg.sender, n);
        emit OraclePriceUpdated(msg.sender, n, mockPrice, block.timestamp);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function stats() external view returns (
        uint256 rebalances,
        uint256 harvests,
        uint256 liquidations,
        uint256 oracles,
        uint256 tvlRebalanced,
        uint256 yieldHarvested
    ) {
        return (
            actionCount["rebalance"],
            actionCount["harvest"],
            actionCount["liquidation"],
            actionCount["oracle"],
            totalValueRebalanced,
            totalYieldHarvested
        );
    }
}
