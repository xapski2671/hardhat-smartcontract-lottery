const { run } = require("hardhat")

const verify = async (contractAddress, args) => {
  console.log("Verifying Contract....")
  try {
    await run("verify:verify", {
      address: contractAddress, // addr of contract to be verified
      constructorArguments: args, // constructor args
    })
  } catch (error) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("Already verified")
    } else {
      console.log(error)
    }
  }
}

module.exports = { verify }
