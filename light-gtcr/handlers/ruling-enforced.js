const { dbAttempt } = require('../../utils/db-attempt')
const { ITEM_STATUS } = require('../../utils/enums')
const { networks } = require('../../utils/networks')
const { capitalizeFirstLetter } = require('../../utils/string')
const { submitTweet } = require('../../utils/submit-tweet')

module.exports = ({
  tcr,
  tcrMetaEvidence,
  twitterClient,
  bitly,
  db,
  network
}) => async (_arbitrator, _disputeID, _ruling) => {
  const itemID = await tcr.arbitratorDisputeIDToItemID(_arbitrator, _disputeID)

  const {
    metadata: { itemName, tcrTitle }
  } = tcrMetaEvidence

  const [shortenedLink, tweetID] = await Promise.all([
    bitly.shorten(
      `${process.env.GTCR_UI_URL}/tcr/${network.chainId}/${tcr.address}/${itemID}`
    ),
    dbAttempt(`${network.chainId}-${tcr.address}-${itemID}`, db)
  ])

  const itemInfo = await tcr.getItemInfo(itemID)
  const { status } = itemInfo
  const message = `${capitalizeFirstLetter(itemName)} ${
    status === ITEM_STATUS.REGISTERED ? 'listed on' : 'rejected from'
  } ${tcrTitle}, a list in ${
    networks[network.chainId].name
  }. If you contributed appeal fees to the winner you may have claimable rewards.
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
