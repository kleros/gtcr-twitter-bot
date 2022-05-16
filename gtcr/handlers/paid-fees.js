const { dbAttempt } = require('../../utils/db-attempt')
const { PARTY } = require('../../utils/enums')
const { submitTweet } = require('../../utils/submit-tweet')

module.exports = ({ tcr, twitterClient, bitly, db, network }) => async (
  itemID,
  _request,
  _round,
  side
) => {
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
