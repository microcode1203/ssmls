import { useBranding } from '../hooks/useBranding'

// Shows the school logo if the admin uploaded one, otherwise the default mark (children).
export default function BrandLogo({ className = '', style = {}, children }) {
  const { logo } = useBranding()
  if (!logo) return <div className={className} style={style}>{children}</div>
  return (
    <div
      className={className}
      style={{ ...style, background: '#fff', padding: 2, boxShadow: 'none', overflow: 'hidden' }}
    >
      <img src={logo} alt="School logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  )
}
