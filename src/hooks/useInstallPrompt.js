import { useEffect, useState } from 'react'

// Android/Chrome/Edge disparam `beforeinstallprompt` quando o app pode ser
// instalado; guardamos o evento para abrir o diálogo pelo nosso botão.
// iPhone/iPad (Safari) não têm esse evento: lá a instalação é manual pelo
// menu Compartilhar → "Adicionar à Tela de Início", então mostramos as
// instruções.

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true

const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

let deferredEvent = null
const listeners = new Set()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    deferredEvent = e
    listeners.forEach(fn => fn())
  })
  window.addEventListener('appinstalled', () => {
    deferredEvent = null
    listeners.forEach(fn => fn())
  })
}

export function useInstallPrompt() {
  const [, force] = useState(0)

  useEffect(() => {
    const fn = () => force(n => n + 1)
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [])

  const installed = isStandalone()
  const ios = !installed && isIOS()
  const canInstall = !installed && (!!deferredEvent || ios)

  async function prompt() {
    if (deferredEvent) {
      deferredEvent.prompt()
      await deferredEvent.userChoice.catch(() => null)
      deferredEvent = null
      listeners.forEach(fn => fn())
    } else if (ios) {
      alert(
        'Para instalar o RM Estudos no iPhone/iPad:\n\n' +
        '1. Toque no botão Compartilhar (quadrado com a seta para cima)\n' +
        '2. Escolha "Adicionar à Tela de Início"\n' +
        '3. Toque em "Adicionar"'
      )
    }
  }

  return { canInstall, prompt }
}
