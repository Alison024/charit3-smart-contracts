// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract Charit3 is Ownable {
    using EnumerableSet for EnumerableSet.UintSet;
    using SafeERC20 for IERC20;
    struct Fundraise {
        string name;
        address creator;
        uint256 target; // in usdc amount
        uint256 balance; // sum of eth converted to usd with usdc
        uint256 usdcBalance;
        uint256 ethBalance;
        bool finished;
    }
    error ZeroAddress();
    error ZeroValue();
    error NotFundraiseOwner();
    error InvalidFundraiseId();
    error CannotWithdraw();
    error FundraiseFinished();
    error NotEnoughEth();
    error EthTransferError();
    event FundraiseCreated(
        uint256 indexed id,
        address indexed creator,
        uint256 target
    );
    event Funded(
        uint256 indexed id,
        address indexed sender,
        uint256 usd,
        uint256 eth
    );
    uint256 public constant PRECISION = 1 ether;
    uint256 public constant USD_DECIMALS = 6;
    address ethUsdcPriceFeed;
    address usdc;
    uint256 public counter;
    mapping(uint256 => Fundraise) public fundraises;
    // creator address => id of Fundraise
    mapping(address => EnumerableSet.UintSet) private _creatorFundraises;
    constructor(address _ethUsdcPriceFeed) Ownable(msg.sender) {
        if (_ethUsdcPriceFeed == address(0)) revert ZeroAddress();
        ethUsdcPriceFeed = _ethUsdcPriceFeed;
    }

    function updatePriceFeed(address _newPriceFeed) external onlyOwner {
        ethUsdcPriceFeed = _newPriceFeed;
    }

    function createFundraise(string memory _name, uint256 _target) external {
        if (_target == 0 || bytes(_name).length == 0) {
            revert ZeroValue();
        }
        counter++;
        uint256 id = counter;
        fundraises[id] = Fundraise(_name, msg.sender, _target, 0, 0, 0, false);
        _creatorFundraises[msg.sender].add(id);
        emit FundraiseCreated(id, msg.sender, _target);
    }

    function fund(uint256 _fundraiseId, uint256 _amount) external payable {
        if (_amount == 0 && msg.value == 0) revert ZeroValue();
        Fundraise memory fundraise = fundraises[_fundraiseId];
        if (fundraise.finished) revert FundraiseFinished();
        if (fundraise.creator == address(0)) revert InvalidFundraiseId();
        if (_amount != 0) {
            IERC20(usdc).safeTransferFrom(msg.sender, address(this), _amount);
            fundraises[_fundraiseId].usdcBalance =
                fundraise.usdcBalance +
                _amount;
        }
        uint256 ethInUsd;
        if (msg.value != 0) {
            ethInUsd = convertEthToUsd(msg.value);
            fundraises[_fundraiseId].ethBalance =
                fundraise.ethBalance +
                msg.value;
        }
        fundraises[_fundraiseId].balance =
            fundraise.balance +
            _amount +
            ethInUsd;
        emit Funded(_fundraiseId, msg.sender, _amount, msg.value);
    }

    function withdraw(uint256 _fundraiseId) external {
        Fundraise memory fundraise = fundraises[_fundraiseId];
        if (fundraise.finished) revert FundraiseFinished();
        if (fundraise.creator == address(0)) revert InvalidFundraiseId();
        if (fundraise.creator != msg.sender) revert NotFundraiseOwner();
        if (fundraise.balance < fundraise.target) revert CannotWithdraw();
        if (fundraise.ethBalance != 0)
            _transferEthTo(payable(msg.sender), fundraise.ethBalance);
        if (fundraise.usdcBalance != 0)
            IERC20(usdc).safeTransfer(msg.sender, fundraise.usdcBalance);
        fundraises[_fundraiseId].finished = true;
    }

    function getCreatorFundraises(
        address _creator
    ) external view returns (uint256[] memory) {
        uint256 lenght = _creatorFundraises[_creator].length();
        if (lenght == 0) {
            return new uint256[](0);
        }
        uint256[] memory res = new uint256[](lenght);
        for (uint256 i; i < lenght; ++i) {
            res[i] = _creatorFundraises[_creator].at(i);
        }
        return res;
    }

    function convertEthToUsd(uint256 _ethIn) public view returns (uint256) {
        return (_ethIn * getEthPrice()) / PRECISION;
    }

    function getEthPrice() public view returns (uint256) {
        uint256 usdcDecimals = USD_DECIMALS;
        uint256 decimals = AggregatorV3Interface(ethUsdcPriceFeed).decimals();
        (, int256 answer, , , ) = AggregatorV3Interface(ethUsdcPriceFeed)
            .latestRoundData();
        uint256 price = uint256(answer);
        // convert data to 6 decimal format
        if (decimals > usdcDecimals) {
            return uint256(price) / 10 ** (decimals - usdcDecimals);
        } else if (decimals < usdcDecimals) {
            return uint256(price) * (10 ** (usdcDecimals - decimals));
        } else {
            return price;
        }
    }

    function _transferEthTo(
        address payable _recipient,
        uint256 _amount
    ) internal {
        if (address(this).balance >= _amount) revert NotEnoughEth();
        (bool sent, ) = _recipient.call{value: _amount}("");
        if (!sent) revert EthTransferError();
    }
}
