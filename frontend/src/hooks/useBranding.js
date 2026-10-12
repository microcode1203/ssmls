import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'

const DEFAULT_ICON = '/favicon.svg'
const DEFAULT_APPLE_ICON = '/apple-touch-icon.svg'

// School name + logo set by the admin (School Configuration page).
// Public endpoint, so it also works on the login page.
export function useBranding() {
  const { data } = useQuery({
    queryKey: ['branding'],
    queryFn: () => api.get('/config/branding').then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
    retry: 0,
  })
  return { schoolName: data?.school_name || '', logo: data?.school_logo || '' }
}

function setLink(rel, href, type) {
  let el = document.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    document.head.appendChild(el)
  }
  if (type) el.type = type
  el.href = href
}

// Keeps the browser-tab icon in sync with the school logo.
export function BrandingSync() {
  const { logo } = useBranding()
  useEffect(() => {
    if (logo) {
      const mime = logo.slice(5, logo.indexOf(';')) // data:image/png;base64,... -> image/png
      setLink('icon', logo, mime)
      setLink('alternate icon', logo)
      setLink('apple-touch-icon', logo)
    } else {
      setLink('icon', DEFAULT_ICON, 'image/svg+xml')
      setLink('alternate icon', DEFAULT_ICON)
      setLink('apple-touch-icon', DEFAULT_APPLE_ICON)
    }
  }, [logo])
  return null
}
