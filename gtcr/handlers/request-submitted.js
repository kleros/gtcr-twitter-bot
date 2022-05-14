const { articleFor, truncateETHValue } = require('../../utils/string')
const { ITEM_STATUS } = require('../../utils/enums')

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

  // eslint-disable-next-line unicorn/consistent-function-scoping
  const networkChainName = chainId => {
    if (chainId === 1) return 'Mainnet'
    if (chainId === 100) return 'Gnosis'
    if (chainId === 42) return 'Kovan'
    return 'unknown chain'
  }

  const message = `(${networkChainName(network.chainId)}) \n\nSomeone ${
    _requestType === ITEM_STATUS.SUBMITTED
      ? 'submitted'
      : 'requested the removal of'
  } ${articleFor(itemName)} ${itemName} ${
    _requestType === ITEM_STATUS.SUBMITTED ? 'to' : 'from'
  } ${tcrTitle}. Verify it for a chance to win ${depositETH} #ETH
      \n\nListing: ${shortenedLink}`

  console.info(message)

  if (twitterClient) {
    const tweet = await twitterClient.post('statuses/update', {
      status: message
    })

    await db.put(`${network.chainId}-${tcr.address}-${_itemID}`, tweet.id_str)
  }
}
