// import { advanceBlock } from "./helpers/advanceToBlock";
// import { latestBlockTime } from "./helpers/latestBlockNumber";

import * as BigNumber from "bignumber.js";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";

import { MockBLTInstance, AccountRegistryInstance } from "./../truffle";

const chaiBignumber = require("chai-bignumber");

chai
  .use(chaiAsPromised)
  .use(chaiBignumber(web3.BigNumber))
  .should();

const AccountRegistry = artifacts.require("AccountRegistry");
// const InviteCollateralizer = artifacts.require("InviteCollateralizer");
const MockBLT = artifacts.require("./helpers/MockBLT");

contract("AccountRegistry", function([owner, alice, bob]) {
  let token: MockBLTInstance;
  let registry: AccountRegistryInstance;
  let collateralizer: string;

  beforeEach(async () => {
    token = await MockBLT.new();
    registry = await AccountRegistry.new(token.address);
    collateralizer = await registry.inviteCollateralizer();
  });

  const setupOwner = async () => {
    await token.gift(owner);
    return token.approve(collateralizer, new BigNumber("1e18"));
  };

  const inviteAlice = async () => {
    await setupOwner();
    return registry.invite(alice);
  };

  it("allows existing users to invite others if they collateralize some BLT", async () => {
    await setupOwner();

    (await registry.invites(alice)).should.be.false;
    await registry.invite(alice);
    (await registry.invites(alice)).should.be.true;
  });

  it("fails if the invited user already has an account", async () => {
    await inviteAlice();

    await registry.invite(alice).should.be.rejectedWith("invalid opcode");
  });

  it("fails if the invited user already has an invite", async () => {
    await setupOwner();

    await registry.invite(alice).should.be.fulfilled;
    await registry.invite(alice).should.be.rejectedWith("invalid opcode");
  });

  it("fails if the inviter does not have any BLT", async () => {
    await registry.invite(alice).should.be.rejectedWith("invalid opcode");
  });

  it("fails if the inviter has not approved the collateralizer", async () => {
    await token.gift(owner);

    await registry.invite(alice).should.be.rejectedWith("invalid opcode");
  });

  it("fails if the inviter does not have an account", async () => {
    await token.gift(alice);
    await token.approve(collateralizer, new BigNumber("1e18"), {
      from: alice
    });

    await registry
      .invite(bob, { from: alice })
      .should.be.rejectedWith("invalid opcode");
  });

  describe("invitation admin", async () => {
    it("allows the invite admin to instantly create an account for people", async () => {
      (await registry.accounts(bob)).should.be.false;

      await registry.createAccount(bob);

      (await registry.accounts(bob)).should.be.true;
    });

    it("does not allow anyone else to instantly create accounts", async () => {
      await registry
        .createAccount(bob, { from: alice })
        .should.be.rejectedWith("invalid opcode");
    });

    it("throws an error if the user already has an account", async () => {
      await registry.createAccount(bob).should.be.fulfilled;
      await registry
        .createAccount(bob)
        .should.be.rejectedWith("invalid opcode");
    });
  });

  describe("accepting invites", async () => {
    beforeEach(inviteAlice);

    it("creates an account when user accepts invite", async () => {
      (await registry.accounts(alice)).should.be.false;
      await registry.acceptInvite({ from: alice });
      (await registry.accounts(alice)).should.be.true;
    });

    it("deletes the invite when user accepts it", async () => {
      (await registry.invites(alice)).should.be.true;
      await registry.acceptInvite({ from: alice });
      (await registry.invites(alice)).should.be.false;
    });
  });
});
