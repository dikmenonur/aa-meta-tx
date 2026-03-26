// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title VerifyingPaymaster
 * @notice Gas sponsorship için Paymaster implementasyonu.
 *         X (sponsor) cüzdanının imzaladığı işlemlerin gas fee'sini karşılar.
 *
 *         paymasterAndData formatı:
 *         [20 bytes: paymaster adresi][65 bytes: sponsor imzası]
 */
contract VerifyingPaymaster is BasePaymaster {
    using ECDSA for bytes32;

    /// @notice Gas ödemelerini onaylayan sponsor (X cüzdanı)
    address public immutable verifyingSigner;

    event GasSponsored(address indexed sender, bytes32 indexed userOpHash);

    constructor(
        IEntryPoint _entryPoint,
        address _verifyingSigner
    ) BasePaymaster(_entryPoint) {
        require(_verifyingSigner != address(0), "Paymaster: zero signer");
        verifyingSigner = _verifyingSigner;
    }

    /**
     * @notice UserOperation'ın sponsor tarafından onaylandığını doğrular.
     *         paymasterAndData içindeki imzanın verifyingSigner'a ait olması gerekir.
     */
    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal view override returns (bytes memory context, uint256 validationData) {
        (maxCost); // kullanılmıyor - tüm işlemleri sponsor ediyor

        // paymasterAndData: ilk 20 byte adres, geri kalanı imza
        require(
            userOp.paymasterAndData.length >= 20 + 65,
            "Paymaster: invalid paymasterAndData length"
        );

        bytes calldata signature = userOp.paymasterAndData[20:];

        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        address signer = ECDSA.recover(hash, signature);

        if (signer != verifyingSigner) {
            return ("", SIG_VALIDATION_FAILED);
        }

        return (abi.encode(userOp.sender, userOpHash), SIG_VALIDATION_SUCCESS);
    }

    /**
     * @notice İşlem sonrası hook - sponsorlanan işlemi loglar
     */
    function _postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) internal override {
        (mode, actualGasCost, actualUserOpFeePerGas); // unused
        (address sender, bytes32 userOpHash) = abi.decode(context, (address, bytes32));
        emit GasSponsored(sender, userOpHash);
    }

    /**
     * @notice EntryPoint'e ETH deposit eder (gas rezervi için)
     */
    function deposit() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }

    /**
     * @notice Deposit bakiyesini çeker (sadece owner)
     */
    function withdrawTo(address payable dest, uint256 amount) external onlyOwner {
        entryPoint.withdrawTo(dest, amount);
    }

    /**
     * @notice Güncel deposit bakiyesini döner
     */
    function getDeposit() external view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }
}
