const ethers = require('ethers')
const _GeneralizedTCR = require('../../abis/GeneralizedTCR.json')
const { dbAttempt } = require('../../utils/db-attempt')
const { GTCRS } = require('../../utils/enums')
const { networks } = require('../../utils/networks')
const { submitTweet } = require('../../utils/submit-tweet')

module.exports = ({
  twitterClient,
  db,
  provider,
  arbitrator,
  bitly,
  network
}) => async (_disputeID, _arbitrable) => {
  // Detect if this is related to a gtcr instance
  let gtcrs = {}
  try {
    gtcrs = JSON.parse(await db.get(GTCRS))
  } catch (err) {
    if (err.type !== 'NotFoundError') throw new Error(err)
    return // Ignore event.
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

  const message = `Ruling appealed! Waiting for evidence and a new ruling for a dispute in ${
    networks[network.chainId].name
  }.
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
