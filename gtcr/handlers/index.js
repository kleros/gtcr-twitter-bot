const fetch = require('node-fetch')
const ethers = require('ethers')

const requestSubmittedHandler = require('./request-submitted')
const evidenceSubmittedHandler = require('./evidence-submitted')
const rulingEnforcedHandler = require('./ruling-enforced')
const disputeHandler = require('./dispute')
const requestResolvedHandler = require('./request-resolved')
const appealPossibleHandler = require('./appeal-possible')
const appealDecisionHandler = require('./appeal-decision')
const paidFeesHandler = require('./paid-fees')
const { GTCRS } = require('../../utils/enums')
const delay = require('delay')

const {
  utils: { formatEther }
} = ethers

/**
 * Add listeners to tweet on important TCR events. Additionally, adds arbitrator listeners in case of a dispute, if there isn't one already.
 *
 * @param {object} args An object with listener parameters.
 * @param {object} args.tcr The TCR contract instance.
 * @param {object} args.gtcrView The view contract to batch TCR queries.
 * @param {object} args.deploymentBlock The TCR contract instance.
 * @param {object} args.network The network object. Used to not mix content from different chains on the database.
 * @param {object} args.bitly Bitly client instance. Used to short links to save chars on tweet.
 * @param {object} args.twitterClient The twitter client instance.
 * @param {object} args.db The level instance. Used to track tweets for replies and arbitrator listeners.
 * @param {object} args.provider The web3 provider.
 */
async function addTCRListeners({
  tcr,
  network,
  bitly,
  gtcrView,
  twitterClient,
  deploymentBlock,
  db,
  provider
}) {
  console.info(`Fetching meta evidence and TCR data of TCR at ${tcr.address}`)
  // Fetch meta evidence.
  const logs = (
    await provider.getLogs({
      ...tcr.filters.MetaEvidence(),
      fromBlock: deploymentBlock
    })
  ).map(log => tcr.interface.parseLog(log))
  const { _evidence: metaEvidencePath } = logs[logs.length - 1].values
  const tcrMetaEvidence = await (
    await fetch(process.env.IPFS_GATEWAY + metaEvidencePath)
  ).json()

  // Fetch TCR data.
  let data
  try {
    data = await gtcrView.fetchArbitrable(tcr.address)
  } catch (err) {
    console.warn(`Error fetching arbitrable data for TCR @ ${tcr.address}`, err)
    console.warn(`This TCR will not be tracked by the bot.`)
    return
  }

  const tcrArbitrableData = {
    ...data,
    formattedEthValues: {
      // Format wei values to ETH.
      submissionBaseDeposit: formatEther(data.submissionBaseDeposit),
      removalBaseDeposit: formatEther(data.removalBaseDeposit),
      submissionChallengeBaseDeposit: formatEther(
        data.submissionChallengeBaseDeposit
      ),
      removalChallengeBaseDeposit: formatEther(data.removalChallengeBaseDeposit)
    }
  }

  let gtcrs = {}
  try {
    gtcrs = JSON.parse(await db.get(GTCRS))
  } catch (err) {
    if (err.type !== 'NotFoundError') throw new Error(err)
  }
  gtcrs[tcr.address.toLowerCase()] = true
  await db.put(GTCRS, JSON.stringify(gtcrs))

  // Submissions and removal requests.
  tcr.on(
    tcr.filters.RequestSubmitted(),
    requestSubmittedHandler({
      tcr,
      tcrMetaEvidence,
      tcrArbitrableData,
      twitterClient,
      bitly,
      db,
      network
    })
  )
  await delay(100)

  // Challenges.
  tcr.on(
    tcr.filters.Dispute(),
    disputeHandler({
      tcr,
      tcrMetaEvidence,
      tcrArbitrableData,
      twitterClient,
      bitly,
      db,
      network,
      provider
    })
  )

  // Request resolved.
  tcr.on(
    tcr.filters.ItemStatusChange(),
    requestResolvedHandler({
      tcr,
      tcrMetaEvidence,
      twitterClient,
      bitly,
      db,
      network
    })
  )
  await delay(100)

  // Ruling enforced.
  tcr.on(
    tcr.filters.Ruling(),
    rulingEnforcedHandler({
      tcr,
      tcrMetaEvidence,
      twitterClient,
      bitly,
      db,
      network
    })
  )
  await delay(100)

  // Evidence submission.
  tcr.on(
    tcr.filters.Evidence(),
    evidenceSubmittedHandler({
      tcr,
      tcrMetaEvidence,
      twitterClient,
      bitly,
      db,
      network,
      provider
    })
  )
  await delay(100)

  // Fully funded side.
  tcr.on(
    tcr.filters.HasPaidAppealFee(),
    paidFeesHandler({ tcr, twitterClient, bitly, db, network })
  )

  console.info(
    `Done fetching and setting up listeners for ${tcr.address} at chain with ID ${network.chainId}`
  )
}

/**
 * Add listeners to tweet on important arbitrator events.
 *
 * @param {object} args An object with listener parameters.
 * @param {object} args.arbitrator The arbitrator contract instance.
 * @param {object} args.twitterClient The twitter client instance.
 * @param {object} args.bitly Bitly client instance. Used to short links to save chars on tweet.
 * @param {object} args.db The level instance. Used to track tweets for replies and arbitrator listeners.
 * @param {object} args.network The network object. Used to not mix content from different chains on the database.
 * @param {object} args.provider The web3 provider.
 */
async function addArbitratorListeners({
  arbitrator,
  twitterClient,
  bitly,
  db,
  network,
  provider
}) {
  arbitrator.on(
    arbitrator.filters.AppealPossible(),
    appealPossibleHandler({
      twitterClient,
      bitly,
      db,
      network,
      provider,
      arbitrator
    })
  )
  await delay(100)

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

  console.info()
  console.info(`Listeners setup for arbitrator at ${arbitrator.address}`)
}

module.exports = {
  addTCRListeners,
  addArbitratorListeners
}
