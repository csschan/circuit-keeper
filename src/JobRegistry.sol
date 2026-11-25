// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IJobRegistry} from "./interfaces/IJobRegistry.sol";
import {ITapeOutProcessor} from "./interfaces/ITapeOutProcessor.sol";
import {InputResolver} from "./InputResolver.sol";

/// @title JobRegistry
/// @notice Circuit Keeper's core contract — register, check, and execute automated jobs
///         whose trigger conditions are defined by TapeOut on-chain circuits.
/// @dev Security model:
///      - CEI pattern: state updated before external calls
///      - ReentrancyGuard on executeJob
///      - processor + circuitId immutable after registration
///      - Budget deducted before execution; execution failure reverts the whole tx
contract JobRegistry is IJobRegistry {
    // ─── Constants ───────────────────────────────────────────────────────────

    uint256 public constant PROTOCOL_FEE_RATE = 20;  // 20% of feePerRun
    uint256 public constant MIN_FEE_PER_RUN   = 0.0001 ether;
    uint256 public constant MIN_GAS_LIMIT      = 50_000;
    uint256 public constant MAX_GAS_LIMIT      = 5_000_000;

    // ─── State ───────────────────────────────────────────────────────────────

    uint256 private _nextJobId;
    address public  owner;
    address public  pendingOwner;
    uint256 public  accumulatedFees;

    InputResolver public immutable resolver;

    mapping(uint256 => Job)           private _jobs;
    mapping(uint256 => InputSource[]) private _jobInputs;
    uint256[]                         private _activeJobIds;
    mapping(uint256 => uint256)       private _activeJobIndex; // jobId → index in _activeJobIds

    // ─── Reentrancy guard ────────────────────────────────────────────────────

    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "reentrant");
        _locked = 2;
        _;
        _locked = 1;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _owner) {
        require(_owner != address(0), "zero owner");
        owner = _owner;
        resolver = new InputResolver();
    }

    // ─── Job Registration ────────────────────────────────────────────────────

    /// @inheritdoc IJobRegistry
    function registerJob(
        address processor,
        uint256 circuitId,
        uint8   nIn,
        uint8   outputPin,
        InputSource[] calldata inputs,
        address target,
        bytes   calldata callData,
        uint256 gasLimit,
        uint256 feePerRun,
        uint256 cooldown
    ) external payable returns (uint256 jobId) {
        if (inputs.length != nIn) revert InvalidNIn(nIn, uint8(inputs.length));
        if (feePerRun < MIN_FEE_PER_RUN) revert InvalidFeePerRun();
        if (gasLimit < MIN_GAS_LIMIT || gasLimit > MAX_GAS_LIMIT) revert InvalidGasLimit();

        jobId = _nextJobId++;

        Job storage job = _jobs[jobId];
        job.owner      = msg.sender;
        job.processor  = processor;
        job.circuitId  = circuitId;
        job.nIn        = nIn;
        job.outputPin  = outputPin;
        job.target     = target;
        job.callData   = callData;
        job.gasLimit   = gasLimit;
        job.budget     = msg.value;
        job.feePerRun  = feePerRun;
        job.cooldown   = cooldown;
        job.lastRun    = 0;
        job.active     = true;

        // Store input sources separately (array in struct not copyable directly)
        for (uint256 i = 0; i < inputs.length; i++) {
            _jobInputs[jobId].push(inputs[i]);
        }

        // Track in active jobs list
        _activeJobIndex[jobId] = _activeJobIds.length;
        _activeJobIds.push(jobId);

        emit JobRegistered(jobId, msg.sender, processor, circuitId);
    }

    // ─── Upkeep Check (called by Keeper — view, free) ────────────────────────

    /// @inheritdoc IJobRegistry
    function checkUpkeep(uint256 jobId) external view returns (bool) {
        return _canExecute(jobId);
    }

    // ─── Execution ───────────────────────────────────────────────────────────

    /// @inheritdoc IJobRegistry
    function executeJob(uint256 jobId) external nonReentrant {
        if (!_canExecute(jobId)) {
            Job storage j = _jobs[jobId];
            if (j.owner == address(0))       revert JobNotFound(jobId);
            if (!j.active)                   revert JobNotActive(jobId);
            if (j.budget < j.feePerRun)      revert InsufficientBudget(jobId);
            if (block.timestamp < j.lastRun + j.cooldown)
                revert CooldownNotMet(jobId, j.lastRun + j.cooldown);
            revert ConditionNotMet(jobId);
        }

        Job storage job = _jobs[jobId];

        // CEI: update state before external calls
        job.lastRun = block.timestamp;
        job.budget -= job.feePerRun;

        // Auto-pause if budget too low for next run
        if (job.budget < job.feePerRun) {
            job.active = false;
            _removeFromActive(jobId);
        }

        // Calculate fees
        uint256 protocolFee = (job.feePerRun * PROTOCOL_FEE_RATE) / 100;
        uint256 keeperFee   = job.feePerRun - protocolFee;
        accumulatedFees += protocolFee;

        // Execute target call
        (bool success,) = job.target.call{gas: job.gasLimit}(job.callData);
        if (!success) revert TargetCallFailed(jobId);

        // Pay keeper
        // _locked == 2 here, reentrancy protected
        (bool sent,) = msg.sender.call{value: keeperFee}("");
        require(sent, "keeper payment failed");

        emit JobExecuted(jobId, msg.sender, block.timestamp);
    }

    // ─── Budget Management ───────────────────────────────────────────────────

    /// @inheritdoc IJobRegistry
    function topUpBudget(uint256 jobId) external payable {
        Job storage job = _jobs[jobId];
        if (job.owner == address(0)) revert JobNotFound(jobId);

        job.budget += msg.value;

        // Re-activate if was paused due to empty budget
        if (!job.active && job.budget >= job.feePerRun) {
            job.active = true;
            _activeJobIndex[jobId] = _activeJobIds.length;
            _activeJobIds.push(jobId);
        }

        emit BudgetToppedUp(jobId, msg.value);
    }

    // ─── Job Control (owner only) ─────────────────────────────────────────────

    /// @inheritdoc IJobRegistry
    function pauseJob(uint256 jobId) external {
        Job storage job = _jobs[jobId];
        if (job.owner == address(0)) revert JobNotFound(jobId);
        if (job.owner != msg.sender) revert NotJobOwner(jobId);

        job.active = false;
        _removeFromActive(jobId);
        emit JobPaused(jobId);
    }

    /// @inheritdoc IJobRegistry
    function resumeJob(uint256 jobId) external {
        Job storage job = _jobs[jobId];
        if (job.owner == address(0)) revert JobNotFound(jobId);
        if (job.owner != msg.sender) revert NotJobOwner(jobId);
        if (job.budget < job.feePerRun) revert InsufficientBudget(jobId);

        job.active = true;
        _activeJobIndex[jobId] = _activeJobIds.length;
        _activeJobIds.push(jobId);
        emit JobResumed(jobId);
    }

    /// @inheritdoc IJobRegistry
    function cancelJob(uint256 jobId) external nonReentrant {
        Job storage job = _jobs[jobId];
        if (job.owner == address(0)) revert JobNotFound(jobId);
        if (job.owner != msg.sender) revert NotJobOwner(jobId);

        uint256 refund = job.budget;

        // CEI: clear state before transfer
        job.budget = 0;
        job.active = false;
        _removeFromActive(jobId);

        if (refund > 0) {
            // _locked == 2 here, reentrancy protected
            (bool sent,) = msg.sender.call{value: refund}("");
            require(sent, "refund failed");
        }

        emit JobCancelled(jobId, refund);
    }

    /// @inheritdoc IJobRegistry
    function updateCallData(uint256 jobId, bytes calldata newCallData) external {
        Job storage job = _jobs[jobId];
        if (job.owner == address(0)) revert JobNotFound(jobId);
        if (job.owner != msg.sender) revert NotJobOwner(jobId);

        job.callData = newCallData;
        emit CallDataUpdated(jobId);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    /// @inheritdoc IJobRegistry
    function getJob(uint256 jobId) external view returns (Job memory) {
        return _jobs[jobId];
    }

    /// @inheritdoc IJobRegistry
    function getInputSources(uint256 jobId) external view returns (InputSource[] memory) {
        return _jobInputs[jobId];
    }

    /// @inheritdoc IJobRegistry
    function getActiveJobs() external view returns (uint256[] memory) {
        return _activeJobIds;
    }

    /// @inheritdoc IJobRegistry
    function nextJobId() external view returns (uint256) {
        return _nextJobId;
    }

    /// @inheritdoc IJobRegistry
    function protocolFeeRate() external pure returns (uint256) {
        return PROTOCOL_FEE_RATE;
    }

    // ─── Protocol Owner ──────────────────────────────────────────────────────

    function withdrawFees(address to) external {
        require(msg.sender == owner, "not owner");
        require(to != address(0), "zero address");
        uint256 amount = accumulatedFees;
        accumulatedFees = 0;
        // accumulatedFees already zeroed (CEI), reentrancy safe
        (bool sent,) = to.call{value: amount}("");
        require(sent, "withdraw failed");
    }

    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "not owner");
        require(newOwner != address(0), "zero address");
        pendingOwner = newOwner;
        emit OwnershipTransferred(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "not pending owner");
        address previous = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(previous, owner);
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _canExecute(uint256 jobId) internal view returns (bool) {
        Job storage job = _jobs[jobId];
        if (job.owner == address(0)) return false;
        if (!job.active)             return false;
        if (job.budget < job.feePerRun) return false;
        if (block.timestamp < job.lastRun + job.cooldown) return false;

        // Resolve inputs and evaluate circuit
        InputSource[] storage sources = _jobInputs[jobId];
        InputSource[] memory sourcesMem = new InputSource[](sources.length);
        for (uint256 i = 0; i < sources.length; i++) {
            sourcesMem[i] = sources[i];
        }

        bytes memory input = resolver.resolve(sourcesMem);
        bytes memory output = ITapeOutProcessor(job.processor).eval(job.circuitId, input);

        if (output.length == 0) return false;

        uint8 outputPin = job.outputPin;
        return (uint8(output[outputPin / 8]) >> (outputPin % 8)) & 1 == 1;
    }

    function _removeFromActive(uint256 jobId) internal {
        uint256 index = _activeJobIndex[jobId];
        uint256 lastId = _activeJobIds[_activeJobIds.length - 1];

        _activeJobIds[index] = lastId;
        _activeJobIndex[lastId] = index;
        _activeJobIds.pop();

        delete _activeJobIndex[jobId];
    }

    // ─── Receive ─────────────────────────────────────────────────────────────

    receive() external payable {}
}
