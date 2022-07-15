// not sure how to make this .ts, oh well
const fetch = require('node-fetch')

const containedInMain = async (subgraphEndpoint, main, tcr) => {
  // not sure right now, if appears the data for both chain registries
  // starts with "0xd594". then, it predictably contains the address.
  const targetData = `0xd594${tcr.slice(2)}`
  const subgraphQuery = {
    query: `
    {
      items(where: {registry: "${main}", data: "${targetData}", status_in: [Registered, ClearingRequested]}) {
        id
      }
    }
    `
  }
  const response = await fetch(subgraphEndpoint, {
    method: 'POST',
    body: JSON.stringify(subgraphQuery)
  })

  const { data } = await response.json()
  const isContained = data.items.length > 0

  return isContained
}
/**
 * Checks if a tcr is contained in the main registry, or if it's the main registry.
 *
 * @param {number} chainId Numerical Id of the network
 * @param {string} tcr Address of the tcr that launches the event
 * @returns {Promise<boolean>} True if it passes the test.
 */
const mainListFilter = async (chainId, tcr) => {
  const main = JSON.parse(process.env.DEFAULT_TCR_ADDRESSES)[String(chainId)]
  tcr = tcr.toLowerCase()
  if (tcr === main) {
    console.log('Interaction in main list')
    return true
  }
  const subgraphEndpoint = JSON.parse(process.env.GTCR_SUBGRAPH_URLS)[
    String(chainId)
  ]

  const result = await containedInMain(subgraphEndpoint, main, tcr)
  console.log(`tcr: ${tcr} went through filter. Result: ${result}`)
  return result
}

module.exports = {
  mainListFilter
}
