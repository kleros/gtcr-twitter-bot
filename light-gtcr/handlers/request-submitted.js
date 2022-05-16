const fetch = require('node-fetch')
const delay = require('delay')

const { articleFor, truncateETHValue } = require('../../utils/string')
const { submitTweet } = require('../../utils/submit-tweet')
const { networks } = require('../../utils/networks')

module.exports = ({
  tcr,
  tcrMetaEvidence,
  tcrArbitrableData,
  twitterClient,
  bitly,
  db,
  network
}) => async (_itemID, _evidenceGroupID) => {
  const {
    metadata: { itemName, tcrTitle }
  } = tcrMetaEvidence
  const {
    formattedEthValues: { submissionBaseDeposit, removalBaseDeposit }
  } = tcrArbitrableData

  const shortenedLink = await bitly.shorten(
    `${process.env.GTCR_UI_URL}/tcr/${network.chainId}/${tcr.address}/${_itemID}`
  )

  // Wait a bit to ensure subgraph is synced.
  await delay(20 * 1000)
  const subgraphQuery = {
    query: `
      {
        lrequests (where: { evidenceGroupID: "${_evidenceGroupID}"}) {
          requestType
        }
      }
    `
  }
  const gtrcSubgraphUrls = JSON.parse(process.env.GTCR_SUBGRAPH_URLS)
  const response = await fetch(gtrcSubgraphUrls[network.chainId], {
    method: 'POST',
    body: JSON.stringify(subgraphQuery)
  })

  const parsedValues = await response.json()
  const { data } = parsedValues || {}
  const { lrequests } = data || {}
  const latestRequest = lrequests[0] || {}
  const { requestType } = latestRequest || {}
  if (!requestType)
    throw new Error(`Request type not found bailing.`, subgraphQuery)

  const depositETH = truncateETHValue(
    requestType === 'RegistrationRequested'
      ? submissionBaseDeposit
      : removalBaseDeposit
  )

  // todo itemName could make message too large
  const message = `Someone ${
    requestType === 'RegistrationRequested'
      ? 'submitted'
      : 'requested the removal of'
  } ${articleFor(itemName)} ${itemName} ${
    requestType === 'RegistrationRequested' ? 'to' : 'from'
  } ${tcrTitle}, a list in ${
    networks[network.chainId].name
  }. Verify it for a chance to win ${depositETH} #${
    networks[network.chainId].currency
  }\n\nListing: ${shortenedLink}`

  console.info(message)

  // there is no tweetID because this is the first message, so it's null
  await submitTweet(
    null,
    message,
    db,
    twitterClient,
    `${network.chainId}-${tcr.address}-${_itemID}`
  )
}
