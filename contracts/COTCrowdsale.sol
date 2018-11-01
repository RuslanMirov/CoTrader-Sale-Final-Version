pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/crowdsale/Crowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/emission/MintedCrowdsale.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/CappedCrowdsale.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/PausableToken.sol";

contract COTCrowdsale is Crowdsale, MintedCrowdsale, CappedCrowdsale, Ownable{

 using SafeMath for uint256;

 uint256 private limit;
 uint256 private maxLimit;
 uint256 private minLimit;
 uint256 private limitAmount;
 uint256 private percent;
 uint256 private ICOrate;
 uint256 private limitTime;
 bool    private isSetTime = false;
 bool    private isCallPauseTokens = false;
 bool    private isSetLimitAmount = false;
 uint256 private timeForISL;
 bool    private isSetISLTime = false;

 constructor(
    uint256 _rate,
    address _wallet,
    ERC20 _token,
    uint256 _limit,
    uint256 _cap,
    uint256 _percent,
    uint256 _ICOrate,
    uint256 _limitTime,
    uint256 _timeForISL
  )
  Crowdsale(_rate, _wallet, _token)
  CappedCrowdsale(_cap)
  public
  {
    maxLimit = _limit;
    limit = _limit.div(5);
    minLimit = _limit.div(5);
    limitAmount = _limit.div(10).div(5);
    percent = _percent;
    ICOrate = _ICOrate;
    limitTime = _limitTime;
    timeForISL = _timeForISL;
  }

  /*
    @dev Owner can reduce bonus percent 25% by default
    each call reduces of 1%
  */

  function ReduceRate()
    public
    onlyOwner()
  {
    require(rate > ICOrate);
    uint256 totalPercent = ICOrate.div(100).mul(percent);
    rate = ICOrate.add(totalPercent);
    if (percent != 0) {
    percent = percent.sub(1);
    }
  }

  /*
   @dev Owner can reduce limit
   After call this function owner can not set new limit more than
   value of parametr previous call
 */

 function ReduceMaxLimit(uint256 newlLimit)
   public
   onlyOwner()
 {
   uint256 totalLimit = maxLimit;
   require(newlLimit >= minLimit);
   require(newlLimit <= totalLimit);
   maxLimit = newlLimit;
 }

  /*
    @dev Owner can change time limit for call ISL()
    @param Unix Date
  */

  function SetMintTimeLimit(uint256 newTime)
    public
    onlyOwner()
  {
    require(!isSetTime);
    limitTime = newTime;
  }

  /*
    @dev Owner can block SetMintTimeLimit() FOREVER
  */

  function blockSetMintTimeLimit()
    public
    onlyOwner()
  {
    isSetTime = true;
  }

  /*
    @dev View status about the possibility of calling of SetMintTimeLimit function
  */

  function isblockSetMintTimeLimit()
    public
    view
    returns (bool)
  {
    return isSetTime;
  }


  /*
    @dev Owner can add 2B (by Default) to limit per 3 month,
    100B maximum tokens limit (can be reduce via ReduceMaxLimit)
  */

  function ISL()
    public
    onlyOwner()
  {
    require(now >= limitTime);
    require(limit < maxLimit);
    limit = limit.add(limitAmount);
    limitTime = now + timeForISL;
  }

  /*
    @dev Owner can change time ISL for next call
    @param time in seconds
  */

  function SetISLTime(uint256 newTime)
    public
    onlyOwner()
  {
    require(!isSetISLTime);
    timeForISL = newTime;
  }

  /*
    @dev Owner can block SetISLTime
  */

  function blockSetISLTime()
    public
    onlyOwner()
  {
    isSetISLTime = true;
    limitAmount = minLimit.div(10);
  }

  /*
    @dev View status about the possibility of calling of SetISLTime function
  */

  function isblockSetISLTime()
    public
    view
    returns (bool)
  {
    return isSetISLTime;
  }

  /*
    @dev View value of timeForISL return time in secods
  */

  function ReturnISLDays()
    public
    view
    returns (uint256)
  {
    return timeForISL;
  }

  /*
    @dev Owner can change Limit amount for ISL
    can NOT set more that 100B anyway
  */

  function SetLimitAmount(uint256 amount)
    public
    onlyOwner()
  {
   require(!isSetLimitAmount);
   uint256 max = maxLimit;
   uint256 total = limit;
   require(max > amount);

   if(total.add(amount) > max){
    amount = 0;
   }
   require(amount > 0);
   limitAmount = amount;
  }

  /*
    @dev Owner can block SetLimitAmount
    set 2B by default after block
  */

  function blockSetLimitAmount()
    public
    onlyOwner()
  {
    isSetLimitAmount = true;
    limitAmount = minLimit.div(10);
  }

  /*
    @dev View status about the possibility of calling of SetLimitAmount function
  */

  function isblockSetLimitAmount()
    public
    view
    returns (bool)
  {
    return isSetLimitAmount;
  }

  /*
    @dev Owner can mint new Tokens up to a certain limit
    @param _beneficiary - receiver
    @param _tokenAmount - amount
  */

  function MintLimit(
    address _beneficiary,
    uint256 _tokenAmount
  )
    public
    onlyOwner()
  {

  uint256 _limit = ReturnLimit();

  uint256 total = token.totalSupply();
  require(total < _limit);

  if(_tokenAmount.add(total) > _limit ){
    _tokenAmount = 0;
  }
  require(_tokenAmount > 0);
  require(MintableToken(address(token)).mint(_beneficiary, _tokenAmount));
  }

  /*
    @dev Get amount of total limit for MintLimit function
  */

  function ReturnLimit()
    public
    view
    returns (uint256)
  {
    return limit;
  }

  /*
    @dev View amount of minLimit
  */

  function ReturnMinLimit()
    public
    view
    returns (uint256)
  {
    return minLimit;
  }

  /*
    @dev View amount of maxLimit
  */

  function ReturnMaxLimit()
    public
    view
    returns (uint256)
  {
    return maxLimit;
  }

  /*
    @dev return unix Date time when ISL can be call
  */

  function iSLDate()
    public
    view
    returns (uint256)
  {
    return limitTime;
  }

  /*
    @dev owner sale can pause Token
    only through contract sale
  */

  function pauseTokens()
    public
    onlyOwner()
  {
    require(!isCallPauseTokens);
    PausableToken(address(token)).pause();
  }

  /*
    @dev owner sale can unpause Token
    only through contract sale
  */

  function unpauseTokens()
    public
    onlyOwner()
  {
    PausableToken(address(token)).unpause();
  }

  /*
    @dev Owner can block call pauseTokens FOREVER
  */

  function blockCallPauseTokens()
    public
    onlyOwner()
  {
    isCallPauseTokens = true;
  }

  /*
    @dev view status about the possibility of calling pauseTokens()
  */

  function isblockCallPauseTokens()
    public
    view
    returns (bool)
  {
    return isCallPauseTokens;
  }

  /*
    @dev owner sale can finish mint FOREVER
  */

  function finishMint()
    public
    onlyOwner()
  {
    MintableToken(address(token)).finishMinting();
  }

}
