import { ethers, utils, Wallet } from 'ethers'
import fetch from 'node-fetch'
import * as dotenv from 'dotenv'
import abi from './abi.json' assert {type: "json"}

const config = dotenv.config({ path: `.env.local` }).parsed

const provider = new ethers.providers.JsonRpcProvider('https://evm-t3.cronos.org')
const wallet = new Wallet(config.WALLET_PRIVATE_KEY, provider)
const signerWithWallet = wallet.connect(provider)
const contract = new ethers.Contract('0x49354813d8BFCa86f778DfF4120ad80E4D96D74E', abi, signerWithWallet)

function generateBatchId() {
  const batchId = Math.floor(Date.now() / 1000)
  return batchId
}

async function getCityNameBytes32(cityName) {
  return utils.formatBytes32String(cityName)
}

async function getChainId() {
  const chainId = await signerWithWallet.getChainId()
  console.log(`Chain ID: ${chainId}`)
}

async function getWeather(cityName) {
  try {
    const response = await fetch(`https://goweather.herokuapp.com/weather/${cityName}`)
    const data = await response.json();
    console.log(`${cityName} temperature: ${data.temperature}`)
    return (data.temperature)
  } catch (error) {
    console.log(`Error fetching weather: ${error}`)
  }
}

async function reportWeather(batchId, cityName, temperature) {
  const _batchId = batchId
  const _cityName = getCityNameBytes32(cityName)
  const _temperature = temperature
  const data = await contract.reportWeather(_batchId, _cityName, _temperature)
  console.log('Waiting for block confirmations...')
  const result = await data.wait()
  console.log('Finish report weather, tx: ', result.transactionHash)
  return data
}

async function getWeatherFromChain(batchId, cityName) {
  const _cityName = getCityNameBytes32(cityName)
  const data = await contract.getWeather(batchId, _cityName)
  return data
}

async function main() {
  await getChainId()
  const shanghaiTemperature = parseInt(await getWeather('shanghai'))
  const hongkongTemperature = parseInt(await getWeather('hongkong'))
  const londonTemperature = parseInt(await getWeather('london'))
  console.log('---------')

  // shanghaiTemperature
  const batchIdForShanghai = generateBatchId()
  console.log('init shanghaiTemperature', await getWeatherFromChain(batchIdForShanghai, 'shanghai'))
  await reportWeather(batchIdForShanghai, 'shanghai', shanghaiTemperature)
  console.log('later shanghaiTemperature', await getWeatherFromChain(batchIdForShanghai, 'shanghai'))
  console.log('---------')

  // hongkongTemperature
  const batchIdForHongkong = generateBatchId()
  console.log('init hongkongTemperature', await getWeatherFromChain(batchIdForHongkong, 'hongkong'))
  await reportWeather(batchIdForHongkong, 'hongkong', hongkongTemperature)
  console.log('later hongkongTemperature', await getWeatherFromChain(batchIdForHongkong, 'hongkong'))
  console.log('---------')

  // londonTemperature
  const batchIdForLondon = generateBatchId()
  console.log('init londonTemperature', await getWeatherFromChain(batchIdForLondon, 'london'))
  await reportWeather(batchIdForLondon, 'london', londonTemperature)
  console.log('later londonTemperature', await getWeatherFromChain(batchIdForLondon, 'london'))
}

main()