const { ethers } = require("hardhat")

// constructor requirements
const networkConfig = {
  4: {
    name: "rinkeby",
    vrfCoordinatorV2Address: "0x6168499c0cFfCaCD319c818142124B7A15E857ab",
    entranceFee: ethers.utils.parseEther("0.01"),
    gasLane: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc", // gas for request
    subscriptionId: "7936",
    callbackGasLimit: "500000", // the gas they'll use to send your data back to you
    interval: "30",
  },
  31337: {
    name: "hardhat",
    entranceFee: ethers.utils.parseEther("0.01"),
    gasLane: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc", // this is not important cuz we have mocks
    // but the constructor asks for it regardless
    callbackGasLimit: "500000", // the gas they'll use to send your data back to you
    interval: "30",
  },
}

const developmentChains = ["hardhat", "localhost"]

module.exports = { networkConfig, developmentChains }
