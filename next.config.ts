import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  async rewrites() {
    // Preserve Payload's authenticated file serving, including range requests,
    // without changing existing file IDs, storage keys, or previously shared URLs.
    return [
      {
        source: '/api/publication-files/file/:filename',
        destination: '/api/guide-files/file/:filename',
      },
    ]
  },
  // Native binding (the Rust-based resvg chart renderer for the trade-report
  // PDF) — must load via Node's own require at runtime, not get bundled;
  // sharp gets this treatment by one of Next's own built-in defaults, this
  // one doesn't, so it's listed explicitly. PDF.js likewise needs its installed
  // worker file and Node runtime support when reading CBP quota PDFs.
  serverExternalPackages: ['@resvg/resvg-js', 'pdfjs-dist'],
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
