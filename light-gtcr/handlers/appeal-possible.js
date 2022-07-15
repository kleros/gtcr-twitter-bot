const ethers = require('ethers')
const _LightGeneralizedTCR = require('../../abis/LightGeneralizedTCR.json')
const { dbAttempt } = require('../../utils/db-attempt')
const { LGTCRS } = require('../../utils/enums')
const { mainListFilter } = require('../../utils/main-list-filter')
const { networks } = require('../../utils/networks')
const { submitTweet } = require('../../utils/submit-tweet')

module.exports = ({
  twitterClient,
  bitly,
  db,
  network,
  provider,
  arbitrator
}) => async (_disputeID, _arbitrable) => {
  // Detect if this is related to a gtcr instance
  let lgtcrs = {}
  try {
    lgtcrs = JSON.parse(await db.get(LGTCRS))
  } catch (err) {
    if (err.type !== 'NotFoundError') throw new Error(err) // Ignore event
  }
  if (!lgtcrs[_arbitrable.toLowerCase()]) return // Event not related to a light-gtcr.

  const tcr = new ethers.Contract(_arbitrable, _LightGeneralizedTCR, provider)

  const isRelevant = await mainListFilter(network.chainId, tcr.address)
  if (!isRelevant) {
    console.log('Irrelevant interaction, ignoring...')
    return
  }

  let itemID
  try {
    itemID = await tcr.arbitratorDisputeIDToItemID(
      arbitrator.address,
      Number(_disputeID)
    )
  } catch (err) {
    console.error(
      `Error fetching itemID (AppealPossible), tcrAddr ${
        tcr.address
      }, disputeID ${Number(_disputeID)}, arbitrable ${_arbitrable}`,
      err
    )
    return
  }

  const [shortenedLink, tweetID] = await Promise.all([
    bitly.shorten(
      `${process.env.GTCR_UI_URL}/tcr/${network.chainId}/${tcr.address}/${itemID}`
    ),
    dbAttempt(`${network.chainId}-${tcr.address}-${itemID}`, db)
  ])

  const message = `The arbitrator gave an appealable ruling to a dispute in ${
    networks[network.chainId].name
  }.
    \nThink it is incorrect? Contribute appeal fees for a chance to earn the opponent's stake!
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
