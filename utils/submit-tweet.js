const submitTweet = async (tweetID, message, db, twitterClient, key) => {
  if (twitterClient) {
    let tweet
    if (tweetID === null)
      try {
        tweet = await twitterClient.post('statuses/update', {
          status: message
        })
      } catch (err) {
        console.log('Caught error submitting parent tweet')
        console.error(err)
      }
    else
      try {
        tweet = await twitterClient.post('statuses/update', {
          status: message,
          in_reply_to_status_id: tweetID,
          auto_populate_reply_metadata: true
        })
      } catch (err) {
        console.log('Caught error submitting response tweet')
        console.error(err)
      }

    if (tweet) {
      await db.put(key, tweet.id_str)
    }
  }
}

module.exports = {
  submitTweet
}
