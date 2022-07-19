import { ethers, utils } from 'ethers'
import abi from './abi.json' assert {type: "json"}

const provider = new ethers.providers.JsonRpcProvider('https://evm.cronos.org')
const signer = provider.getSigner()
const contract = new ethers.Contract('0xb3DF0a9582361db08EC100bd5d8CB70fa8579f4B', abi, provider)

async function getBlockNumber() {
  const blockNumber = await provider.getBlockNumber()
  console.log(`Block number: ${blockNumber}`)
  return blockNumber
}

async function getChainId() {
  const chainId = await signer.getChainId()
  console.log(`Chain ID: ${chainId}`)
  return chainId
}

async function getPriceForBTC() {
  const roundData = await contract.latestRoundData()
  const decimals = await contract.decimals()
  console.log(`The BTC/USD price is: ${utils.formatUnits(roundData.answer, decimals)}`)
  return roundData.answer
}

async function main() {
  await getBlockNumber()
  await getChainId()
  await getPriceForBTC()
}

main()
