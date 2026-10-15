/** Only follow the signed topic's own SNS confirmation endpoint and token. */
export function snsSubscriptionUrl(body: Record<string, unknown>): URL {
  if (
    typeof body.TopicArn !== 'string' ||
    typeof body.Token !== 'string' ||
    typeof body.SubscribeURL !== 'string'
  )
    throw new Error('Incomplete SNS confirmation')
  const arn =
    /^arn:(aws|aws-us-gov|aws-cn):sns:([a-z0-9-]+):\d{12}:[A-Za-z0-9_-]+(?:\.fifo)?$/.exec(
      body.TopicArn,
    )
  if (!arn) throw new Error('Invalid SNS topic')
  const url = new URL(body.SubscribeURL)
  const domain = arn[1] === 'aws-cn' ? 'amazonaws.com.cn' : 'amazonaws.com'
  if (
    url.protocol !== 'https:' ||
    url.hostname !== `sns.${arn[2]}.${domain}` ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.hash ||
    url.searchParams.get('Action') !== 'ConfirmSubscription' ||
    url.searchParams.get('TopicArn') !== body.TopicArn ||
    url.searchParams.get('Token') !== body.Token
  ) {
    throw new Error('Invalid SNS confirmation URL')
  }
  return url
}
