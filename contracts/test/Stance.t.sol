// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/StanceMarket.sol";
import "../src/StancePortfolio.sol";
import "../src/StancePortfolioRegistry.sol";

interface VmTest {
    function warp(uint256) external;
    function prank(address) external;
    function expectRevert(bytes calldata) external;
}

contract MockCollateral {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
    function transfer(address to, uint256 amount) external returns (bool) { _move(msg.sender, to, amount); return true; }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 approved = allowance[from][msg.sender];
        require(approved >= amount, "ALLOWANCE");
        allowance[from][msg.sender] = approved - amount;
        _move(from, to, amount);
        return true;
    }
    function _move(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "BALANCE");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

contract StanceTest {
    VmTest private constant vm = VmTest(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant BACKER = address(0xBACC);
    address private constant FADER = address(0xFADE);
    MockCollateral private token;
    StanceMarket private market;

    function setUp() public {
        token = new MockCollateral();
        market = new StanceMarket(address(token), address(this), address(this));
        token.mint(BACKER, 100e6);
        token.mint(FADER, 300e6);
        vm.prank(BACKER); token.approve(address(market), type(uint256).max);
        vm.prank(FADER); token.approve(address(market), type(uint256).max);
    }

    function testPariMutuelPayoutsConserveCollateral() public {
        uint256 id = market.createMarket(keccak256("thesis"), uint64(block.timestamp + 1 hours));
        vm.prank(BACKER); market.takePosition(id, true, 100e6);
        vm.prank(FADER); market.takePosition(id, false, 300e6);
        vm.warp(block.timestamp + 1 hours);
        market.resolve(id, StanceMarket.Outcome.Back);
        vm.prank(BACKER); uint256 payout = market.claim(id);
        require(payout == 400e6, "PAYOUT");
        require(token.balanceOf(address(market)) == 0, "DUST");
    }

    function testCannotResolveToEmptyWinningPool() public {
        uint256 id = market.createMarket(keccak256("thesis"), uint64(block.timestamp + 1));
        vm.prank(BACKER); market.takePosition(id, true, 1e6);
        vm.warp(block.timestamp + 1);
        vm.expectRevert(bytes("EMPTY_WINNING_POOL"));
        market.resolve(id, StanceMarket.Outcome.Fade);
    }

    function testCancellationRefundsBothSides() public {
        uint256 id = market.createMarket(keccak256("cancelled"), uint64(block.timestamp + 1));
        vm.prank(BACKER); market.takePosition(id, true, 40e6);
        vm.prank(FADER); market.takePosition(id, false, 60e6);
        vm.warp(block.timestamp + 1);
        market.resolve(id, StanceMarket.Outcome.Cancelled);
        vm.prank(BACKER); require(market.claim(id) == 40e6, "BACK_REFUND");
        vm.prank(FADER); require(market.claim(id) == 60e6, "FADE_REFUND");
        require(token.balanceOf(address(market)) == 0, "REFUND_DUST");
    }

    function testOwnershipRequiresAcceptance() public {
        address next = address(0xA11CE);
        market.transferOwnership(next);
        require(market.owner() == address(this), "EARLY_TRANSFER");
        vm.prank(next); market.acceptOwnership();
        require(market.owner() == next, "OWNER");
    }

    function testPortfolioProofAndTail() public {
        StancePortfolio portfolio = new StancePortfolio();
        bytes32 id = keccak256("stance");
        portfolio.publishProofStance(id, keccak256("thesis"), address(token), 1e6, uint64(block.timestamp + 1 days), "ipfs://proof");
        vm.prank(BACKER); portfolio.recordTail(address(this), id, 1e6);
        require(portfolio.authors(id) == address(this), "AUTHOR");
    }

    function testAuthorCannotTailOwnStance() public {
        StancePortfolio portfolio = new StancePortfolio();
        bytes32 id = keccak256("self-tail");
        portfolio.publishProofStance(id, keccak256("thesis"), address(token), 1e6, uint64(block.timestamp + 1 days), "ipfs://proof");
        vm.expectRevert(bytes("INVALID_TAIL"));
        portfolio.recordTail(address(this), id, 1e6);
    }

    function testTrailPortfolioPreservesLineage() public {
        StancePortfolioRegistry registry = new StancePortfolioRegistry();
        bytes32 source = keccak256("source-portfolio");
        bytes32 trail = keccak256("trail-portfolio");
        bytes32 stanceId = keccak256("source-stance");
        registry.publishPortfolio(source, keccak256("stance"), keccak256("source-allocation"), "ipfs://source");
        vm.prank(BACKER);
        registry.publishTrailPortfolio(trail, source, stanceId, keccak256("plan"), keccak256("trail-allocation"), 100e6, 2, "ipfs://trail");
        (address owner,, , bytes32 parent, bytes32 linkedStance,) = registry.portfolios(trail);
        require(owner == BACKER, "TRAIL_OWNER");
        require(parent == source && linkedStance == stanceId, "LINEAGE");
    }

    function testCannotTrailOwnPortfolio() public {
        StancePortfolioRegistry registry = new StancePortfolioRegistry();
        bytes32 source = keccak256("self-source");
        registry.publishPortfolio(source, keccak256("stance"), keccak256("allocation"), "ipfs://source");
        vm.expectRevert(bytes("SELF_TRAIL"));
        registry.publishTrailPortfolio(keccak256("trail"), source, keccak256("stance-id"), keccak256("plan"), keccak256("allocation-2"), 1e6, 2, "ipfs://trail");
    }
}
