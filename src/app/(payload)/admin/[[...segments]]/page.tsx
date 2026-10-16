/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. MODIFY AT YOUR OWN RISK. */
import type { Metadata } from 'next'

import config from '@payload-config'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import { importMap } from '../importMap'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { isAdminManagedCollection } from '@/config/workspaceVisibility'
import { staffHasRole } from '@/access/staffRoles'

type Args = {
  params: Promise<{
    segments: string[]
  }>
  searchParams: Promise<{
    [key: string]: string | string[]
  }>
}

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams })

const Page = async ({ params, searchParams }: Args) => {
  const route = await params
  if (route.segments?.[0] === 'collections' && isAdminManagedCollection(route.segments[1])) {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await headers() })
    if (user && !staffHasRole(user, 'admin')) notFound()
  }
  return RootPage({ config, params: Promise.resolve(route), searchParams, importMap })
}

export default Page
