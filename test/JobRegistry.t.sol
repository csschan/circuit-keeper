// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {JobRegistry}   from "../src/JobRegistry.sol";
import {IJobRegistry}  from "../src/interfaces/IJobRegistry.sol";
import {MockProcessor} from "./mocks/MockProcessor.sol";
import {MockPriceFeed} from "./mocks/MockPriceFeed.sol";
import {MockTarget}    from "./mocks/MockTarget.sol";

contract JobRegistryTest is Test {
    JobRegistry   registry;
    MockProcessor processor;
    MockPriceFeed priceFeed;
    MockTarget    target;

    address owner  = address(0x1);
    address keeper = address(0x2);
    address alice  = address(0x3);

    uint256 constant CIRCUIT_ID   = 1;
    uint256 constant FEE_PER_RUN  = 0.001 ether;
    uint256 constant COOLDOWN     = 1 hours;
    uint256 constant GAS_LIMIT    = 200_000;
    uint256 constant INITIAL_BUDGET = 0.1 ether;

    // ─── Setup ───────────────────────────────────────────────────────────────

    function setUp() public {
        // Start at a realistic timestamp so cooldown checks (lastRun=0 + cooldown) pass
        vm.warp(1_700_000_000);

        vm.startPrank(owner);
        registry  = new JobRegistry(owner);
        vm.stopPrank();

        processor = new MockProcessor();
        priceFeed = new MockPriceFeed(2000_0000_0000, 8); // $2000 with 8 decimals
        target    = new MockTarget();

        vm.deal(alice, 10 ether);
        vm.deal(keeper, 1 ether);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    function _makeTimestampInputs() internal view returns (IJobRegistry.InputSource[] memory) {
        IJobRegistry.InputSource[] memory inputs = new IJobRegistry.InputSource[](1);
        inputs[0] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.TIMESTAMP_MOD,
            target:    address(0),
            threshold: 1 days,       // period = 1 day
            data:      abi.encode(uint256(1 hours), true) // window = 1h, modulo mode
        });
        return inputs;
    }

    function _makeStaticCallInputs(bool returnValue) internal returns (IJobRegistry.InputSource[] memory) {
        // Deploy a simple bool-returning contract
        BoolReturnMock mock = new BoolReturnMock(returnValue);
        IJobRegistry.InputSource[] memory inputs = new IJobRegistry.InputSource[](1);
        inputs[0] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.STATIC_CALL,
            target:    address(mock),
            threshold: 0,
            data:      abi.encodeWithSelector(BoolReturnMock.check.selector)
        });
        return inputs;
    }

    function _registerJob(
        IJobRegistry.InputSource[] memory inputs,
        uint256 budget
    ) internal returns (uint256 jobId) {
        bytes memory callData = abi.encodeWithSelector(MockTarget.execute.selector, bytes(""));

        vm.prank(alice);
        jobId = registry.registerJob{value: budget}(
            address(processor),
            CIRCUIT_ID,
            uint8(inputs.length),
            0,            // outputPin
            inputs,
            address(target),
            callData,
            GAS_LIMIT,
            FEE_PER_RUN,
            COOLDOWN
        );
    }

    // ─── registerJob ─────────────────────────────────────────────────────────

    function test_registerJob_success() public {
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeTimestampInputs();
        uint256 jobId = _registerJob(inputs, INITIAL_BUDGET);

        assertEq(jobId, 0);
        IJobRegistry.Job memory job = registry.getJob(jobId);
        assertEq(job.owner,     alice);
        assertEq(job.processor, address(processor));
        assertEq(job.circuitId, CIRCUIT_ID);
        assertEq(job.budget,    INITIAL_BUDGET);
        assertTrue(job.active);
    }

    function test_registerJob_emitsEvent() public {
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeTimestampInputs();
        bytes memory callData = abi.encodeWithSelector(MockTarget.execute.selector, bytes(""));

        vm.expectEmit(true, true, false, true);
        emit IJobRegistry.JobRegistered(0, alice, address(processor), CIRCUIT_ID);

        vm.prank(alice);
        registry.registerJob{value: INITIAL_BUDGET}(
            address(processor), CIRCUIT_ID, 1, 0,
            inputs, address(target), callData, GAS_LIMIT, FEE_PER_RUN, COOLDOWN
        );
    }

    function test_registerJob_revertsOnNInMismatch() public {
        IJobRegistry.InputSource[] memory inputs = _makeTimestampInputs(); // length = 1
        bytes memory callData = abi.encodeWithSelector(MockTarget.execute.selector, bytes(""));

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IJobRegistry.InvalidNIn.selector, 2, 1));
        registry.registerJob{value: INITIAL_BUDGET}(
            address(processor), CIRCUIT_ID,
            2,  // nIn=2 but inputs has 1 element
            0, inputs, address(target), callData, GAS_LIMIT, FEE_PER_RUN, COOLDOWN
        );
    }

    function test_registerJob_revertsOnLowFee() public {
        IJobRegistry.InputSource[] memory inputs = _makeTimestampInputs();
        bytes memory callData = abi.encodeWithSelector(MockTarget.execute.selector, bytes(""));

        vm.prank(alice);
        vm.expectRevert(IJobRegistry.InvalidFeePerRun.selector);
        registry.registerJob{value: INITIAL_BUDGET}(
            address(processor), CIRCUIT_ID, 1, 0,
            inputs, address(target), callData, GAS_LIMIT,
            1,  // feePerRun too low
            COOLDOWN
        );
    }

    // ─── checkUpkeep ─────────────────────────────────────────────────────────

    function test_checkUpkeep_returnsTrueWhenConditionMet() public {
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);
        uint256 jobId = _registerJob(inputs, INITIAL_BUDGET);

        assertTrue(registry.checkUpkeep(jobId));
    }

    function test_checkUpkeep_returnsFalseWhenCircuitOutputFalse() public {
        processor.setOutputBit(CIRCUIT_ID, false);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);
        uint256 jobId = _registerJob(inputs, INITIAL_BUDGET);

        assertFalse(registry.checkUpkeep(jobId));
    }

    function test_checkUpkeep_returnsFalseInCooldown() public {
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);
        uint256 jobId = _registerJob(inputs, INITIAL_BUDGET);

        // Execute once
        vm.prank(keeper);
        registry.executeJob(jobId);

        // Still in cooldown
        assertFalse(registry.checkUpkeep(jobId));

        // Advance past cooldown
        vm.warp(block.timestamp + COOLDOWN + 1);
        assertTrue(registry.checkUpkeep(jobId));
    }

    function test_checkUpkeep_returnsFalseWhenPaused() public {
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);
        uint256 jobId = _registerJob(inputs, INITIAL_BUDGET);

        vm.prank(alice);
        registry.pauseJob(jobId);

        assertFalse(registry.checkUpkeep(jobId));
    }

    // ─── executeJob ──────────────────────────────────────────────────────────

    function test_executeJob_callsTarget() public {
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);
        uint256 jobId = _registerJob(inputs, INITIAL_BUDGET);

        assertEq(target.callCount(), 0);

        vm.prank(keeper);
        registry.executeJob(jobId);

        assertEq(target.callCount(), 1);
    }

    function test_executeJob_paysKeeper() public {
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);
        uint256 jobId = _registerJob(inputs, INITIAL_BUDGET);

        uint256 keeperBefore = keeper.balance;
        vm.prank(keeper);
        registry.executeJob(jobId);

        uint256 expectedKeeperFee = FEE_PER_RUN * 80 / 100;
        assertEq(keeper.balance - keeperBefore, expectedKeeperFee);
    }

    function test_executeJob_chargesProtocolFee() public {
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);
        uint256 jobId = _registerJob(inputs, INITIAL_BUDGET);

        vm.prank(keeper);
        registry.executeJob(jobId);

        uint256 expectedProtocolFee = FEE_PER_RUN * 20 / 100;
        assertEq(registry.accumulatedFees(), expectedProtocolFee);
    }

    function test_executeJob_deductsBudget() public {
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);
        uint256 jobId = _registerJob(inputs, INITIAL_BUDGET);

        vm.prank(keeper);
        registry.executeJob(jobId);

        IJobRegistry.Job memory job = registry.getJob(jobId);
        assertEq(job.budget, INITIAL_BUDGET - FEE_PER_RUN);
    }

    function test_executeJob_emitsEvent() public {
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);
        uint256 jobId = _registerJob(inputs, INITIAL_BUDGET);

        vm.expectEmit(true, true, false, false);
        emit IJobRegistry.JobExecuted(jobId, keeper, block.timestamp);

        vm.prank(keeper);
        registry.executeJob(jobId);
    }

    function test_executeJob_revertsWhenConditionNotMet() public {
        processor.setOutputBit(CIRCUIT_ID, false);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);
        uint256 jobId = _registerJob(inputs, INITIAL_BUDGET);

        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(IJobRegistry.ConditionNotMet.selector, jobId));
        registry.executeJob(jobId);
    }

    function test_executeJob_revertsWhenTargetReverts() public {
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);
        uint256 jobId = _registerJob(inputs, INITIAL_BUDGET);

        target.setShouldRevert(true, "target failure");

        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(IJobRegistry.TargetCallFailed.selector, jobId));
        registry.executeJob(jobId);
    }

    function test_executeJob_autoPausesOnLowBudget() public {
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);

        // Budget for exactly 1 run
        uint256 jobId = _registerJob(inputs, FEE_PER_RUN);

        vm.prank(keeper);
        registry.executeJob(jobId);

        IJobRegistry.Job memory job = registry.getJob(jobId);
        assertFalse(job.active);
    }

    // ─── topUpBudget ─────────────────────────────────────────────────────────

    function test_topUpBudget_increasesBudget() public {
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);
        uint256 jobId = _registerJob(inputs, FEE_PER_RUN);

        // Execute (auto-pauses)
        vm.prank(keeper);
        registry.executeJob(jobId);
        assertFalse(registry.getJob(jobId).active);

        // Top up and re-activate
        vm.prank(alice);
        registry.topUpBudget{value: 0.1 ether}(jobId);

        IJobRegistry.Job memory job = registry.getJob(jobId);
        assertTrue(job.active);
        assertEq(job.budget, 0.1 ether);
    }

    // ─── pauseJob / resumeJob ─────────────────────────────────────────────────

    function test_pauseResume() public {
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);
        uint256 jobId = _registerJob(inputs, INITIAL_BUDGET);

        vm.prank(alice);
        registry.pauseJob(jobId);
        assertFalse(registry.getJob(jobId).active);

        vm.prank(alice);
        registry.resumeJob(jobId);
        assertTrue(registry.getJob(jobId).active);
    }

    function test_pauseJob_revertsIfNotOwner() public {
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);
        uint256 jobId = _registerJob(inputs, INITIAL_BUDGET);

        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(IJobRegistry.NotJobOwner.selector, jobId));
        registry.pauseJob(jobId);
    }

    // ─── cancelJob ───────────────────────────────────────────────────────────

    function test_cancelJob_refundsBudget() public {
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);
        uint256 jobId = _registerJob(inputs, INITIAL_BUDGET);

        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        registry.cancelJob(jobId);

        assertEq(alice.balance - aliceBefore, INITIAL_BUDGET);
        assertFalse(registry.getJob(jobId).active);
    }

    function test_cancelJob_revertsIfNotOwner() public {
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);
        uint256 jobId = _registerJob(inputs, INITIAL_BUDGET);

        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(IJobRegistry.NotJobOwner.selector, jobId));
        registry.cancelJob(jobId);
    }

    // ─── updateCallData ───────────────────────────────────────────────────────

    function test_updateCallData() public {
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);
        uint256 jobId = _registerJob(inputs, INITIAL_BUDGET);

        bytes memory newCallData = abi.encodeWithSelector(MockTarget.execute.selector, bytes("new"));
        vm.prank(alice);
        registry.updateCallData(jobId, newCallData);

        assertEq(registry.getJob(jobId).callData, newCallData);
    }

    // ─── getActiveJobs ────────────────────────────────────────────────────────

    function test_getActiveJobs_tracksCorrectly() public {
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);

        uint256 job0 = _registerJob(inputs, INITIAL_BUDGET);
        uint256 job1 = _registerJob(inputs, INITIAL_BUDGET);
        uint256 job2 = _registerJob(inputs, INITIAL_BUDGET);

        uint256[] memory active = registry.getActiveJobs();
        assertEq(active.length, 3);

        // Cancel middle job
        vm.prank(alice);
        registry.cancelJob(job1);

        active = registry.getActiveJobs();
        assertEq(active.length, 2);
        // job0 and job2 should still be there
        bool foundJob0;
        bool foundJob2;
        for (uint256 i = 0; i < active.length; i++) {
            if (active[i] == job0) foundJob0 = true;
            if (active[i] == job2) foundJob2 = true;
        }
        assertTrue(foundJob0);
        assertTrue(foundJob2);
    }

    // ─── withdrawFees ─────────────────────────────────────────────────────────

    function test_withdrawFees() public {
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);
        uint256 jobId = _registerJob(inputs, INITIAL_BUDGET);

        vm.prank(keeper);
        registry.executeJob(jobId);

        uint256 fees = registry.accumulatedFees();
        assertTrue(fees > 0);

        uint256 ownerBefore = owner.balance;
        vm.prank(owner);
        registry.withdrawFees(owner);

        assertEq(owner.balance - ownerBefore, fees);
        assertEq(registry.accumulatedFees(), 0);
    }

    // ─── Fuzz ─────────────────────────────────────────────────────────────────

    function testFuzz_registerAndExecute(uint96 budget, uint96 fee) public {
        fee    = uint96(bound(fee,    0.0001 ether, 1 ether));
        budget = uint96(bound(budget, fee,          10 ether));

        vm.deal(alice, budget);
        processor.setOutputBit(CIRCUIT_ID, true);
        IJobRegistry.InputSource[] memory inputs = _makeStaticCallInputs(true);
        bytes memory callData = abi.encodeWithSelector(MockTarget.execute.selector, bytes(""));

        vm.prank(alice);
        uint256 jobId = registry.registerJob{value: budget}(
            address(processor), CIRCUIT_ID, 1, 0,
            inputs, address(target), callData, GAS_LIMIT, fee, COOLDOWN
        );

        vm.prank(keeper);
        registry.executeJob(jobId);

        assertEq(target.callCount(), 1);
    }
}

// ─── Helper contract ──────────────────────────────────────────────────────────

contract BoolReturnMock {
    bool private _value;
    constructor(bool value) { _value = value; }
    function check() external view returns (bool) { return _value; }
}
