// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title SimpleAccount
 * @notice ERC-4337 uyumlu akıllı cüzdan (A cüzdanı).
 *         Owner'ın imzaladığı UserOperation'ları EntryPoint üzerinden çalıştırır.
 */
contract SimpleAccount is BaseAccount {
    using ECDSA for bytes32;

    IEntryPoint private immutable _entryPoint;

    /// @notice Bu akıllı cüzdanın sahibi (A cüzdanının EOA adresi)
    address public owner;

    event SimpleAccountInitialized(IEntryPoint indexed entryPoint, address indexed owner);
    event Executed(address indexed dest, uint256 value, bytes data);

    modifier onlyOwnerOrEntryPoint() {
        require(
            msg.sender == owner || msg.sender == address(_entryPoint),
            "SimpleAccount: not owner or entryPoint"
        );
        _;
    }

    constructor(IEntryPoint anEntryPoint, address anOwner) {
        _entryPoint = anEntryPoint;
        owner = anOwner;
        emit SimpleAccountInitialized(anEntryPoint, anOwner);
    }

    /// @inheritdoc BaseAccount
    function entryPoint() public view override returns (IEntryPoint) {
        return _entryPoint;
    }

    /**
     * @notice UserOperation imzasını doğrular.
     *         Owner'ın EIP-191 ile imzaladığı userOpHash beklenir.
     */
    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal view override returns (uint256 validationData) {
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        address signer = ECDSA.recover(hash, userOp.signature);
        if (signer != owner) {
            return SIG_VALIDATION_FAILED;
        }
        return SIG_VALIDATION_SUCCESS;
    }

    /**
     * @notice Herhangi bir contract fonksiyonunu çağırır (token transfer vb.)
     * @param dest Hedef contract adresi
     * @param value Gönderilecek ETH miktarı
     * @param func Çağrılacak fonksiyonun encoded verisi
     */
    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external onlyOwnerOrEntryPoint {
        _call(dest, value, func);
        emit Executed(dest, value, func);
    }

    /**
     * @notice Birden fazla işlemi tek seferde çalıştırır (Batch işlem - Bonus)
     * @param dest Hedef adresler dizisi
     * @param func Encoded fonksiyon verileri dizisi
     */
    function executeBatch(
        address[] calldata dest,
        bytes[] calldata func
    ) external onlyOwnerOrEntryPoint {
        require(dest.length == func.length, "SimpleAccount: length mismatch");
        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], 0, func[i]);
        }
    }

    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /// @notice ETH almak için
    receive() external payable {}
}
