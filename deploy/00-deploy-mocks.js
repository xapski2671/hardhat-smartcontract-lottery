const { network, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

const BASE_FEE = ethers.utils.parseEther("0.25")
const GAS_PRICE_LINK = 1e9

module.exports = async (hre) => {
  const { getNamedAccounts, deployments } = hre // emptying object contents
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts() // gets default priv key or the account priv key stated in config's deployer object
  const chainId = network.config.chainId // get chainid of network specified in console

  if (developmentChains.includes(network.name)) {
    log("Alternative network detected! Using mocks...")
    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      log: true,
      args: [BASE_FEE, GAS_PRICE_LINK],
    })
    log("Mocks deployed \n ================================")
  }
}

module.exports.tags = ["all", "mocks"]
