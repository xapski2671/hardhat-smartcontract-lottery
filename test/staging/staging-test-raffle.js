const { assert, expect } = require("chai")
const { network, getNamedAccounts, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Staging Tests", function () {
      let raffle, raffleEntranceFee, deployer
      // const chainId = network.config.chainId

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer // default deployer from named accounts in hardhatconfig.js
        // to use deployer globally it has to be emptied into a variable like this
        // await deployments.fixture(["all"])  // caannot do this in staging tests
        raffle = await ethers.getContract("Raffle", deployer)
        raffleEntranceFee = await raffle.getEntranceFee()
      })

      describe("fulfillRandomWords", function () {
        it("works with live Chainlink VRF and Keepers, we get a random winner", async function () {
          const startingTimeStamp = await raffle.getLatestTimeStamp()
          const accounts = await ethers.getSigners()
          // we setup the listener before we enter the raffle just to be safe
          await new Promise(async (resolve, reject) => {
            raffle.once("WinnerPicked", async () => {
              // listener
              console.log("--winner event fired!!--")
              try {
                // asserts will be here
                const recentWinner = await raffle.getRecentWinner()
                console.log(recentWinner)
                const raffleState = await raffle.getRaffleState()
                console.log(raffleState)
                const winnerEndingBalance = await accounts[0].getBalance()
                console.log(winnerEndingBalance)
                const endingTimeStamp = await raffle.getLatestTimeStamp()
                console.log(endingTimeStamp)
                const numPlayers = await raffle.getNumberOfPlayers()
                console.log(numPlayers)

                assert.equal(numPlayers.toString(), "0")
                assert.equal(recentWinner.toString(), accounts[0].address)
                assert.equal(raffleState.toNumber(), 0)
                const balance = await ethers.provider.getBalance(raffle.address)
                console.log(balance)
                assert.equal(balance.toString(), "0")
                expect(endingTimeStamp.toNumber()).to.be.greaterThan(startingTimeStamp.toNumber())
                // const { gasUsed, effectiveGasPrice } = txReceipt
                // const gasCost = gasUsed.mul(effectiveGasPrice)
                // assert.equal(
                //   winnerEndingBalance.toString(),
                //   winnerStartingBalance.add(raffleEntranceFee).toString()
                // )
                // assert(endingTimeStamp.toNumber() > startingTimeStamp.toNumber())
                resolve()
              } catch (e) {
                console.log(e)
                reject(e)
              }
            })

            // here we trigger the winnerpicked event
            await raffle.enterRaffle({ value: raffleEntranceFee })
            const winnerStartingBalance = await accounts[0].getBalance()
          })
        })
      })
    })
