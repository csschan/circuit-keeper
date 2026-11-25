// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test}           from "forge-std/Test.sol";
import {InputResolver}  from "../src/InputResolver.sol";
import {IJobRegistry}   from "../src/interfaces/IJobRegistry.sol";
import {MockProcessor}  from "./mocks/MockProcessor.sol";
import {MockPriceFeed}  from "./mocks/MockPriceFeed.sol";

contract InputResolverTest is Test {
    InputResolver resolver;
    MockPriceFeed priceFeed;
    MockProcessor processor;

    function setUp() public {
        vm.warp(1_700_000_000);
        resolver  = new InputResolver();
        priceFeed = new MockPriceFeed(2000_0000_0000, 8); // $2000
        processor = new MockProcessor();
    }

    // ─── PRICE_ABOVE ─────────────────────────────────────────────────────────

    function test_priceAbove_returnsTrueWhenAbove() public view {
        IJobRegistry.InputSource[] memory sources = new IJobRegistry.InputSource[](1);
        sources[0] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.PRICE_ABOVE,
            target:    address(priceFeed),
            threshold: 1500_0000_0000, // $1500
            data:      ""
        });

        bytes memory packed = resolver.resolve(sources);
        assertEq(packed.length, 1);
        assertTrue((uint8(packed[0]) & 0x01) == 1); // bit 0 = true
    }

    function test_priceAbove_returnsFalseWhenBelow() public view {
        IJobRegistry.InputSource[] memory sources = new IJobRegistry.InputSource[](1);
        sources[0] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.PRICE_ABOVE,
            target:    address(priceFeed),
            threshold: 2500_0000_0000, // $2500 (price is $2000)
            data:      ""
        });

        bytes memory packed = resolver.resolve(sources);
        assertTrue((uint8(packed[0]) & 0x01) == 0); // bit 0 = false
    }

    // ─── PRICE_BELOW ─────────────────────────────────────────────────────────

    function test_priceBelow_returnsTrueWhenBelow() public view {
        IJobRegistry.InputSource[] memory sources = new IJobRegistry.InputSource[](1);
        sources[0] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.PRICE_BELOW,
            target:    address(priceFeed),
            threshold: 2500_0000_0000, // $2500
            data:      ""
        });

        bytes memory packed = resolver.resolve(sources);
        assertTrue((uint8(packed[0]) & 0x01) == 1);
    }

    // ─── TIMESTAMP_MOD ───────────────────────────────────────────────────────

    function test_timestampMod_returnsTrueInWindow() public {
        // Set timestamp to 10 seconds into a day
        vm.warp(10);

        IJobRegistry.InputSource[] memory sources = new IJobRegistry.InputSource[](1);
        sources[0] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.TIMESTAMP_MOD,
            target:    address(0),
            threshold: 1 days,
            data:      abi.encode(uint256(1 hours), true)
        });

        bytes memory packed = resolver.resolve(sources);
        assertTrue((uint8(packed[0]) & 0x01) == 1);
    }

    function test_timestampMod_returnsFalseOutsideWindow() public {
        // Set timestamp to 2 hours into a day (outside 1-hour window)
        vm.warp(2 hours + 1);

        IJobRegistry.InputSource[] memory sources = new IJobRegistry.InputSource[](1);
        sources[0] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.TIMESTAMP_MOD,
            target:    address(0),
            threshold: 1 days,
            data:      abi.encode(uint256(1 hours), true)
        });

        bytes memory packed = resolver.resolve(sources);
        assertTrue((uint8(packed[0]) & 0x01) == 0);
    }

    // ─── STATIC_CALL ─────────────────────────────────────────────────────────

    function test_staticCall_returnsTrueWhenCallReturnsTrue() public {
        BoolMock mock = new BoolMock(true);

        IJobRegistry.InputSource[] memory sources = new IJobRegistry.InputSource[](1);
        sources[0] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.STATIC_CALL,
            target:    address(mock),
            threshold: 0,
            data:      abi.encodeWithSelector(BoolMock.value.selector)
        });

        bytes memory packed = resolver.resolve(sources);
        assertTrue((uint8(packed[0]) & 0x01) == 1);
    }

    // ─── CIRCUIT_OUTPUT ──────────────────────────────────────────────────────

    function test_circuitOutput_returnsTrueWhenSubCircuitTrue() public {
        processor.setOutputBit(42, true);

        IJobRegistry.InputSource[] memory sources = new IJobRegistry.InputSource[](1);
        sources[0] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.CIRCUIT_OUTPUT,
            target:    address(processor),
            threshold: 42,
            data:      ""
        });

        bytes memory packed = resolver.resolve(sources);
        assertTrue((uint8(packed[0]) & 0x01) == 1);
    }

    // ─── Multi-pin bit packing ────────────────────────────────────────────────

    function test_multiPin_packingCorrect() public {
        // 3 inputs: [true, false, true] → byte 0 = 0b00000101 = 0x05
        BoolMock mockTrue  = new BoolMock(true);
        BoolMock mockFalse = new BoolMock(false);

        IJobRegistry.InputSource[] memory sources = new IJobRegistry.InputSource[](3);
        sources[0] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.STATIC_CALL,
            target: address(mockTrue), threshold: 0,
            data: abi.encodeWithSelector(BoolMock.value.selector)
        });
        sources[1] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.STATIC_CALL,
            target: address(mockFalse), threshold: 0,
            data: abi.encodeWithSelector(BoolMock.value.selector)
        });
        sources[2] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.STATIC_CALL,
            target: address(mockTrue), threshold: 0,
            data: abi.encodeWithSelector(BoolMock.value.selector)
        });

        bytes memory packed = resolver.resolve(sources);
        assertEq(packed.length, 1);
        assertEq(uint8(packed[0]), 0x05); // 0b00000101
    }

    function test_ninePins_spansTwoBytes() public {
        // 9 inputs all true → 0xFF 0x01
        BoolMock mockTrue = new BoolMock(true);
        IJobRegistry.InputSource[] memory sources = new IJobRegistry.InputSource[](9);
        for (uint256 i = 0; i < 9; i++) {
            sources[i] = IJobRegistry.InputSource({
                inputType: IJobRegistry.InputType.STATIC_CALL,
                target: address(mockTrue), threshold: 0,
                data: abi.encodeWithSelector(BoolMock.value.selector)
            });
        }

        bytes memory packed = resolver.resolve(sources);
        assertEq(packed.length, 2);
        assertEq(uint8(packed[0]), 0xFF); // bits 0-7 all true
        assertEq(uint8(packed[1]), 0x01); // bit 8 = true
    }

    // ─── Stale price reverts ──────────────────────────────────────────────────

    function test_stalePrice_reverts() public {
        priceFeed.setStale(2 hours); // older than 1h staleness threshold

        IJobRegistry.InputSource[] memory sources = new IJobRegistry.InputSource[](1);
        sources[0] = IJobRegistry.InputSource({
            inputType: IJobRegistry.InputType.PRICE_ABOVE,
            target:    address(priceFeed),
            threshold: 1500_0000_0000,
            data:      ""
        });

        vm.expectRevert();
        resolver.resolve(sources);
    }
}

contract BoolMock {
    bool private _v;
    constructor(bool v) { _v = v; }
    function value() external view returns (bool) { return _v; }
}
