// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Stance {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/// @notice Minimal pari-mutuel Stance escrow. This code must be independently audited before mainnet use.
contract StanceMarket {
    enum Outcome { Unresolved, Back, Fade, Cancelled }

    struct Market {
        bytes32 thesisHash;
        uint64 closesAt;
        Outcome outcome;
        uint256 backPool;
        uint256 fadePool;
    }

    IERC20Stance public immutable collateral;
    address public owner;
    address public pendingOwner;
    address public resolver;
    uint256 public marketCount;
    uint256 private locked = 1;

    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => uint256)) public backStake;
    mapping(uint256 => mapping(address => uint256)) public fadeStake;
    mapping(uint256 => mapping(address => bool)) public claimed;

    event MarketCreated(uint256 indexed marketId, bytes32 indexed thesisHash, uint64 closesAt);
    event PositionTaken(uint256 indexed marketId, address indexed account, bool back, uint256 amount);
    event MarketResolved(uint256 indexed marketId, Outcome outcome);
    event Claimed(uint256 indexed marketId, address indexed account, uint256 amount);
    event ResolverChanged(address indexed resolver);
    event OwnershipTransferred(address indexed owner);
    event OwnershipTransferStarted(address indexed currentOwner, address indexed pendingOwner);

    modifier onlyOwner() { require(msg.sender == owner, "OWNER"); _; }
    modifier onlyResolver() { require(msg.sender == resolver, "RESOLVER"); _; }
    modifier nonReentrant() { require(locked == 1, "REENTRANCY"); locked = 2; _; locked = 1; }

    constructor(address collateral_, address resolver_, address owner_) {
        require(collateral_ != address(0) && resolver_ != address(0) && owner_ != address(0), "ZERO_ADDRESS");
        collateral = IERC20Stance(collateral_);
        resolver = resolver_;
        owner = owner_;
    }

    function createMarket(bytes32 thesisHash, uint64 closesAt) external onlyOwner returns (uint256 marketId) {
        require(thesisHash != bytes32(0) && closesAt > block.timestamp, "INVALID_MARKET");
        marketId = ++marketCount;
        markets[marketId] = Market(thesisHash, closesAt, Outcome.Unresolved, 0, 0);
        emit MarketCreated(marketId, thesisHash, closesAt);
    }

    function takePosition(uint256 marketId, bool back, uint256 amount) external nonReentrant {
        Market storage market = markets[marketId];
        require(market.thesisHash != bytes32(0) && market.outcome == Outcome.Unresolved, "INACTIVE");
        require(block.timestamp < market.closesAt && amount > 0, "CLOSED_OR_ZERO");
        uint256 balanceBefore = collateral.balanceOf(address(this));
        require(collateral.transferFrom(msg.sender, address(this), amount), "TRANSFER_IN");
        require(collateral.balanceOf(address(this)) - balanceBefore == amount, "UNSUPPORTED_COLLATERAL");
        if (back) { backStake[marketId][msg.sender] += amount; market.backPool += amount; }
        else { fadeStake[marketId][msg.sender] += amount; market.fadePool += amount; }
        emit PositionTaken(marketId, msg.sender, back, amount);
    }

    function resolve(uint256 marketId, Outcome outcome) external onlyResolver {
        Market storage market = markets[marketId];
        require(market.outcome == Outcome.Unresolved && block.timestamp >= market.closesAt, "NOT_RESOLVABLE");
        require(outcome != Outcome.Unresolved, "INVALID_OUTCOME");
        require(outcome == Outcome.Cancelled || (outcome == Outcome.Back ? market.backPool > 0 : market.fadePool > 0), "EMPTY_WINNING_POOL");
        market.outcome = outcome;
        emit MarketResolved(marketId, outcome);
    }

    function claim(uint256 marketId) external nonReentrant returns (uint256 payout) {
        Market storage market = markets[marketId];
        require(market.outcome != Outcome.Unresolved && !claimed[marketId][msg.sender], "NOT_CLAIMABLE");
        claimed[marketId][msg.sender] = true;
        uint256 back = backStake[marketId][msg.sender];
        uint256 fade = fadeStake[marketId][msg.sender];
        if (market.outcome == Outcome.Cancelled) payout = back + fade;
        else if (market.outcome == Outcome.Back && market.backPool > 0) payout = back * (market.backPool + market.fadePool) / market.backPool;
        else if (market.outcome == Outcome.Fade && market.fadePool > 0) payout = fade * (market.backPool + market.fadePool) / market.fadePool;
        require(payout > 0, "NO_PAYOUT");
        require(collateral.transfer(msg.sender, payout), "TRANSFER_OUT");
        emit Claimed(marketId, msg.sender, payout);
    }

    function setResolver(address nextResolver) external onlyOwner {
        require(nextResolver != address(0), "ZERO_ADDRESS");
        resolver = nextResolver;
        emit ResolverChanged(nextResolver);
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        require(nextOwner != address(0), "ZERO_ADDRESS");
        pendingOwner = nextOwner;
        emit OwnershipTransferStarted(owner, nextOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "PENDING_OWNER");
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(msg.sender);
    }
}
