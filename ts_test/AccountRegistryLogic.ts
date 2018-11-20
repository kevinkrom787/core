import * as BigNumber from "bignumber.js"
import * as Web3 from "web3"
import * as ethereumjsWallet from "ethereumjs-wallet"
const walletTools = require("ethereumjs-wallet")
const { privateToAddress } = require("ethereumjs-util")
import { signAddress } from "./../src/signAddress"
const ethSigUtil = require("eth-sig-util")
const { soliditySha3 } = require("web3-utils")
const uuid = require("uuidv4")
import { bufferToHex } from "ethereumjs-util"
import { hashData } from "./../src/signData"

import { AccountRegistryLogicInstance } from "../truffle"
import { EVMThrow } from "./helpers/EVMThrow"
import * as ipfs from "./../src/ipfs"

import { should } from "./test_setup"
import { getFormattedTypedDataAddAddress, getFormattedTypedDataRemoveAddress } from "./helpers/signingLogic"

const SigningLogic = artifacts.require("SigningLogic")
const AccountRegistryLogic = artifacts.require("AccountRegistryLogic")

contract("AccountRegistryLogic", function([owner, alice, bob, unclaimed, unclaimedB]) {
  let registryLogic: AccountRegistryLogicInstance
  let registryLogicAddress: string

  // Keys come from default ganache mnemonic

  const aliceWallet = ethereumjsWallet.fromPrivateKey(new Buffer("ae6ae8e5ccbfb04590405997ee2d52d2b330726137b875053c36d94e974d162f", "hex"))
  const alicePrivkey = aliceWallet.getPrivateKey()

  const bobWallet = ethereumjsWallet.fromPrivateKey(new Buffer("0dbbe8e4ae425a6d2687f1a7e3ba17bc98c673636790f1b8ad91193c05875ef1", "hex"))
  const bobPrivkey = bobWallet.getPrivateKey()

  const unclaimedWallet = ethereumjsWallet.fromPrivateKey(new Buffer("c88b703fb08cbea894b6aeff5a544fb92e78a18e19814cd85da83b71f772aa6c", "hex"))
  const unclaimedPrivkey = unclaimedWallet.getPrivateKey()

  const unclaimedWalletB = ethereumjsWallet.fromPrivateKey(new Buffer("388c684f0ba1ef5017716adb5d21a053ea8e90277d0868337519f97bede61418", "hex"))
  const unclaimedPrivkeyB = unclaimedWalletB.getPrivateKey()

  let aliceId: BigNumber.BigNumber
  let bobId: BigNumber.BigNumber

  // Sanity check
  if (alice != aliceWallet.getAddressString()) {
    throw new Error("Mnemonic used for truffle tests out of sync?")
  }

  // Sanity check
  if (bob != bobWallet.getAddressString()) {
    throw new Error("Mnemonic used for truffle tests out of sync?")
  }

  // Sanity check
  if (unclaimed != unclaimedWallet.getAddressString()) {
    throw new Error("Mnemonic used for truffle tests out of sync?")
  }

  // Sanity check
  if (unclaimedB != unclaimedWalletB.getAddressString()) {
    throw new Error("Mnemonic used for truffle tests out of sync?")
  }

  let newAddressLinkSig: string
  let currentAddressLinkSig: string
  let nonceHash: string
  let differentNonceHash: string

  beforeEach(async () => {
    registryLogic = await AccountRegistryLogic.new();
    registryLogicAddress = registryLogic.address
    const nonce = uuid();
    const differentNonce = uuid();
    nonceHash = bufferToHex(hashData(nonce));
    differentNonceHash = bufferToHex(hashData(differentNonce));

    newAddressLinkSig = ethSigUtil.signTypedData(unclaimedPrivkey, {
      data: getFormattedTypedDataAddAddress(registryLogicAddress, 1, alice, nonceHash)
    });

    currentAddressLinkSig = ethSigUtil.signTypedData(alicePrivkey, {
      data: getFormattedTypedDataAddAddress(registryLogicAddress, 1, unclaimed, nonceHash)
    });
  })


  describe("Linking Accounts", async () => {
    it.only("Allows a user to add an unclaimed address to their account", async () => {
      await registryLogic.linkAddresses(alice, currentAddressLinkSig, unclaimed, newAddressLinkSig, nonceHash, { from: alice }).should.be.fulfilled
    })

    it.only("Allows anyone to submit the link tx", async () => {
      await registryLogic.linkAddresses(alice, currentAddressLinkSig, unclaimed, newAddressLinkSig, nonceHash, { from: bob }).should.be.fulfilled
    })

    it.only("Fails if nonce hash wrong", async () => {
      await registryLogic
        .linkAddresses(alice, currentAddressLinkSig, unclaimed, newAddressLinkSig, differentNonceHash, { from: alice })
        .should.be.rejectedWith(EVMThrow)
    })

    it.only("Does not allow address to be added if does not match the current address sig", async () => {
      await registryLogic
        .linkAddresses(
          alice,
          ethSigUtil.signTypedData(alicePrivkey, {
            data: getFormattedTypedDataAddAddress(registryLogicAddress, 1, unclaimedB, nonceHash)
          }),
          unclaimed,
          newAddressLinkSig,
          nonceHash
        )
        .should.rejectedWith(EVMThrow)
    })

    it.only("Does not allow address to be added if does not match the current address sig", async () => {
      await registryLogic
        .linkAddresses(
          alice,
          ethSigUtil.signTypedData(alicePrivkey, {
            data: getFormattedTypedDataAddAddress(registryLogicAddress, 1, unclaimedB, nonceHash)
          }),
          unclaimedB,
          newAddressLinkSig,
          nonceHash
        )
        .should.rejectedWith(EVMThrow)
    })

    it.only("Does not allow address to be added if does not match the newAddress sig", async () => {
      await registryLogic
        .linkAddresses(
          alice,
          currentAddressLinkSig,
          unclaimed,
          ethSigUtil.signTypedData(unclaimedPrivkey, {
            data: getFormattedTypedDataAddAddress(registryLogicAddress, 1, bob, nonceHash)
          }),
          nonceHash
        )
        .should.rejectedWith(EVMThrow)
    })

    it.only("Does not allow address to be added if does not match the newAddress sig", async () => {
      await registryLogic
        .linkAddresses(
          bob,
          currentAddressLinkSig,
          unclaimed,
          ethSigUtil.signTypedData(unclaimedPrivkey, {
            data: getFormattedTypedDataAddAddress(registryLogicAddress, 1, bob, nonceHash)
          }),
          nonceHash
        )
        .should.rejectedWith(EVMThrow)
    })

    interface AdditionEventArgs {
      currentAddress: string
      newAddress: string
      linkId: BigNumber.BigNumber
    }

    it.only("Emits an event when an address is added", async () => {
      const { logs } = ((await registryLogic.linkAddresses(alice, currentAddressLinkSig, unclaimed, newAddressLinkSig, nonceHash, {
        from: alice
      })) as Web3.TransactionReceipt<any>) as Web3.TransactionReceipt<AdditionEventArgs>

      const matchingLog = logs.find(log => log.event === "AddressLinked")

      should.exist(matchingLog)
      if (!matchingLog) return

      matchingLog.args.currentAddress.should.equal(alice)
      matchingLog.args.newAddress.should.equal(unclaimed)
      matchingLog.args.linkId.should.bignumber.equal(1)
    })

    it.only("Does not allow a new address to be linked if it is already linked to another address", async () => {
      await registryLogic.linkAddresses(alice, currentAddressLinkSig, unclaimed, newAddressLinkSig, nonceHash, { from: alice }).should.be.fulfilled
      await registryLogic
        .linkAddresses(
          bob,
          ethSigUtil.signTypedData(bobPrivkey, {
            data: getFormattedTypedDataAddAddress(registryLogicAddress, 1, unclaimed, nonceHash)
          }),
          unclaimed,
          ethSigUtil.signTypedData(unclaimedPrivkey, {
            data: getFormattedTypedDataAddAddress(registryLogicAddress, 1, bob, nonceHash)
          }),
          nonceHash,
          { from: alice }
        )
        .should.be.rejectedWith(EVMThrow)
    })

    it.only("Allows a user to unlink address from linked sender", async () => {
      await registryLogic.linkAddresses(alice, currentAddressLinkSig, unclaimed, newAddressLinkSig, nonceHash, { from: alice }).should.be.fulfilled
      await registryLogic.unlinkAddress(
        alice,
        unclaimed,
        nonceHash,
        ethSigUtil.signTypedData(alicePrivkey, {
          data: getFormattedTypedDataRemoveAddress(registryLogicAddress, 1, unclaimed, nonceHash)
        }),
        { from: alice }
      ).should.be.fulfilled
      ;(await registryLogic.linkIds(unclaimed)).should.be.bignumber.equal(0)
    })

    it.only("Allows a user to unlink self", async () => {
      await registryLogic.linkAddresses(alice, currentAddressLinkSig, unclaimed, newAddressLinkSig, nonceHash, { from: alice }).should.be.fulfilled
      await registryLogic.unlinkAddress(
        alice,
        alice,
        nonceHash,
        ethSigUtil.signTypedData(alicePrivkey, {
          data: getFormattedTypedDataRemoveAddress(registryLogicAddress, 1, alice, nonceHash)
        }),
        { from: alice }
      ).should.be.fulfilled
      ;(await registryLogic.linkIds(alice)).should.be.bignumber.equal(0)
    })

    it.only("Allows anyone to submit valid unlink signatures", async () => {
      await registryLogic.linkAddresses(alice, currentAddressLinkSig, unclaimed, newAddressLinkSig, nonceHash, { from: alice }).should.be.fulfilled
      await registryLogic.unlinkAddress(
        alice,
        unclaimed,
        nonceHash,
        ethSigUtil.signTypedData(alicePrivkey, {
          data: getFormattedTypedDataRemoveAddress(registryLogicAddress, 1, unclaimed, nonceHash)
        }),
        { from: bob }
      ).should.be.fulfilled
      ;(await registryLogic.linkIds(unclaimed)).should.be.bignumber.equal(0)
    })

    interface UnlinkEventArgs {
      senderAddress: string
      addressToRemove: string
    }

    it.only("Emits an event when an address is removed", async () => {
      await registryLogic.linkAddresses(alice, currentAddressLinkSig, unclaimed, newAddressLinkSig, nonceHash, { from: alice }).should.be.fulfilled
      const { logs } = ((await registryLogic.unlinkAddress(
        alice,
        unclaimed,
        nonceHash,
        ethSigUtil.signTypedData(alicePrivkey, {
          data: getFormattedTypedDataRemoveAddress(registryLogicAddress, 1, unclaimed, nonceHash)
        }),
        { from: alice }
      )) as Web3.TransactionReceipt<any>) as Web3.TransactionReceipt<UnlinkEventArgs>

      const matchingLog = logs.find(log => log.event === "AddressUnlinked")

      should.exist(matchingLog)
      if (!matchingLog) return

      matchingLog.args.senderAddress.should.equal(alice)
      matchingLog.args.addressToRemove.should.equal(unclaimed)
    })

    it.only("Does not allow user to unlink address not linked to signer", async () => {
      await registryLogic.linkAddresses(alice, currentAddressLinkSig, unclaimed, newAddressLinkSig, nonceHash, { from: alice }).should.be.fulfilled
      await registryLogic
        .unlinkAddress(
          bob,
          unclaimed,
          nonceHash,
          ethSigUtil.signTypedData(bobPrivkey, {
            data: getFormattedTypedDataRemoveAddress(registryLogicAddress, 1, unclaimed, nonceHash)
          }),
          { from: bob }
        )
        .should.be.rejectedWith(EVMThrow)
    })

    it.only("Does not allow link sig to be replayed", async () => {
      await registryLogic.linkAddresses(alice, currentAddressLinkSig, unclaimed, newAddressLinkSig, nonceHash, { from: alice }).should.be.fulfilled
      await registryLogic.unlinkAddress(
        alice,
        unclaimed,
        nonceHash,
        ethSigUtil.signTypedData(alicePrivkey, {
          data: getFormattedTypedDataRemoveAddress(registryLogicAddress, 1, unclaimed, nonceHash)
        }),
        { from: alice }
      ).should.be.fulfilled
      await registryLogic
        .linkAddresses(alice, currentAddressLinkSig, unclaimed, newAddressLinkSig, nonceHash, { from: alice })
        .should.be.rejectedWith(EVMThrow)
    })

    it.only("Allows user to relink address that has been unlinked using new sig", async () => {
      await registryLogic.linkAddresses(alice, currentAddressLinkSig, unclaimed, newAddressLinkSig, nonceHash, { from: alice }).should.be.fulfilled
      await registryLogic.unlinkAddress(
        alice,
        unclaimed,
        nonceHash,
        ethSigUtil.signTypedData(alicePrivkey, {
          data: getFormattedTypedDataRemoveAddress(registryLogicAddress, 1, unclaimed, nonceHash)
        }),
        { from: alice }
      ).should.be.fulfilled
      await registryLogic.linkAddresses(
        alice,
        ethSigUtil.signTypedData(alicePrivkey, { data: getFormattedTypedDataAddAddress(registryLogicAddress, 1, unclaimed, differentNonceHash) }),
        unclaimed,
        ethSigUtil.signTypedData(unclaimedPrivkey, { data: getFormattedTypedDataAddAddress(registryLogicAddress, 1, alice, differentNonceHash) }),
        differentNonceHash,
        { from: alice }
      ).should.be.fulfilled
    })
  })

})
