import { createWatcher } from '@makerdao/multicall';
import { ethers, utils, Wallet, FixedNumber } from 'ethers'
import fetch from 'node-fetch'
import * as dotenv from 'dotenv'

import abi from '../weather/abi.json' assert {type: "json"}

const envConfig = dotenv.config({ path: `.env.local` }).parsed

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateBatchId() {
  const batchId = Math.floor(Date.now() / 1000)
  return batchId
}
function getCityNameBytes32(cityName) {
  return utils.formatBytes32String(cityName)
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

const provider = new ethers.providers.JsonRpcProvider('https://evm-t3.cronos.org')
const wallet = new Wallet(envConfig.WALLET_PRIVATE_KEY, provider)
const signerWithWallet = wallet.connect(provider)
const contract = new ethers.Contract('0x49354813d8BFCa86f778DfF4120ad80E4D96D74E', abi, signerWithWallet)

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

const config = {
  rpcUrl: 'https://evm-t3.cronos.org/',
  multicallAddress: '0x47c655D6bE8c362A4Fd0accF6d76c58CBc3006A6',
}

const batchIdForShanghai = generateBatchId()
await sleep(1000)
const batchIdForHongkong = generateBatchId()
await sleep(1000)
const batchIdForLondon = generateBatchId()

const watcher = createWatcher(
  [
    {
      target: '0x49354813d8BFCa86f778DfF4120ad80E4D96D74E',
      call: [
        'getWeather(uint32,bytes32)(uint32)',
        batchIdForShanghai,
        getCityNameBytes32('shanghai')
      ],
      returns: [['init shanghai weather', val => val]]
    },
    {
      target: '0x49354813d8BFCa86f778DfF4120ad80E4D96D74E',
      call: [
        'getWeather(uint32,bytes32)(uint32)',
        batchIdForHongkong,
        getCityNameBytes32('hongkong')
      ],
      returns: [['init hongkong weather', val => val]]
    },
    {
      target: '0x49354813d8BFCa86f778DfF4120ad80E4D96D74E',
      call: [
        'getWeather(uint32,bytes32)(uint32)',
        batchIdForLondon,
        getCityNameBytes32('london')
      ],
      returns: [['init london weather', val => val]]
    },
  ],
  config
);

// watcher.subscribe(events => {
//   console.log(events)
// });

watcher.batch().subscribe(events => {
  if (events.length === 1) return
  console.log(events)
});

watcher.start();

const shanghaiTemperature = parseInt(await getWeather('shanghai'))
const hongkongTemperature = parseInt(await getWeather('hongkong'))
const londonTemperature = parseInt(await getWeather('london'))
console.log('---------')

await reportWeather(batchIdForShanghai, 'shanghai', shanghaiTemperature)
await reportWeather(batchIdForHongkong, 'hongkong', hongkongTemperature)
await reportWeather(batchIdForLondon, 'london', londonTemperature)

watcher.awaitInitialFetch().then(() => {
  console.log('Initial fetch completed');
  setTimeout(() => {
    console.log('Updating calls...');
    watcher.tap(calls =>
      calls = ([
        {
          target: '0x49354813d8BFCa86f778DfF4120ad80E4D96D74E',
          call: [
            'getWeather(uint32,bytes32)(uint32)',
            batchIdForShanghai,
            getCityNameBytes32('shanghai')
          ],
          returns: [['later shanghai weather', val => val]]
        },
        {
          target: '0x49354813d8BFCa86f778DfF4120ad80E4D96D74E',
          call: [
            'getWeather(uint32,bytes32)(uint32)',
            batchIdForHongkong,
            getCityNameBytes32('hongkong')
          ],
          returns: [['later hongkong weather', val => val]]
        },
        {
          target: '0x49354813d8BFCa86f778DfF4120ad80E4D96D74E',
          call: [
            'getWeather(uint32,bytes32)(uint32)',
            batchIdForLondon,
            getCityNameBytes32('london')
          ],
          returns: [['later london weather', val => val]]
        },
      ])
    ).then(() => {
      console.log('Fetch completed');
      watcher.stop()
      process.exit()
    });
  }, 1000);
});


