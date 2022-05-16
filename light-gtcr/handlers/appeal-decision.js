const ethers = require('ethers')
const _LightGeneralizedTCR = require('../../abis/LightGeneralizedTCR.json')
const { dbAttempt } = require('../../utils/db-attempt')
const { LGTCRS } = require('../../utils/enums')
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
  let lgtcrs = {}
  try {
    lgtcrs = JSON.parse(await db.get(LGTCRS))
  } catch (err) {
    if (err.type !== 'NotFoundError') throw new Error(err) // Ignore event.
  }
  if (!lgtcrs[_arbitrable.toLowerCase()]) return // Event not related to a light-gtcr.

  const tcr = new ethers.Contract(_arbitrable, _LightGeneralizedTCR, provider)
  let itemID
  try {
    itemID = await tcr.arbitratorDisputeIDToItemID(
      arbitrator.address,
      Number(_disputeID)
    )
  } catch (err) {
    console.error(
      `Error fetching itemID (AppealDecision), tcrAddr ${
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
