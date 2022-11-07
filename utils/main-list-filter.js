// not sure how to make this .ts, oh well
const fetch = require('node-fetch')

const { toChecksumAddress } = require('ethereum-checksum-address')

// just make the query work like this:
// 1. check if list is in a list.
// 2. if so, check if that list (take the 1st one) is also in a list.
// 3. iterate 5 times.

const getIncluderList = async (subgraphEndpoint, tcr) => {
  // not sure right now, if appears the data for both chain registries
  // starts with "0xd594". then, it predictably contains the address.
  const classicTargetData = `0xd594${tcr.slice(2)}`
  const subgraphQuery = {
    query: `
    {
      items(where: {data: "${classicTargetData}", status_in: [Registered, ClearingRequested]}) {
        registryAddress
      }

      itemProps(where: {item_: {status_in: [Registered, ClearingRequested]}, type: "GTCR address", value: "${toChecksumAddress(
        tcr
      )}"}) {
        item {
          registryAddress
        }
      }
    }
    `
  }
  const response = await fetch(subgraphEndpoint, {
    method: 'POST',
    body: JSON.stringify(subgraphQuery)
  })

  const classicRegistry =
    response.data.items.length > 0
      ? response.data.items[0].registryAddress
      : undefined

  const lightRegistry =
    response.data.itemProps > 0
      ? response.data.itemProps[0].item.registryAddress
      : undefined

  if (classicRegistry) return classicRegistry
  else if (lightRegistry) return lightRegistry

  return null
}

const containedInMain = async (subgraphEndpoint, main, tcr) => {
  let currentTcr = tcr.toLowerCase()
  for (let i = 0; i < 5; i++) {
    const containerRegistry = await getIncluderList(
      subgraphEndpoint,
      currentTcr
    )
    if (containerRegistry === null) return false
    if (containerRegistry.toLowerCase() === main.toLowerCase()) return true

    currentTcr = containerRegistry.toLowerCase()
  }

  // probably a loop occurred, lets escape.
  // sorry i didn't bother to implement dijsktra
  return false
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
