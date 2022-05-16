const { articleFor, truncateETHValue } = require('../../utils/string')
const { ITEM_STATUS } = require('../../utils/enums')
const { networks } = require('../../utils/networks')
const { submitTweet } = require('../../utils/submit-tweet')

module.exports = ({
  tcr,
  tcrMetaEvidence,
  tcrArbitrableData,
  twitterClient,
  bitly,
  db,
  network
}) => async (_itemID, _submitter, _requestType) => {
  const {
    metadata: { itemName, tcrTitle }
  } = tcrMetaEvidence
  const {
    formattedEthValues: { submissionBaseDeposit, removalBaseDeposit }
  } = tcrArbitrableData

  const shortenedLink = await bitly.shorten(
    `${process.env.GTCR_UI_URL}/tcr/${network.chainId}/${tcr.address}/${_itemID}`
  )

  const depositETH = truncateETHValue(
    _requestType === ITEM_STATUS.SUBMITTED
      ? submissionBaseDeposit
      : removalBaseDeposit
  )

  // todo itemName could make message too large
  const message = `Someone ${
    _requestType === ITEM_STATUS.SUBMITTED
      ? 'submitted'
      : 'requested the removal of'
  } ${articleFor(itemName)} ${itemName} ${
    _requestType === ITEM_STATUS.SUBMITTED ? 'to' : 'from'
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
