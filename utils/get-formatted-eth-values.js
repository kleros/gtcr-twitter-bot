const { formatEther } = require('ethers/utils')

const getFormattedEthValues = async (gtcrView, tcrAddress) => {
  let data
  try {
    data = await gtcrView.fetchArbitrable(tcrAddress)
  } catch (err) {
    console.warn(`Error fetching ETH values for this TCR @ ${tcrAddress}`, err)
    throw err
  }

  const formattedEthValues = {
    // Format wei values to ETH.
    submissionBaseDeposit: formatEther(data.submissionBaseDeposit),
    removalBaseDeposit: formatEther(data.removalBaseDeposit),
    submissionChallengeBaseDeposit: formatEther(
      data.submissionChallengeBaseDeposit
    ),
    removalChallengeBaseDeposit: formatEther(data.removalChallengeBaseDeposit)
  }

  return formattedEthValues
}

module.exports = {
  getFormattedEthValues
}
