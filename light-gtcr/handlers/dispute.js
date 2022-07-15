const _IArbitrator = require('../../abis/IArbitrator.json')
const ethers = require('ethers')

const { ITEM_STATUS, ARBITRATORS } = require('../../utils/enums')
const {
  truncateETHValue,
  articleFor,
  capitalizeFirstLetter
} = require('../../utils/string')
const appealPossibleHandler = require('./appeal-possible')
const appealDecisionHandler = require('./appeal-decision')
const { dbAttempt } = require('../../utils/db-attempt')
const { submitTweet } = require('../../utils/submit-tweet')
const { networks } = require('../../utils/networks')
const { mainListFilter } = require('../../utils/main-list-filter')

const {
  utils: { getAddress }
} = ethers

module.exports = ({
  tcr,
  tcrMetaEvidence,
  tcrArbitrableData,
  twitterClient,
  bitly,
  db,
  network,
  provider
}) => async (arbitratorAddress, disputeID) => {
  const isRelevant = await mainListFilter(network.chainId, tcr.address)
  if (!isRelevant) {
    console.log('Irrelevant interaction, ignoring...')
    return
  }

  const itemID = await tcr.arbitratorDisputeIDToItemID(
    arbitratorAddress,
    disputeID
  )

  const {
    metadata: { itemName }
  } = tcrMetaEvidence
  const {
    formattedEthValues: {
      submissionBaseDeposit,
      submissionChallengeBaseDeposit,
      removalBaseDeposit,
      removalChallengeBaseDeposit
    }
  } = tcrArbitrableData

  const itemInfo = await tcr.getItemInfo(itemID)
  const { status } = itemInfo
  const ethAmount =
    status === ITEM_STATUS.SUBMITTED
      ? Number(submissionBaseDeposit) + Number(submissionChallengeBaseDeposit)
      : Number(removalBaseDeposit) + Number(removalChallengeBaseDeposit)

  const [shortenedLink, tweetID] = await Promise.all([
    bitly.shorten(
      `${process.env.GTCR_UI_URL}/tcr/${network.chainId}/${tcr.address}/${itemID}`
    ),
    dbAttempt(`${network.chainId}-${tcr.address}-${itemID}`, db)
  ])

  const message = `Challenge! ${capitalizeFirstLetter(
    articleFor(itemName)
  )} ${itemName} ${
    status === ITEM_STATUS.SUBMITTED ? 'submission' : 'removal'
  } headed to court in ${networks[network.chainId].name}!
      \n\nA total of ${truncateETHValue(ethAmount)} #${
    networks[network.chainId].currency
  } is at stake.
      \n\nListing: ${shortenedLink}`

  console.info(message)

  await submitTweet(
    tweetID,
    message,
    db,
    twitterClient,
    `${network.chainId}-${tcr.address}-${itemID}`
  )

  const checksummedArbitratorAddr = getAddress(arbitratorAddress)
  let arbitrators = {}
  try {
    arbitrators = JSON.parse(await db.get(ARBITRATORS))
  } catch (err) {
    if (err.type !== 'NotFoundError') throw new Error(err)
  }

  if (!arbitrators[checksummedArbitratorAddr]) {
    // Add a listener for this arbitrator if there isn't one yet.
    const arbitrator = new ethers.Contract(
      checksummedArbitratorAddr,
      _IArbitrator,
      provider
    )

    arbitrator.on(
      arbitrator.filters.AppealPossible(),
      appealPossibleHandler({
        tcrMetaEvidence,
        twitterClient,
        bitly,
        db,
        network,
        provider,
        arbitrator
      })
    )
    arbitrator.on(
      arbitrator.filters.AppealDecision(),
      appealDecisionHandler({
        twitterClient,
        db,
        provider,
        arbitrator,
        bitly,
        network
      })
    )
    arbitrators[checksummedArbitratorAddr] = true

    await db.put(ARBITRATORS, JSON.stringify(arbitrators))
    console.info(`
      Listeners setup for arbitrator at ${checksummedArbitratorAddr}
    `)
  }
}
