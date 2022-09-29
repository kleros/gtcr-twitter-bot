const { articleFor, truncateETHValue } = require('../../utils/string')
const { ITEM_STATUS } = require('../../utils/enums')
const { networks } = require('../../utils/networks')
const { submitTweet } = require('../../utils/submit-tweet')
const { mainListFilter } = require('../../utils/main-list-filter')
const {
  getFormattedEthValues
} = require('../../utils/get-formatted-eth-values')

module.exports = ({
  tcr,
  gtcrView,
  tcrMetaEvidence,
  twitterClient,
  bitly,
  db,
  network
}) => async (_itemID, _submitter, _requestType) => {
  const isRelevant = await mainListFilter(network.chainId, tcr.address)
  if (!isRelevant) {
    console.log('Irrelevant interaction, ignoring...')
    return
  }

  const {
    metadata: { itemName, tcrTitle }
  } = tcrMetaEvidence

  let submissionBaseDeposit, removalBaseDeposit
  try {
    const ethValues = await getFormattedEthValues(gtcrView, tcr.address)
    submissionBaseDeposit = ethValues.submissionBaseDeposit
    removalBaseDeposit = ethValues.removalBaseDeposit
  } catch (err) {
    console.error(
      'Could not fetch ETH values, cancelling Request Submitted tweet in Classic TCR',
      err
    )
    return
  }

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
