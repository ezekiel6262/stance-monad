// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/StanceMarket.sol";
import "../src/StancePortfolio.sol";

interface Vm { function envAddress(string calldata) external returns (address); function startBroadcast() external; function stopBroadcast() external; }

contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant MONAD_USDC = 0x754704Bc059F8C67012fEd69BC8A327a5aafb603;

    function run() external returns (StanceMarket market, StancePortfolio portfolio) {
        address collateral = vm.envAddress("COLLATERAL_TOKEN_ADDRESS");
        address resolver = vm.envAddress("RESOLVER_ADDRESS");
        address owner = vm.envAddress("TREASURY_MULTISIG_ADDRESS");
        require(block.chainid == 143, "MONAD_ONLY");
        require(collateral == MONAD_USDC, "USDC_ONLY");
        vm.startBroadcast();
        market = new StanceMarket(collateral, resolver, owner);
        portfolio = new StancePortfolio();
        vm.stopBroadcast();
    }
}
