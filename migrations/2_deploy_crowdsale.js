const Token = artifacts.require("./COT.sol");
const COTVesting = artifacts.require("COTVesting");
const COTCrowdsale = artifacts.require("COTCrowdsale");

// Helpers
const _duration = {
  seconds: function(val) {
    return val;
  },
  minutes: function(val) {
    return val * this.seconds(60);
  },
  hours: function(val) {
    return val * this.minutes(60);
  },
  days: function(val) {
    return val * this.hours(24);
  },
  weeks: function(val) {
    return val * this.days(7);
  },
  years: function(val) {
    return val * this.days(365);
  },
};

function ether(n) {
  return new web3.BigNumber(web3.toWei(n, 'ether'));
}


module.exports = function(deployer) {
  // PARAMETRS

  //Global
  const timeNow = Math.floor(Date.now() / 1000);
  const MainAddress = "0x7035fb83a7c18289b94e443170bee56b92df8e46"; //TODO: Replace me

  //Token
  const name = "CoTrader";
  const symbol = "COT";
  const decimals = 18; // 1 COT is 1000000000000000000 decimals like ether
  const totalSupply = ether(2000000000); // 2 000 000 000

  //Crowdsale
  const rate = 1750000; // 1400000 + 350000 is 25% by default
  const ICOrate = 1400000;
  const percent = 24;
  const ICOWallet = "0x7035fb83a7c18289b94e443170bee56b92df8e46"; // TODO: Replace me
  const cap = ether(3000);
  const limit = ether(100000000000); // 100 000 000 000
  const timeLimit = timeNow + _duration.days(90); // Unix Data
  const timeForISL = _duration.days(90);


  // Vesting
  const start = timeNow + _duration.minutes(7); // Unix Data
  const cliff = _duration.weeks(4); // Time in seconds
  const duration = _duration.years(4); // Time in seconds
  const revocable = false; // Owner can not return tokens until time runs out
  const TeamAddress = "0x7035fb83a7c18289b94e443170bee56b92df8e46"; //TODO: Replace me
  const amount = ether(2000000000); // Tokens for TeamAddress in Vesting contract 2 000 000 000


  // DEPLOY
  // Deploy Vesting
  deployer.deploy(COTVesting, TeamAddress, start, cliff, duration, revocable).then(async () => {
    // Deploy Token
    await deployer.deploy(Token, name, symbol, decimals, totalSupply);

    const token = await Token.at(Token.address);
    // Transfer 2B to Vesting contract
    await token.transfer(COTVesting.address, amount);
    // transferOwnership of vesting to Gary
    const vesting = await COTVesting.at(COTVesting.address);
    await vesting.transferOwnership(MainAddress);

    // Block tokens
    await token.pause();
    // Deploy sale
    await deployer.deploy(COTCrowdsale, rate, ICOWallet, Token.address, limit, cap, percent, ICOrate, timeLimit, timeForISL);
    // transferOwnership of Sale to Gary
    const sale = await COTCrowdsale.at(COTCrowdsale.address); //TODO: uncoment me
    await sale.transferOwnership(MainAddress); //TODO: uncoment me
    // transferOwnership of token to sale contract
    await token.transferOwnership(COTCrowdsale.address);
  })
};
