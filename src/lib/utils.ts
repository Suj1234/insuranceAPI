import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Prefix a client-side fetch path with the app's basePath (/demo/api-playground in
// prod, "" locally). Relative fetch('api/...') resolves against the current page dir
// and breaks under a basePath; this makes it absolute + prefixed. Next.js inlines
// __NEXT_ROUTER_BASEPATH into the client bundle.
export function apiPath(path: string): string {
  const base = process.env.__NEXT_ROUTER_BASEPATH ?? ''
  return `${base}/${path.replace(/^\/+/, '')}`
}
