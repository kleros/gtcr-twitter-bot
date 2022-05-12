const ethers = require('ethers')
const level = require('level')
const Twitter = require('twitter-lite')
const fetch = require('node-fetch')

const _GTCRFactory = require('./abis/GTCRFactory.json')
const _GeneralizedTCRView = require('./abis/GeneralizedTCRView.json')
const _LightGTCRFactory = require('./abis/LightGTCRFactory.json')
const _LightGeneralizedTCRView = require('./abis/LightGeneralizedTCRView.json')

// const gtcrBot = require('./gtcr')
const lightGtcrBot = require('./light-gtcr')

const db = level('./db')
let twitterClient
if (
  !!process.env.CONSUMER_KEY &&
  !!process.env.CONSUMER_SECRET &&
  !!process.env.ACCESS_TOKEN &&
  !!process.env.ACCESS_TOKEN_SECRET
)
  twitterClient = new Twitter({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
  })

const NETWORKS = Object.freeze({
  ethereum: 1,
  xDai: 100
})

const providerUrls = JSON.parse(process.env.PROVIDER_URLS)

const providerMainnet = new ethers.providers.JsonRpcProvider(
  providerUrls[NETWORKS.ethereum]
)
const providerXDai = new ethers.providers.JsonRpcProvider(
  providerUrls[NETWORKS.xDai]
)
providerMainnet.pollingInterval = 60 * 1000 // Poll every minute.
providerXDai.pollingInterval = 60 * 1000 // Poll every minute.

// const factoryAddresses = JSON.parse(process.env.FACTORY_ADDRESSES)

// const gtrcViewAddresses = JSON.parse(process.env.GENERALIZED_TCR_VIEW_ADDRESSES)

const lFactoryAddresses = JSON.parse(process.env.LFACTORY_ADDRESSES)

const lGtrcViewAddresses = JSON.parse(
  process.env.LGENERALIZED_TCR_VIEW_ADDRESSES
)

// const gtcrFactoryMainnet = new ethers.Contract(
//   factoryAddresses[NETWORKS.ethereum],
//   _GTCRFactory,
//   providerMainnet
// )

// const gtcrFactoryXDai = new ethers.Contract(
//   factoryAddresses[NETWORKS.xDai],
//   _GTCRFactory,
//   providerXDai
// )

// const gtcrViewMainnet = new ethers.Contract(
//   gtrcViewAddresses[NETWORKS.ethereum],
//   _GeneralizedTCRView,
//   providerMainnet
// )

// const gtcrViewXDai = new ethers.Contract(
//   gtrcViewAddresses[NETWORKS.xDai],
//   _GeneralizedTCRView,
//   providerXDai
// )

const lightGtcrFactoryMainnet = new ethers.Contract(
  lFactoryAddresses[NETWORKS.ethereum],
  _LightGTCRFactory,
  providerMainnet
)

const lightGtcrFactoryXDai = new ethers.Contract(
  lFactoryAddresses[NETWORKS.xDai],
  _LightGTCRFactory,
  providerXDai
)

const lightGtcrViewMainnet = new ethers.Contract(
  lGtrcViewAddresses[NETWORKS.ethereum],
  _LightGeneralizedTCRView,
  providerMainnet
)

const lightGtcrViewXDai = new ethers.Contract(
  lGtrcViewAddresses[NETWORKS.xDai],
  _LightGeneralizedTCRView,
  providerXDai
)

;(async () => {
  console.info('Instantiating bitly client:', process.env.BITLY_TOKEN)
  const groupIDResponse = await fetch('https://api-ssl.bitly.com/v4/groups', {
    method: 'get',
    headers: {
      Authorization: `Bearer ${process.env.BITLY_TOKEN}`
    }
  })

  const groupID = (await groupIDResponse.json()).groups[0].guid
  console.info(`Got bitly groupID ${groupID}`)

  const bitly = {
    shorten: async url =>
      `https://${
        (
          await (
            await fetch('https://api-ssl.bitly.com/v4/shorten', {
              method: 'post',
              headers: {
                Authorization: `Bearer ${process.env.BITLY_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                long_url: url,
                group_guid: groupID
              })
            })
          ).json()
        ).id
      }`
  }

  // // initialize gtrcBot for Mainnet
  // gtcrBot(
  //   providerMainnet,
  //   gtcrFactoryMainnet,
  //   twitterClient,
  //   gtcrViewMainnet,
  //   db,
  //   bitly
  // )

  // // initialize gtrcBot for xDai chain
  // gtcrBot(providerXDai, gtcrFactoryXDai, twitterClient, gtcrViewXDai, db, bitly)

  // initialize gtrcBot for Mainnet
  lightGtcrBot(
    providerMainnet,
    lightGtcrFactoryMainnet,
    twitterClient,
    lightGtcrViewMainnet,
    db,
    bitly
  )

  // initialize gtrcBot for xDai chain
  lightGtcrBot(
    providerXDai,
    lightGtcrFactoryXDai,
    twitterClient,
    lightGtcrViewXDai,
    db,
    bitly
  )
})()
