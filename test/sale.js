import ether from './helpers/ether';
import EVMRevert from './helpers/EVMRevert';
import {
  increaseTimeTo,
  duration
} from './helpers/increaseTime';
import latestTime from './helpers/latestTime';

const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const Token = artifacts.require('COT');
const Sale = artifacts.require('COTCrowdsale');


contract('Sale', function([_, wallet]) {

  beforeEach(async function() {
    // Token config
    this.name = "CoTrader";
    this.symbol = "COT";
    this.decimals = 18;
    // ether convert 10 000 000 000 COT to 10000000000000000000000000000 hex
    this.totalSupply = ether(10000000000);


    // Deploy Token
    this.token = await Token.new(
      this.name,
      this.symbol,
      this.decimals,
      this.totalSupply,
    );

    //Crowdsale
    this.rate = 1750000;
    this.wallet = _;
    this.cap = ether(10); // CAP
    this.ICOrate = 1400000;
    this.percent = 24;
    this.limit = ether(100000000000)
    this.timeLimit = latestTime() + duration.days(90);
    this.timeForISL = duration.days(90);
    //Deploy sale
    this.sale = await Sale.new(
      this.rate,
      this.wallet,
      this.token.address,
      this.limit,
      this.cap,
      this.percent,
      this.ICOrate,
      this.timeLimit,
      this.timeForISL
    );
    // block Tokens
    await this.token.pause();
    // Transfer token ownership to sale
    await this.token.transferOwnership(this.sale.address);
  });

  describe('INIT with correct values', function() {
    it('totalSuply 10000000000 COT', async function() {
      const total = await this.token.totalSupply();
      total.should.be.bignumber.equal(ether(10000000000));
    });

    it('Owner SALE is _', async function() {
      const owner = await this.sale.owner();
      assert.equal(owner, _);
    });

    it('tokens init blocked', async function() {
      await this.token.transfer(wallet, ether(1)).should.be.rejectedWith(EVMRevert);
    });

    it('Correct Token address in sale contract', async function() {
      const TokenAddress = await this.sale.token();
      assert.equal(TokenAddress, this.token.address);
    });

    it('Correct init rate (PrePreSale by default) (25%)', async function() {
      const oldBalance = await this.token.balanceOf(_);
      await this.sale.sendTransaction({
        value: ether(1),
        from: _
      });
      const newBalance = await this.token.balanceOf(_);
      const sum = await web3.fromWei(newBalance, 'ether') - web3.fromWei(oldBalance, 'ether');
      assert.equal(sum, 1750000);
    });

    it('Owner can call pauseTokens by default', async function() {
      const status = await this.sale.isblockCallPauseTokens();
      assert.equal(status, false);
    });


    it('Owner can call SetISLTime by default', async function() {
      const status = await this.sale.isblockSetISLTime();
      assert.equal(status, false);
    });

    it('Owner can call SetLimitAmount by default', async function() {
      const status = await this.sale.isblockSetLimitAmount();
      assert.equal(status, false);
    });

    it('Owner can call setRLTim by default', async function() {
      const status = await this.sale.isblockSetMintTimeLimit();
      assert.equal(status, false);
    });

    it('Balance Wallet 0', async function() {
      const balance = await this.token.balanceOf(wallet);
      assert.equal(web3.fromWei(balance, 'ether'), 0);
    });
  });

  describe('SetLimitAmount', function() {
    it('NOT Onwer Can Not call SetLimitAmount', async function() {
      await this.sale.SetLimitAmount(ether(80000000000), {
        from: wallet
      }).should.be.rejectedWith(EVMRevert);
    });

    it('NOT Owner Can Not call blockSetLimitAmount', async function() {
      await this.sale.blockSetLimitAmount({
        from: wallet
      }).should.be.rejectedWith(EVMRevert);
    });

    it('Can NOT be set more than 100B', async function() {
      await this.sale.SetLimitAmount(ether(80000000001)).should.be.rejectedWith(EVMRevert);
    });

    it('Can be set 100B', async function() {
      await this.sale.SetLimitAmount(ether(80000000000)).should.be.fulfilled;
    });

    it('Owner can Mint new value', async function() {
      await this.sale.SetLimitAmount(ether(60000000000));
      const time = await latestTime() + duration.days(1);
      await this.sale.SetMintTimeLimit(time);
      await increaseTimeTo(time);
      await this.sale.ISL();
      await this.sale.MintLimit(wallet, ether(60000000000)).should.be.fulfilled;
    });

    it('Can Not call after block SetLimitAmount', async function() {
      await this.sale.blockSetLimitAmount().should.be.fulfilled;
      await this.sale.SetLimitAmount(ether(80000000000)).should.be.rejectedWith(EVMRevert);
    });

    it('Can double call', async function() {
      await this.sale.SetLimitAmount(ether(20000000000)).should.be.fulfilled;
      await this.sale.SetLimitAmount(ether(60000000000)).should.be.fulfilled;
    });

    it('after block SetLimitAmount amount is 2B by default', async function() {
      await this.sale.SetLimitAmount(ether(80000000000)).should.be.fulfilled;
      await this.sale.blockSetLimitAmount().should.be.fulfilled;
      const time = await latestTime() + duration.days(1);
      await this.sale.SetMintTimeLimit(time).should.be.fulfilled;
      await increaseTimeTo(time);
      await this.sale.ISL().should.be.fulfilled;
      await this.sale.MintLimit(wallet, ether(13000000000)).should.be.rejectedWith(EVMRevert);
      await this.sale.MintLimit(wallet, ether(12000000000)).should.be.fulfilled;
    });
  });

  describe('ReduceMaxLimit', function() {
    it('Not Owner try call Reduce Limit should be fail', async function() {
      await this.sale.ReduceMaxLimit(20000000001, {
        from: wallet
      }).should.be.rejectedWith(EVMRevert);
    });

    it('Reduce Limit cannot be called with parametr < 20B', async function() {
      await this.sale.ReduceMaxLimit(ether(19999999999)).should.be.rejectedWith(EVMRevert);
    });

    it('Reduce Limit can be called with parametr = 20B', async function() {
      await this.sale.ReduceMaxLimit(ether(20000000000)).should.be.fulfilled;
    });

    it('After second call min reduce limit not increase', async function() {
      await this.sale.ReduceMaxLimit(ether(40000000000)).should.be.fulfilled;
      await this.sale.ReduceMaxLimit(ether(19999999999)).should.be.rejectedWith(EVMRevert);
    });

    it('Reduce Limit cannot be set more than old limit', async function() {
      await this.sale.ReduceMaxLimit(ether(40000000000)).should.be.fulfilled;
      await this.sale.ReduceMaxLimit(ether(40000000001)).should.be.rejectedWith(EVMRevert);
    });

    it('Reduce Limit can be set as old but no more', async function() {
      await this.sale.ReduceMaxLimit(ether(40000000000)).should.be.fulfilled;
      await this.sale.ReduceMaxLimit(ether(40000000000)).should.be.fulfilled;
    });

    it('Reduce Limit cannot be called with parametr > 100B', async function() {
      await this.sale.ReduceMaxLimit(ether(100000000001)).should.be.rejectedWith(EVMRevert);
    });

    it('Owner try set limit more that ReduceMaxLimit allow should be fail', async function() {
      await this.sale.ReduceMaxLimit(ether(40000000000)).should.be.fulfilled;
      let timeStart = await latestTime() + duration.days(91);
      for (var i = 0; i < 10; i++) {
        timeStart = timeStart + duration.days(91);
        await increaseTimeTo(timeStart);
        await this.sale.ISL().should.be.fulfilled;
      }
      await this.sale.ISL().should.be.rejectedWith(EVMRevert);
    });
  });

  describe('PAUSE Token part 1', function() {
    it('Owner call MintLimit when pause should be fulfilled', async function() {
      await this.sale.MintLimit(wallet, ether(100)).should.be.fulfilled;
    });

    it('Not owner try call pause should be fail', async function() {
      await this.sale.unpauseTokens();
      await this.sale.pauseTokens({
        from: wallet
      }).should.be.rejectedWith(EVMRevert);
    });

    it('Not owner try call unpause should be fail', async function() {
      await this.sale.unpauseTokens({
        from: wallet
      }).should.be.rejectedWith(EVMRevert);
    });

    it('totalSupply increase when owner call MintLimit when token pause', async function() {
      const before = await this.token.totalSupply();
      await this.sale.MintLimit(wallet, ether(100));
      const after = await this.token.totalSupply();
      assert.isTrue(web3.fromWei(after, 'ether') > web3.fromWei(before, 'ether'));
    });

    it('transfer work after unpauseTokens', async function() {
      await this.sale.unpauseTokens();
      await this.token.transfer(wallet, ether(1)).should.be.fulfilled;
    });

    it('approve work after unpauseTokens', async function() {
      await this.sale.unpauseTokens();
      await this.token.approve(wallet, 1).should.be.fulfilled;
      const balance = await this.token.allowance(_, wallet).should.be.fulfilled;
      assert.equal(balance, 1);
    });

    it('transferFrom work after unpauseTokens', async function() {
      await this.sale.unpauseTokens();
      await this.token.approve(wallet, ether(1));
      await this.token.transferFrom(_, wallet, ether(1), {
        from: wallet
      }).should.be.fulfilled;
    });
  });

  describe('PAUSE Token part 2', function() {
    it('Owner Sale call pause not through contract sale should be fail', async function() {
      await this.sale.unpauseTokens();
      await this.token.pause().should.be.rejectedWith(EVMRevert);
    });

    it('Not Owner Sale call pause not through contract sale should be fail', async function() {
      await this.sale.unpauseTokens();
      await this.token.pause({
        from: wallet
      }).should.be.rejectedWith(EVMRevert);
    });

    it('Owner contract try call unpause not through contract sale should be fail', async function() {
      await this.token.unpause().should.be.rejectedWith(EVMRevert);
    });

    it('Not owner try call unpause through contract token should be fail', async function() {
      await this.token.unpause({
        from: wallet
      }).should.be.rejectedWith(EVMRevert);
    });
  });

  describe('PAUSE Token part 3', function() {
    it('NOT Owner CAN NOT call blockCallPauseTokens', async function() {
      await this.sale.blockCallPauseTokens({
        from: wallet
      }).should.be.rejectedWith(EVMRevert);
    });

    it('Owner can not call PAUSE token after call blockCallPauseTokens', async function() {
      await this.sale.unpauseTokens();
      await this.sale.blockCallPauseTokens();
      await this.sale.pauseTokens().should.be.rejectedWith(EVMRevert);
    });
  });

  describe('SetISLTime', function() {
    it('Not Owner can NOT call SetISLTime', async function() {
      await this.sale.SetISLTime(duration.days(190), {
        from: wallet
      }).should.be.rejectedWith(EVMRevert);
    });

    it('Owner can NOT call SetISLTime after block', async function() {
      await this.sale.blockSetISLTime();
      await this.sale.SetISLTime(duration.days(190)).should.be.rejectedWith(EVMRevert);
    });

    it('Owner can NOT call ISL if in we increase days in SetISLTime', async function() {
      await this.sale.SetISLTime(duration.days(190)).should.be.fulfilled;

      const time = await latestTime() + duration.days(90);
      await increaseTimeTo(time);
      await this.sale.ISL().should.be.fulfilled;

      const nextime = await time + duration.days(90);
      await increaseTimeTo(nextime);
      await this.sale.ISL().should.be.rejectedWith(EVMRevert)
    });

    it('Owner can call only after new days', async function() {
      await this.sale.SetISLTime(duration.days(190)).should.be.fulfilled;

      const time = await latestTime() + duration.days(90);
      await increaseTimeTo(time);
      await this.sale.ISL();

      const nextime = await time + duration.days(191);
      await increaseTimeTo(nextime);
      await this.sale.ISL().should.be.fulfilled;
    });

    it('90 days (by Default) in SetISLTime after block', async function() {
      await this.sale.SetISLTime(duration.days(190)).should.be.fulfilled;
      await this.sale.blockSetISLTime();
      const time = await latestTime() + duration.days(90);
      await increaseTimeTo(time);
      await this.sale.ISL().should.be.fulfilled;
    });
  });


  describe('MintLimit', function() {
    it('Owner CAN NOT call mint from token contract', async function() {
      await this.token.mint(wallet, ether(100)).should.be.rejectedWith(EVMRevert);
    });

    it('Not owner try call MintLimit should be fail', async function() {
      await this.sale.MintLimit(wallet, ether(100), {
        from: wallet
      }).should.be.rejectedWith(EVMRevert);
    });

    it('Not Owner Try call MintLimit with maximum allow Limit 20B should be fail', async function() {
      await this.sale.MintLimit(wallet, ether(10000000000), {
        from: wallet
      }).should.be.rejectedWith(EVMRevert);
    });

    it('Owner Try call MintLimit with maximum allow Limit 20B should be fulfilled', async function() {
      await this.sale.MintLimit(wallet, ether(10000000000)).should.be.fulfilled;
    });

    it('Try call MintLimit with more than allow should be fail', async function() {
      await this.sale.MintLimit(wallet, ether(10000000001)).should.be.rejectedWith(EVMRevert);
    });

    it('NOT Owner Sale can NOT call MintLimit even with minimum value', async function() {
      await this.sale.MintLimit(_, ether(1), {
        from: wallet
      }).should.be.rejectedWith(EVMRevert);
    });

    it('totalSuply increase when owner call MintLimit', async function() {
      const before = await this.token.totalSupply();
      await this.sale.MintLimit(_, ether(1));
      const after = await this.token.totalSupply();
      assert.isTrue(web3.fromWei(after, 'ether') > web3.fromWei(before, 'ether'));
    });

    it('receiver balance increase when owner call MintLimit', async function() {
      const before = await this.token.balanceOf(wallet);
      await this.sale.MintLimit(wallet, ether(1));
      const after = await this.token.balanceOf(wallet);
      assert.isTrue(web3.fromWei(after, 'ether') > web3.fromWei(before, 'ether'));
    });
  });

  describe('SALE', function() {
    it('Sale contract exchange ETH to tokens', async function() {
      await this.sale.sendTransaction({
        value: ether(1),
        from: _
      }).should.be.fulfilled;
    });

    it('sender balance increase after send ETH to ICO contract', async function() {
      const before = await this.token.balanceOf(_);
      await this.sale.sendTransaction({
        value: ether(1),
        from: _
      });
      const after = await this.token.balanceOf(_);
      assert.isTrue(web3.fromWei(after, 'ether') > web3.fromWei(before, 'ether'));
    });

    it('ICO Wallet balance increase after user send ETH to ICO contract', async function() {
      const before = await web3.eth.getBalance(this.wallet);
      await this.sale.sendTransaction({
        value: ether(1),
        from: wallet
      });
      const after = await web3.eth.getBalance(this.wallet);
      assert.isTrue(web3.fromWei(after, 'ether') > web3.fromWei(before, 'ether'));
    });
  });

  describe('CAP', function() {
    it('CAP Limit (cap is 10 eth for test)', async function() {
      await this.sale.sendTransaction({
        value: ether(10),
        from: _
      }).should.be.fulfilled;
    });
    it('try buy more cap limit should be fail', async function() {
      await this.sale.sendTransaction({
        value: ether(11),
        from: _
      }).should.be.rejectedWith(EVMRevert);
    });
  });

  describe('STOP MINT FOREVER', function() {
    it('Owner call stop mint should be fulfilled', async function() {
      await this.sale.finishMint().should.be.fulfilled;
    });

    it('Not owner call stop mint should be fail', async function() {
      await this.sale.finishMint({
        from: wallet
      }).should.be.rejectedWith(EVMRevert);
    });

    it('OLD owner call stop mint should be fail', async function() {
      await this.sale.transferOwnership(wallet, {
        from: _
      });
      await this.sale.finishMint({
        from: _
      }).should.be.rejectedWith(EVMRevert);
    });

    it('Owner call MintLimit after finishMint should be fail', async function() {
      await this.sale.finishMint().should.be.fulfilled;
      await this.sale.MintLimit(_, ether(1)).should.be.rejectedWith(EVMRevert);
    });
  });

  describe('ISL and SetMintTimeLimit', function() {
    it('NOT Owner Sale can NOT call SetMintTimeLimit', async function() {
      await this.sale.SetMintTimeLimit(latestTime(), {
        from: wallet
      }).should.be.rejectedWith(EVMRevert);
    });

    it('NOT Owner Sale can NOT call ISL', async function() {
      await this.sale.ISL({
        from: wallet
      }).should.be.rejectedWith(EVMRevert);
    });

    it('NOT Owner Sale can NOT call blockSetMintTimeLimit', async function() {
      await this.sale.blockSetMintTimeLimit({
        from: wallet
      }).should.be.rejectedWith(EVMRevert);
    });

    it('Owner can not call ISL ahead of time', async function() {
      await this.sale.ISL().should.be.rejectedWith(EVMRevert);
    });

    it('Owner can not call SetMintTimeLimit after blockSetMintTimeLimit', async function() {
      await this.sale.blockSetMintTimeLimit().should.be.fulfilled;
      const time = await latestTime() + duration.days(1);
      await this.sale.SetMintTimeLimit(time).should.be.rejectedWith(EVMRevert);
    });

    it('Owner can not double callISL', async function() {
      const time = await latestTime() + duration.days(1);
      await this.sale.SetMintTimeLimit(time).should.be.fulfilled;
      await increaseTimeTo(time);
      await this.sale.ISL().should.be.fulfilled;
      await this.sale.ISL().should.be.rejectedWith(EVMRevert);
    });

    it('Limit increase when Owner call ISL', async function() {
      const time = await latestTime() + duration.days(1);
      const before = await this.sale.ReturnLimit()
      await this.sale.SetMintTimeLimit(time).should.be.fulfilled;
      await increaseTimeTo(time);
      await this.sale.ISL().should.be.fulfilled;
      const after = await this.sale.ReturnLimit();
      assert.isTrue(web3.fromWei(after, 'ether') > web3.fromWei(before, 'ether'));
    });

    it('Two call ISL after increase Time', async function() {
      const time = await latestTime() + duration.days(1);
      await this.sale.SetMintTimeLimit(time).should.be.fulfilled;
      await increaseTimeTo(time);
      await this.sale.ISL().should.be.fulfilled;
      const newTime = time + duration.days(366);
      await increaseTimeTo(newTime);
      await this.sale.ISL().should.be.fulfilled;
    });

    it('Try call MintLimit with more than allow after call ISL should be fulfilled', async function() {
      const time = await latestTime() + duration.days(1);
      await this.sale.SetMintTimeLimit(time).should.be.fulfilled;
      await increaseTimeTo(time);
      await this.sale.ISL().should.be.fulfilled;
      await this.sale.MintLimit(wallet, ether(12000000000)).should.be.fulfilled;
    });

    it('Owner Can not increase limit via ISL more than 100B by default', async function() {
      let timeStart = await latestTime() + duration.days(91);
      for (var i = 0; i < 40; i++) {
        timeStart = timeStart + duration.days(91);
        await increaseTimeTo(timeStart);
        await this.sale.ISL().should.be.fulfilled;
      }
      timeStart = timeStart + duration.days(91);
      await increaseTimeTo(timeStart);
      await this.sale.ISL().should.be.rejectedWith(EVMRevert);
    });

    it('CAN MINT 100B', async function() {
      let timeStart = await latestTime() + duration.days(91);
      for (var i = 0; i < 40; i++) {
        timeStart = timeStart + duration.days(91);
        await increaseTimeTo(timeStart);
        await this.sale.ISL().should.be.fulfilled;
      }
      await this.sale.MintLimit(wallet, ether(90000000000)).should.be.fulfilled;
    });

    it('CAN NOT MINT more than 100B', async function() {
      let timeStart = await latestTime() + duration.days(91);
      for (var i = 0; i < 40; i++) {
        timeStart = timeStart + duration.days(91);
        await increaseTimeTo(timeStart);
        await this.sale.ISL().should.be.fulfilled;
      }
      await this.sale.MintLimit(wallet, ether(90000000001)).should.be.rejectedWith(EVMRevert);
    });

    it('ISL can not be call more than ReduceMaxLimit value', async function() {
      await this.sale.ReduceMaxLimit(ether(30000000000)).should.be.fulfilled;
      let timeStart = await latestTime() + duration.days(91);
      for (var i = 0; i < 5; i++) {
        timeStart = timeStart + duration.days(91);
        await increaseTimeTo(timeStart);
        await this.sale.ISL().should.be.fulfilled;
      }
      await this.sale.ISL().should.be.rejectedWith(EVMRevert);
    });
  });

  describe('BONUS for early investors', function() {
    it('NOT Owner can NOT call ReduceRate should be fail', async function() {
      await this.sale.ReduceRate({
        from: wallet
      }).should.be.rejectedWith(EVMRevert);
    });

    it('Correct ReduceRate call, after 25 call rate equal 1400000', async function() {
      for (var i = 0; i < 25; i++) {
        await this.sale.ReduceRate({
          from: _
        }).should.be.fulfilled;
      }
      const r = await this.sale.rate();
      assert.equal(r, 1400000);
    });

    it('Can not call ReduceRate more than 25 times', async function() {
      for (var i = 0; i < 25; i++) {
        await this.sale.ReduceRate({
          from: _
        }).should.be.fulfilled;
      }
      await this.sale.ReduceRate({
        from: _
      }).should.be.rejectedWith(EVMRevert);
    });

    it('Correct reduce percent after 1 call percent is 24% is 336000 (1400 000 / 100 * 24)', async function() {
      await this.sale.ReduceRate({
        from: _
      }); // 24%
      await this.sale.sendTransaction({
        value: ether(1),
        from: wallet
      });
      const balance = await this.token.balanceOf(wallet);
      const sum = await web3.fromWei(balance, 'ether') - 1400000;
      assert.equal(sum, 336000);
    });

    it('Correct reduce percent after 4 call percent is 20% is 280000 (1400 000 / 100 * 20)', async function() {
      await this.sale.ReduceRate({
        from: _
      }); // 24%
      await this.sale.ReduceRate({
        from: _
      }); // 23%
      await this.sale.ReduceRate({
        from: _
      }); // 22%
      await this.sale.ReduceRate({
        from: _
      }); // 21%
      await this.sale.ReduceRate({
        from: _
      }); // 20%

      await this.sale.sendTransaction({
        value: ether(1),
        from: wallet
      });
      const balance = await this.token.balanceOf(wallet);
      const sum = await web3.fromWei(balance, 'ether') - 1400000;
      assert.equal(sum, 280000);
    });

    it('OPTIONAL Repeat Test Correct reduce 1% percent with out loop', async function() {
      await this.sale.ReduceRate({
        from: _
      }); // 24%
      await this.sale.ReduceRate({
        from: _
      }); // 23%
      await this.sale.ReduceRate({
        from: _
      }); // 22%
      await this.sale.ReduceRate({
        from: _
      }); // 21%
      await this.sale.ReduceRate({
        from: _
      }); // 20%
      await this.sale.ReduceRate({
        from: _
      }); // 19%
      await this.sale.ReduceRate({
        from: _
      }); // 18%
      await this.sale.ReduceRate({
        from: _
      }); // 17%
      await this.sale.ReduceRate({
        from: _
      }); // 16%
      await this.sale.ReduceRate({
        from: _
      }); // 15%
      await this.sale.ReduceRate({
        from: _
      }); // 14%
      await this.sale.ReduceRate({
        from: _
      }); // 13%
      await this.sale.ReduceRate({
        from: _
      }); // 12%
      await this.sale.ReduceRate({
        from: _
      }); // 11%
      await this.sale.ReduceRate({
        from: _
      }); // 10%
      await this.sale.ReduceRate({
        from: _
      }); // 9%
      await this.sale.ReduceRate({
        from: _
      }); // 8%
      await this.sale.ReduceRate({
        from: _
      }); // 7%
      await this.sale.ReduceRate({
        from: _
      }); // 6%
      await this.sale.ReduceRate({
        from: _
      }); // 5%
      await this.sale.ReduceRate({
        from: _
      }); // 4%
      await this.sale.ReduceRate({
        from: _
      }); // 3%
      await this.sale.ReduceRate({
        from: _
      }); // 2%
      await this.sale.ReduceRate({
        from: _
      }); // 1%

      await this.sale.sendTransaction({
        value: ether(1),
        from: wallet
      });
      const balance = await this.token.balanceOf(wallet);
      const sum = await web3.fromWei(balance, 'ether') - 1400000;
      assert.equal(sum, 14000);
    });

    it('OPTIONAL Repeat Test Correct reduce 0% percent with out loop', async function() {
      await this.sale.ReduceRate({
        from: _
      }); // 24%
      await this.sale.ReduceRate({
        from: _
      }); // 23%
      await this.sale.ReduceRate({
        from: _
      }); // 22%
      await this.sale.ReduceRate({
        from: _
      }); // 21%
      await this.sale.ReduceRate({
        from: _
      }); // 20%
      await this.sale.ReduceRate({
        from: _
      }); // 19%
      await this.sale.ReduceRate({
        from: _
      }); // 18%
      await this.sale.ReduceRate({
        from: _
      }); // 17%
      await this.sale.ReduceRate({
        from: _
      }); // 16%
      await this.sale.ReduceRate({
        from: _
      }); // 15%
      await this.sale.ReduceRate({
        from: _
      }); // 14%
      await this.sale.ReduceRate({
        from: _
      }); // 13%
      await this.sale.ReduceRate({
        from: _
      }); // 12%
      await this.sale.ReduceRate({
        from: _
      }); // 11%
      await this.sale.ReduceRate({
        from: _
      }); // 10%
      await this.sale.ReduceRate({
        from: _
      }); // 9%
      await this.sale.ReduceRate({
        from: _
      }); // 8%
      await this.sale.ReduceRate({
        from: _
      }); // 7%
      await this.sale.ReduceRate({
        from: _
      }); // 6%
      await this.sale.ReduceRate({
        from: _
      }); // 5%
      await this.sale.ReduceRate({
        from: _
      }); // 4%
      await this.sale.ReduceRate({
        from: _
      }); // 3%
      await this.sale.ReduceRate({
        from: _
      }); // 2%
      await this.sale.ReduceRate({
        from: _
      }); // 1%
      await this.sale.ReduceRate({
        from: _
      }); // 0%

      await this.sale.sendTransaction({
        value: ether(1),
        from: wallet
      });
      const balance = await this.token.balanceOf(wallet);
      const sum = await web3.fromWei(balance, 'ether') - 1400000;
      assert.equal(sum, 0);
    });

    it('Owner can NOT call more then 25 even if percent more 24 because default rate is 1750000', async function() {
      this.percent = 30;
      for (var i = 0; i < 25; i++) {
        await this.sale.ReduceRate({
          from: _
        }).should.be.fulfilled;
      }
      await this.sale.ReduceRate({
        from: _
      }).should.be.rejectedWith(EVMRevert);
    });
  });
});