import { useEffect, useState } from 'react'

function readAccentHex() {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || null
}

// The theme's current --accent as a hex string, updated when the user
// switches accent or mode. For JS that needs a concrete color (e.g. the
// mind map, which derives text contrast from the fill).
export function useAccentColor() {
  const [hex, setHex] = useState(readAccentHex)
  useEffect(() => {
    const obs = new MutationObserver(() => setHex(readAccentHex()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-accent', 'data-theme'] })
    return () => obs.disconnect()
  }, [])
  return hex
}
