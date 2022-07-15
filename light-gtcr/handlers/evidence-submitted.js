const fetch = require('node-fetch')
const delay = require('delay')

const { truncateETHAddress, articleFor } = require('../../utils/string')
const { ITEM_STATUS } = require('../../utils/enums')
const { dbAttempt } = require('../../utils/db-attempt')
const { submitTweet } = require('../../utils/submit-tweet')
const { networks } = require('../../utils/networks')
const { mainListFilter } = require('../../utils/main-list-filter')

module.exports = ({
  tcr,
  tcrMetaEvidence,
  twitterClient,
  bitly,
  db,
  network
}) => async (_arbitrator, evidenceGroupID, party) => {
  const isRelevant = await mainListFilter(network.chainId, tcr.address)
  if (!isRelevant) {
    console.log('Irrelevant interaction, ignoring...')
    return
  }

  // When someone challenges a request with evidence, two handlers would
  // be dispatched simultaneously (Dispute, Evidence).
  // Which can result in the key not being found depending if the
  // evidence executes faster.
  // We work around this with a simple delay.
  await delay(40 * 1000)

  const subgraphQuery = {
    query: `
      {
        lrequests (where: { evidenceGroupID: "${evidenceGroupID}"}) {
          item {
            itemID
          }
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
  const latestRequest = lrequests ? lrequests[0] : {}
  const { item } = latestRequest || {}
  const { itemID } = item || {}
  if (!itemID) throw new Error(`Could not find item ID`, subgraphQuery)

  const { status } = await tcr.getItemInfo(itemID)
  const {
    metadata: { itemName, tcrTitle }
  } = tcrMetaEvidence

  const [shortenedLink, tweetID] = await Promise.all([
    bitly.shorten(
      `${process.env.GTCR_UI_URL}/tcr/${network.chainId}/${tcr.address}/${itemID}`
    ),
    dbAttempt(`${network.chainId}-${tcr.address}-${itemID}`, db)
  ])

  const message = `New evidence has been submitted by ${truncateETHAddress(
    party
  )} on the ${
    status === ITEM_STATUS.REMOVAL_REQUESTED ? 'removal request' : 'submission'
  } of ${articleFor(itemName)} ${itemName} ${
    status === ITEM_STATUS.REMOVAL_REQUESTED ? 'from the' : 'to the'
  } ${tcrTitle} List in ${networks[network.chainId].name}.
      \n\nListing: ${shortenedLink}`

  console.info(message)

  await submitTweet(
    tweetID,
    message,
    db,
    twitterClient,
    `${network.chainId}-${tcr.address}-${itemID}`
  )
}
