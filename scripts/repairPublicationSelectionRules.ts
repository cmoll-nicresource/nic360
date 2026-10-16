import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { repairPublicationSelectionRules } from '../src/lib/repairPublicationSelectionRules'

const resolved = await config
resolved.jobs!.autoRun = []
const payload = await getPayload({ config: resolved })
try {
  console.log(
    JSON.stringify(
      await repairPublicationSelectionRules(payload, process.argv.includes('--apply')),
      null,
      2,
    ),
  )
} finally {
  await payload.destroy()
}
process.exit(0)
