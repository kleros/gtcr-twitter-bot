const { dbAttempt } = require('../../utils/db-attempt')
const { PARTY } = require('../../utils/enums')
const { mainListFilter } = require('../../utils/main-list-filter')
const { submitTweet } = require('../../utils/submit-tweet')

module.exports = ({ tcr, twitterClient, bitly, db, network }) => async (
  itemID,
  _request,
  _round,
  side
) => {
  const isRelevant = await mainListFilter(network.chainId, tcr.address)
  if (!isRelevant) {
    console.log('Irrelevant interaction, ignoring...')
    return
  }

  const [shortenedLink, tweetID] = await Promise.all([
    bitly.shorten(
      `${process.env.GTCR_UI_URL}/tcr/${network.chainId}/${tcr.address}/${itemID}`
    ),
    dbAttempt(`${network.chainId}-${tcr.address}-${itemID}`, db)
  ])

  const message = `The ${
    side === PARTY.REQUESTER ? 'submitter' : 'challenger'
  } is fully funded. The ${
    side === PARTY.REQUESTER ? 'challenger' : 'submitter'
  } must fully fund before the deadline in order to not lose the case.
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
