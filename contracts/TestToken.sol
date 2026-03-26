// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestToken
 * @notice Meta transaction demo için basit ERC-20 token.
 *         Deploy eden adrese 1.000.000 TTK mint edilir.
 *         Test amaçlı herkese açık mint fonksiyonu içerir.
 */

/**
 * @title TestToken
 * @notice Basit ERC-20 token - meta transaction transferleri için kullanılır
 */
contract TestToken is ERC20 {
    constructor() ERC20("TestToken", "TTK") {
        // Deploy eden adrese 1 milyon token mint et
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    /**
     * @notice Test amaçlı - herhangi bir adrese token mint eder
     * @param to Mint edilecek adres
     * @param amount Miktar (decimals dahil)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
