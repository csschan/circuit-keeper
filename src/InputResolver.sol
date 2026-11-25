// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IInputAdapter} from "./interfaces/IInputAdapter.sol";
import {IJobRegistry} from "./interfaces/IJobRegistry.sol";
import {ITapeOutProcessor} from "./interfaces/ITapeOutProcessor.sol";

import {PriceFeedAdapter} from "./adapters/PriceFeedAdapter.sol";
import {BalanceAdapter} from "./adapters/BalanceAdapter.sol";
import {TimestampAdapter} from "./adapters/TimestampAdapter.sol";
import {StaticCallAdapter} from "./adapters/StaticCallAdapter.sol";
import {CircuitAdapter} from "./adapters/CircuitAdapter.sol";

/// @title InputResolver
/// @notice Resolves an array of InputSources into a bit-packed bytes value
///         ready to pass to TapeOut's eval()
contract InputResolver {
    PriceFeedAdapter  public immutable priceFeedAdapter;
    BalanceAdapter    public immutable balanceAdapter;
    TimestampAdapter  public immutable timestampAdapter;
    StaticCallAdapter public immutable staticCallAdapter;
    CircuitAdapter    public immutable circuitAdapter;

    constructor() {
        priceFeedAdapter  = new PriceFeedAdapter();
        balanceAdapter    = new BalanceAdapter();
        timestampAdapter  = new TimestampAdapter();
        staticCallAdapter = new StaticCallAdapter();
        circuitAdapter    = new CircuitAdapter();
    }

    /// @notice Resolve all input sources and pack results into bytes for eval()
    /// @param sources Array of InputSource structs (length must equal circuit's nIn)
    /// @return packed  Bit-packed bytes (LSB first): pin[i] → byte[i/8] bit(i%8)
    function resolve(IJobRegistry.InputSource[] memory sources)
        external
        view
        returns (bytes memory packed)
    {
        uint256 len = sources.length;
        if (len == 0) return new bytes(0);

        uint256 byteLen = (len + 7) / 8;
        packed = new bytes(byteLen);

        for (uint256 i = 0; i < len; i++) {
            if (_resolveOne(sources[i])) {
                packed[i / 8] = bytes1(uint8(packed[i / 8]) | uint8(1 << (i % 8)));
            }
        }
    }

    /// @notice Resolve a single input source (useful for debugging / UI)
    function resolveOne(IJobRegistry.InputSource memory source)
        external
        view
        returns (bool bit)
    {
        return _resolveOne(source);
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _resolveOne(IJobRegistry.InputSource memory source)
        internal
        view
        returns (bool)
    {
        IJobRegistry.InputType t = source.inputType;

        if (t == IJobRegistry.InputType.PRICE_ABOVE) {
            bytes memory data = abi.encode(true); // aboveNotBelow = true
            return priceFeedAdapter.resolve(source.target, source.threshold, data);
        }

        if (t == IJobRegistry.InputType.PRICE_BELOW) {
            bytes memory data = abi.encode(false); // aboveNotBelow = false
            return priceFeedAdapter.resolve(source.target, source.threshold, data);
        }

        if (t == IJobRegistry.InputType.ERC20_BALANCE_ABOVE) {
            // source.data = abi.encode(address account)
            (address account) = abi.decode(source.data, (address));
            bytes memory data = abi.encode(account, true); // aboveNotBelow = true
            return balanceAdapter.resolve(source.target, source.threshold, data);
        }

        if (t == IJobRegistry.InputType.ERC20_BALANCE_BELOW) {
            (address account) = abi.decode(source.data, (address));
            bytes memory data = abi.encode(account, false);
            return balanceAdapter.resolve(source.target, source.threshold, data);
        }

        if (t == IJobRegistry.InputType.TIMESTAMP_MOD) {
            // source.threshold = period (seconds)
            // source.data = abi.encode(uint256 window)
            (uint256 window) = abi.decode(source.data, (uint256));
            bytes memory data = abi.encode(window, true); // moduloNotAfter = true
            return timestampAdapter.resolve(address(0), source.threshold, data);
        }

        if (t == IJobRegistry.InputType.STATIC_CALL) {
            // source.target = contract to call
            // source.data   = raw calldata
            return staticCallAdapter.resolve(source.target, 0, source.data);
        }

        if (t == IJobRegistry.InputType.CIRCUIT_OUTPUT) {
            // source.target    = sub-processor address
            // source.threshold = sub-circuit ID
            // source.data      = input bytes for sub-circuit
            return circuitAdapter.resolve(source.target, source.threshold, source.data);
        }

        return false;
    }
}
