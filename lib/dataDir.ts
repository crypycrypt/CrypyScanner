import path from 'path'

// Vercel's serverless functions have a read-only filesystem except /tmp.
// Writing dedup/state JSON to process.cwd()/.data (the local-dev path)
// throws EROFS there and — since callers wrap it in try/catch — fails
// silently on every single write. Redirect to /tmp on Vercel so writes at
// least succeed while a container instance stays warm. /tmp is still wiped
// on cold start, so cross-restart persistence isn't guaranteed there the
// way it is on a normal always-on server or in local dev.
export const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', '.data')
  : path.join(process.cwd(), '.data')
