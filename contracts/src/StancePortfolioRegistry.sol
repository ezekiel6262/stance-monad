// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Immutable Monad registry for Stance portfolios and attributed Trail Portfolios.
/// @dev Stores hashes and lineage only. Assets remain in each user's wallet.
contract StancePortfolioRegistry {
    struct Portfolio {
        address owner;
        bytes32 thesisHash;
        bytes32 allocationHash;
        bytes32 sourcePortfolioId;
        bytes32 sourceStanceId;
        uint64 createdAt;
    }

    event PortfolioPublished(
        address indexed owner,
        bytes32 indexed portfolioId,
        bytes32 indexed thesisHash,
        bytes32 allocationHash,
        string metadataURI
    );
    event TrailPortfolioPublished(
        address indexed trailer,
        address indexed originalAuthor,
        bytes32 indexed portfolioId,
        bytes32 sourcePortfolioId,
        bytes32 sourceStanceId,
        bytes32 planHash,
        bytes32 allocationHash,
        uint256 amount,
        uint8 trailType,
        string metadataURI
    );

    mapping(bytes32 => Portfolio) public portfolios;

    function publishPortfolio(
        bytes32 portfolioId,
        bytes32 thesisHash,
        bytes32 allocationHash,
        string calldata metadataURI
    ) external {
        require(portfolioId != bytes32(0) && thesisHash != bytes32(0) && allocationHash != bytes32(0), "INVALID_PORTFOLIO");
        require(bytes(metadataURI).length > 0, "MISSING_METADATA");
        require(portfolios[portfolioId].owner == address(0), "PORTFOLIO_EXISTS");
        portfolios[portfolioId] = Portfolio(msg.sender, thesisHash, allocationHash, bytes32(0), bytes32(0), uint64(block.timestamp));
        emit PortfolioPublished(msg.sender, portfolioId, thesisHash, allocationHash, metadataURI);
    }

    function publishTrailPortfolio(
        bytes32 portfolioId,
        bytes32 sourcePortfolioId,
        bytes32 sourceStanceId,
        bytes32 planHash,
        bytes32 allocationHash,
        uint256 amount,
        uint8 trailType,
        string calldata metadataURI
    ) external {
        Portfolio memory source = portfolios[sourcePortfolioId];
        require(source.owner != address(0), "SOURCE_NOT_FOUND");
        require(msg.sender != source.owner, "SELF_TRAIL");
        require(portfolioId != bytes32(0) && portfolios[portfolioId].owner == address(0), "INVALID_PORTFOLIO");
        require(sourceStanceId != bytes32(0) && planHash != bytes32(0) && allocationHash != bytes32(0), "INVALID_TRAIL");
        require(trailType <= 2 && bytes(metadataURI).length > 0, "INVALID_METADATA");
        if (trailType != 0) require(amount > 0, "INVALID_AMOUNT");

        portfolios[portfolioId] = Portfolio(msg.sender, source.thesisHash, allocationHash, sourcePortfolioId, sourceStanceId, uint64(block.timestamp));
        emit TrailPortfolioPublished(msg.sender, source.owner, portfolioId, sourcePortfolioId, sourceStanceId, planHash, allocationHash, amount, trailType, metadataURI);
    }
}
