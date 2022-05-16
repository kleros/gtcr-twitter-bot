const ethers = require('ethers')
const _GeneralizedTCR = require('../../abis/GeneralizedTCR.json')
const { dbAttempt } = require('../../utils/db-attempt')
const { GTCRS } = require('../../utils/enums')
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
  let gtcrs = {}
  try {
    gtcrs = JSON.parse(await db.get(GTCRS))
  } catch (err) {
    if (err.type !== 'NotFoundError') throw new Error(err) // Ignore event
  }
  if (!gtcrs[_arbitrable.toLowerCase()]) return // Event not related to a gtcr.

  const tcr = new ethers.Contract(_arbitrable, _GeneralizedTCR, provider)
  const itemID = await tcr.arbitratorDisputeIDToItem(
    arbitrator.address,
    Number(_disputeID)
  )

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
