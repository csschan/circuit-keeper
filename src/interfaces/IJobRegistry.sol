// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IJobRegistry
/// @notice Public interface for Circuit Keeper job management
interface IJobRegistry {
    // ─── Enums ───────────────────────────────────────────────────────────────

    enum InputType {
        PRICE_ABOVE,        // Chainlink feed: latestPrice > threshold
        PRICE_BELOW,        // Chainlink feed: latestPrice < threshold
        ERC20_BALANCE_ABOVE, // token.balanceOf(addr) > threshold
        ERC20_BALANCE_BELOW, // token.balanceOf(addr) < threshold
        TIMESTAMP_MOD,      // block.timestamp % threshold < window (data = abi.encode(window))
        STATIC_CALL,        // arbitrary view call returning bool (data = calldata)
        CIRCUIT_OUTPUT      // sub-circuit output bit 0 (target = processor, threshold = circuitId)
    }

    // ─── Structs ─────────────────────────────────────────────────────────────

    struct InputSource {
        InputType inputType;
        address   target;      // price feed / token / processor / target contract
        uint256   threshold;   // comparison value or sub-circuitId
        bytes     data;        // extra params (window for TIMESTAMP_MOD, calldata for STATIC_CALL)
    }

    struct Job {
        address       owner;
        address       processor;    // TapeOut processor contract
        uint256       circuitId;    // condition circuit ID (immutable after registration)
        uint8         nIn;          // number of input pins on the circuit
        uint8         outputPin;    // which output bit to check (default 0)
        address       target;       // contract to call when triggered
        bytes         callData;     // encoded function call
        uint256       gasLimit;     // gas cap for target call
        uint256       budget;       // remaining OKB budget (wei)
        uint256       feePerRun;    // OKB paid to keeper per execution (wei)
        uint256       cooldown;     // minimum seconds between executions
        uint256       lastRun;      // timestamp of last execution
        bool          active;
    }

    // ─── Events ──────────────────────────────────────────────────────────────

    event JobRegistered(uint256 indexed jobId, address indexed owner, address processor, uint256 circuitId);
    event JobExecuted(uint256 indexed jobId, address indexed keeper, uint256 timestamp);
    event JobPaused(uint256 indexed jobId);
    event JobResumed(uint256 indexed jobId);
    event JobCancelled(uint256 indexed jobId, uint256 budgetRefunded);
    event BudgetToppedUp(uint256 indexed jobId, uint256 amount);
    event CallDataUpdated(uint256 indexed jobId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error JobNotFound(uint256 jobId);
    error NotJobOwner(uint256 jobId);
    error JobNotActive(uint256 jobId);
    error CooldownNotMet(uint256 jobId, uint256 readyAt);
    error InsufficientBudget(uint256 jobId);
    error ConditionNotMet(uint256 jobId);
    error TargetCallFailed(uint256 jobId);
    error InvalidNIn(uint8 nIn, uint8 sourcesLength);
    error InvalidFeePerRun();
    error InvalidGasLimit();

    // ─── Functions ───────────────────────────────────────────────────────────

    function registerJob(
        address processor,
        uint256 circuitId,
        uint8 nIn,
        uint8 outputPin,
        InputSource[] calldata inputs,
        address target,
        bytes calldata callData,
        uint256 gasLimit,
        uint256 feePerRun,
        uint256 cooldown
    ) external payable returns (uint256 jobId);

    function checkUpkeep(uint256 jobId) external view returns (bool upkeepNeeded);

    function executeJob(uint256 jobId) external;

    function topUpBudget(uint256 jobId) external payable;

    function pauseJob(uint256 jobId) external;

    function resumeJob(uint256 jobId) external;

    function cancelJob(uint256 jobId) external;

    function updateCallData(uint256 jobId, bytes calldata newCallData) external;

    function getJob(uint256 jobId) external view returns (Job memory);

    function getInputSources(uint256 jobId) external view returns (InputSource[] memory);

    function getActiveJobs() external view returns (uint256[] memory);

    function nextJobId() external view returns (uint256);

    function protocolFeeRate() external view returns (uint256);
}
