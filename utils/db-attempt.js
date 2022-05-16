/**
 * If there's no previous message, then the event will act as the first message
 * in the chain.
 *
 * @param {string} key the key for the db
 * @param {any} db the db
 */
const dbAttempt = async (key, db) => {
  try {
    const value = await db.get(key)
    return value
  } catch (err) {
    console.error('Error in dbAttempt', err)
    return null // return null instead of crashing
  }
}

module.exports = {
  dbAttempt
}
