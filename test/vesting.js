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
const Vesting = artifacts.require('COTVesting');


contract('Vesting', function([_, wallet]) {

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

    // Vesting
    this.start = latestTime() + duration.weeks(4);
    this.cliff = duration.weeks(4);
    this.duration = duration.years(4);
    this.revocable = false;
    this.amount = ether(2000000000);
    this.openTime = this.start + this.cliff + this.duration;

    // Deploy Vesting
    this.vesting = await Vesting.new(
      wallet,
      this.start,
      this.cliff,
      this.duration,
      this.revocable
    )
    // transfer tokens to vesting
    await this.token.transfer(this.vesting.address, this.amount);
  });

  describe('Vesting', function() {
    it('Can NOT be call ahead of time', async function() {
      await this.vesting.release(this.token.address).should.be.rejectedWith(EVMRevert);
    });

    it('Can be call after of time', async function() {
      await increaseTimeTo(this.openTime);
      await this.vesting.release(this.token.address).should.be.fulfilled;
    });

    it('Vesting contract balance 0 after vesting release', async function() {
      await increaseTimeTo(this.openTime);
      await this.vesting.release(this.token.address);
      const balance = await this.token.balanceOf(this.vesting.address);
      assert.equal(balance, 0);
    });

    it('beneficiary balance increase after vesting release', async function() {
      await increaseTimeTo(this.openTime);
      const before = await this.token.balanceOf(wallet);
      await this.vesting.release(this.token.address);
      const after = await this.token.balanceOf(wallet);
      assert.isTrue(web3.fromWei(after, 'ether') > web3.fromWei(before, 'ether'));
    });
  });

});