// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
contract MockUSDC is ERC20 {
    constructor(
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {
        _mint(_msgSender(), 1_000_000_000 * 10 ** uint256(decimals()));
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
