const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers, waffle } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Unit Tests", function () {
      let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval
      const chainId = network.config.chainId

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer // default deployer from named accounts in hardhatconfig.js
        // to use deployer globally it has to be emptied into a variable like this
        await deployments.fixture(["all"])
        raffle = await ethers.getContract("Raffle", deployer)
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
        raffleEntranceFee = await raffle.getEntranceFee()
        interval = await raffle.getInterval()
      })

      describe("constructor", function () {
        it("initializes the raffle correctly", async function () {
          // ideally we make our tests have just 1 'assert' statement per it() function
          const raffleState = await raffle.getRaffleState()
          assert.equal(raffleState.toString(), "0") // 0 is for open state
          assert.equal(interval.toString(), networkConfig[chainId]["interval"])
        })
      })

      describe("enterRaffle", function () {
        it("reverts when you don't pay enough", async function () {
          await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughETH")
        })
        it("records players when they enter", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          const playerFromContract = await raffle.getPlayer(0) // first player is me, the deployer
          assert.equal(playerFromContract, deployer)
        })
        it("emits event on enter", async function () {
          await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
            raffle,
            "RaffleEnter" // RaffleEnter is the name of the event to be emitted
          )
        })
        it("doesn't allow entrance when it's calculating", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]) // accelerate the time interval
          await network.provider.send("evm_mine", []) // mine one block for confirmation
          // at this point all the requirements of checkUpkeep() have been met
          // we pretend to be chainlink keepers
          await raffle.performUpkeep([]) // the blank array represents an empty bytes calldata (its argument)
          await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
            "Raffle__NotOpen"
          )
        })
      })

      describe("checkUpkeep", function () {
        it("returns false if people haven't sent any ETH", async function () {
          // keep in mind we did not pay the entrance fee, so there's no money in the contract
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", []) // mine one block for confirmation
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
          // i perform a call process on a function that wouldn't normally allow it, since its not pure or view
          // upkeepNeeded is the result i want from the function so i extract it
          assert(!upkeepNeeded) // remember the assert statement is to return true for the test to pass
          // so we negate the bool, if it's inital value was 'false'
        })
        it("returns false if raffle isn't open", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.request({ method: "evm_mine", params: [] })
          await raffle.performUpkeep([]) // changes the state to calculating
          const raffleState = await raffle.getRaffleState() // stores the new state
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert.equal(raffleState.toString() == "1", upkeepNeeded == false)
        })
        it("returns false if enough time hasn't passed", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() - 1])
          await network.provider.request({ method: "evm_mine", params: [] })
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(!upkeepNeeded)
        })
        it("returns true if enough time has passed, has players, eth, and is open", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.request({ method: "evm_mine", params: [] })
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // 0x is also a way to simulate empty bytes calldata
          assert(upkeepNeeded)
        })
      })

      describe("performUpkeep", function () {
        it("can only run if checkUp returns true", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          // we've fulfilled all the requirements of checkUpkeep
          const tx = await raffle.performUpkeep("0x")
          assert(tx) // tx was successful
        })
        it("reverts if checkup is false", async () => {
          await expect(raffle.performUpkeep("0x")).to.be.reverted
        })
        it("updates the raffle state and emits a requestId", async () => {
          // Too many asserts in this test!
          await raffle.enterRaffle({ value: raffleEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.request({ method: "evm_mine", params: [] })
          const txResponse = await raffle.performUpkeep("0x") // emits requestId
          const txReceipt = await txResponse.wait(1) // waits 1 block
          const raffleState = await raffle.getRaffleState() // updates state
          const requestId = txReceipt.events[1].args.requestId
          assert(requestId.toNumber() > 0)
          assert(raffleState == 1) // 0 = open, 1 = calculating
        })
      })

      describe("fulfillRandomWords", function () {
        beforeEach(async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
        })

        it("can only be called after performUpkeep", async function () {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
          ).to.be.revertedWith("nonexistent request")
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
          ).to.be.revertedWith("nonexistent request")
        })

        // A REALLY BIG TEST
        it("picks a winner, resets the lottery, and sends money", async function () {
          const additionalEntrants = 3
          const startingAccountIndex = 1 // since deployer is accounts[0]
          const accounts = await ethers.getSigners() // gives entire array of hardhat network accounts
          for (let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) {
            // i = 1 i<4 i++
            const accountConnectedRaffle = raffle.connect(accounts[i])
            await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee })
          }

          const startingTimeStamp = await raffle.getLatestTimeStamp()

          //perform upkeep (mimic keepers) fullrandomwords(mimic vrf)  wait for vrf to be called
          await new Promise(async (resolve, reject) => {
            raffle.once("WinnerPicked", async () => {
              // listen to the winnerpicked event once
              try {
                const recentWinner = await raffle.getRecentWinner()
                console.log(recentWinner)
                console.log(accounts[0].address)
                console.log(accounts[1].address)
                console.log(accounts[2].address)
                console.log(accounts[3].address)

                const winnerEndingBalance = await accounts[1].getBalance()
                const raffleState = await raffle.getRaffleState()
                const endingTimeStamp = await raffle.getLatestTimeStamp() // big number
                // console.log(await waffle.provider.getBalance(raffle.address)) // big number should be 0
                const numPlayes = await raffle.getNumberOfPlayers() // this will now be zero
                assert.equal(numPlayes.toString(), "0")
                assert.equal(raffleState.toString(), "0")
                expect(endingTimeStamp.toNumber()).to.be.greaterThan(startingTimeStamp.toNumber())
                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance
                    .add(raffleEntranceFee.mul(additionalEntrants).add(raffleEntranceFee))
                    .toString() // 0 + 30 x 3 + 30
                )
                resolve()
              } catch (e) {
                reject(e)
              }
            })
            // here i'll trigger the winnerpicked event, i can't do this manually on a testnet that's why the event listening is important
            //pretending to be vrf
            // remember the beforeEach function helps us to satisfy checkUpkeep()
            const tx = await raffle.performUpkeep([])
            const txReceipt = await tx.wait(1)
            //mimic vrf
            const winnerStartingBalance = await accounts[1].getBalance() // we already know account 1 wins cuz mock uses pseudo randomness
            await vrfCoordinatorV2Mock.fulfillRandomWords(
              txReceipt.events[1].args.requestId, //events[1] cuz vrfcoord already emits its own
              raffle.address
            ) // now winnerpicked event will have been emitted
          })
        })
      })
    })
