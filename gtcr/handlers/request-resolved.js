const { ITEM_STATUS } = require('../../utils/enums')
const { capitalizeFirstLetter } = require('../../utils/string')
const { networks } = require('../../utils/networks')
const { dbAttempt } = require('../../utils/db-attempt')
const { submitTweet } = require('../../utils/submit-tweet')
const { mainListFilter } = require('../../utils/main-list-filter')

module.exports = ({
  tcr,
  tcrMetaEvidence,
  twitterClient,
  bitly,
  db,
  network
}) => async (_itemID, _requestIndex, _roundIndex, _disputed, _resolved) => {
  const isRelevant = await mainListFilter(network.chainId, tcr.address)
  if (!isRelevant) {
    console.log('Irrelevant interaction, ignoring...')
    return
  }

  if (_disputed || !_resolved) return // Only handle request executed.

  const {
    metadata: { itemName, tcrTitle }
  } = tcrMetaEvidence
  const [shortenedLink, itemInfo, tweetID] = await Promise.all([
    bitly.shorten(
      `${process.env.GTCR_UI_URL}/tcr/${network.chainId}/${tcr.address}/${_itemID}`
    ),
    tcr.getItemInfo(_itemID),
    dbAttempt(`${network.chainId}-${tcr.address}-${_itemID}`, db)
  ])

  const { status } = itemInfo
  const message = `${
    status === ITEM_STATUS.REGISTERED
      ? `${capitalizeFirstLetter(itemName)} accepted into the`
      : `${capitalizeFirstLetter(itemName)} removed from the`
  } ${tcrTitle} List in ${networks[network.chainId].name}.
    \n\nListing: ${shortenedLink}`

  console.info(message)

  await submitTweet(
    tweetID,
    message,
    db,
    twitterClient,
    `${network.chainId}-${tcr.address}-${_itemID}`
  )
}
