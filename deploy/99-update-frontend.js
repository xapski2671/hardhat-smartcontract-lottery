const {network, ethers} = require("hardhat")
const fs = require("fs")

const FRONT_END_ADDRESES_FILE = "../nextjs-lottery/constants/contractAddresses.json"
const FRONT_END_ABI_FILE = "../nextjs-lottery/constants/abi.json"

module.exports = async function () {
  if(process.env.UPDATE_FRONT_END)
  {
    console.log("updating front end..")
    updateContractAddresses()
    updateAbi()
  } 
}

async function updateContractAddresses() 
{
  const raffle = await ethers.getContract("Raffle")
  const currentAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESES_FILE, "utf8"))  // read object from file
  chainId = network.config.chainId.toString()
  if(chainId in currentAddresses)  // current addresses now object containing chainIds and the respective contract addresses
  {
    if(!currentAddresses[chainId].includes(raffle.address))
    {
      currentAddresses[chainId].push(raffle.address)  // add this new contract address
    }
  }
  else
  {
    currentAddresses[chainId] = [raffle.address]  // make the array with this contract address
  }
  fs.writeFileSync(FRONT_END_ADDRESES_FILE, JSON.stringify(currentAddresses))  // writing back to file
}

async function updateAbi()
{
  const raffle = await ethers.getContract("Raffle")
  fs.writeFileSync(FRONT_END_ABI_FILE, raffle.interface.format(ethers.utils.FormatTypes.json))  // creating abi from ethers lib
}

module.exports.tags = ["all", "frontend"]