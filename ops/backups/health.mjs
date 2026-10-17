import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { pathToFileURL } from 'node:url'

export const bucket = 'nic360-backups-226541720866-us-east-1'
const region = 'us-east-1'
export const s3 = new S3Client({ region })
export async function getBytes(key) {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  return Buffer.from(await response.Body.transformToByteArray())
}
export async function completedSnapshots(prefix) {
  const keys = []
  let token
  do {
    const result = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }))
    keys.push(...(result.Contents || []).map(item => item.Key).filter(key => key?.endsWith('/complete.json')))
    token = result.NextContinuationToken
  } while (token)
  return keys.sort().reverse()
}
export function assertFresh(marker, maxHours, now = Date.now()) {
  const age = now - Date.parse(marker.completedAt)
  if (!Number.isFinite(age) || age < -300000 || age > maxHours * 3600000)
    throw new Error('Backup/recovery marker is missing, invalid, future-dated or stale.')
}
export async function latest(prefix, maxHours) {
  const [key] = await completedSnapshots(prefix)
  if (!key) throw new Error('No completed snapshot under ' + prefix)
  const marker = JSON.parse((await getBytes(key)).toString())
  assertFresh(marker, maxHours)
  if (marker.snapshot !== key.slice(0, -'/complete.json'.length)) throw new Error('Snapshot marker path mismatch')
  return { ...marker, key }
}
export async function recordRecovery(summary) {
  const snapshot = 'verification/' + new Date().toISOString().replaceAll(/[-:.]/g, '')
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: snapshot + '/complete.json', Body: JSON.stringify({ ...summary, snapshot, completedAt: new Date().toISOString() }), ContentType: 'application/json', ServerSideEncryption: 'AES256' }))
}
export async function checkHealth() {
  const result = await Promise.all([latest('uploads/', 30), latest('database-daily/', 30), latest('verification/', 8 * 24)])
  return result.map(({ snapshot, completedAt }) => ({ snapshot, completedAt }))
}
export async function metric(healthy) {
  await new CloudWatchClient({ region }).send(new PutMetricDataCommand({ Namespace: 'Nic360/Recovery', MetricData: [{ MetricName: 'BackupHealth', Unit: 'Count', Value: healthy ? 1 : 0 }] }))
}
export async function alert(reason) {
  await new SESClient({ region }).send(new SendEmailCommand({
    Source: 'Nicotine360 Operations <noreply@nicotineresource.org>',
    Destination: { ToAddresses: ['cmoll@nicotineresource.org'] },
    Message: { Subject: { Data: 'Nicotine360 backup/recovery check failed' }, Body: { Text: { Data: 'The independent backup/recovery check needs attention.\n\n' + reason + '\n\n' + (process.env.GITHUB_RUN_ID ? 'https://github.com/cmoll-nicresource/nic360/actions/runs/' + process.env.GITHUB_RUN_ID : 'Run from the local operations tools.') } } },
  }))
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const checks = await checkHealth()
    await metric(true)
    console.log(JSON.stringify({ healthy: true, checks }))
  } catch (error) {
    await Promise.allSettled([metric(false), alert(error.message)])
    console.error(error.message)
    process.exitCode = 1
  }
}
