// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Public, non-custodial receipt registry for Proof Stances and Tail relationships.
contract StancePortfolio {
    event ProofStancePublished(
        address indexed author,
        bytes32 indexed stanceId,
        bytes32 indexed thesisHash,
        address token,
        uint256 positionSize,
        uint64 expiresAt,
        string evidenceURI
    );
    event TailRecorded(address indexed follower, address indexed caller, bytes32 indexed stanceId, uint256 amount);

    mapping(bytes32 => address) public authors;

    function publishProofStance(
        bytes32 stanceId,
        bytes32 thesisHash,
        address token,
        uint256 positionSize,
        uint64 expiresAt,
        string calldata evidenceURI
    ) external {
        require(stanceId != bytes32(0) && thesisHash != bytes32(0), "INVALID_STANCE");
        require(token != address(0) && positionSize > 0 && bytes(evidenceURI).length > 0, "INVALID_PROOF");
        require(authors[stanceId] == address(0), "STANCE_EXISTS");
        require(expiresAt > block.timestamp, "EXPIRED");
        authors[stanceId] = msg.sender;
        emit ProofStancePublished(msg.sender, stanceId, thesisHash, token, positionSize, expiresAt, evidenceURI);
    }

    function recordTail(address caller, bytes32 stanceId, uint256 amount) external {
        require(caller != address(0) && authors[stanceId] == caller, "INVALID_CALLER");
        require(msg.sender != caller && amount > 0, "INVALID_TAIL");
        emit TailRecorded(msg.sender, caller, stanceId, amount);
    }
}
