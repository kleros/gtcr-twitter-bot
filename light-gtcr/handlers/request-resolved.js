const fetch = require('node-fetch')
const delay = require('delay')

const { ITEM_STATUS } = require('../../utils/enums')
const { capitalizeFirstLetter } = require('../../utils/string')
const { dbAttempt } = require('../../utils/db-attempt')
const { submitTweet } = require('../../utils/submit-tweet')
const { networks } = require('../../utils/networks')
const { mainListFilter } = require('../../utils/main-list-filter')

module.exports = ({
  tcr,
  tcrMetaEvidence,
  twitterClient,
  bitly,
  db,
  network
}) => async _itemID => {
  const isRelevant = await mainListFilter(network.chainId, tcr.address)
  if (!isRelevant) {
    console.log('Irrelevant interaction, ignoring...')
    return
  }

  // Wait a bit to ensure subgraph is synced.
  await delay(20 * 1000)

  const subgraphQuery = {
    query: `
      {
        litem (id: "${_itemID}@${tcr.address.toLowerCase()}") {
          requests {
            disputed
            resolved
          }
        }
      }
    `
  }
  const gtrcSubgraphUrls = JSON.parse(process.env.GTCR_SUBGRAPH_URLS)
  const response = await fetch(gtrcSubgraphUrls[network.chainId], {
    method: 'POST',
    body: JSON.stringify(subgraphQuery)
  })

  const parsedValues = await response.json()
  const { disputed, resolved } = parsedValues.data.litem.requests[0]

  if (disputed || !resolved) return // Only handle request executed here.

  const {
    metadata: { itemName, tcrTitle }
  } = tcrMetaEvidence

  const itemInfo = await tcr.getItemInfo(_itemID)

  const [shortenedLink, tweetID] = await Promise.all([
    bitly.shorten(
      `${process.env.GTCR_UI_URL}/tcr/${network.chainId}/${tcr.address}/${_itemID}`
    ),
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
