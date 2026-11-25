// List of the "Ferramentas" tab. To add a tool: create its component in
// this folder and add one entry here — the cards, the side menu and the
// tool screen pick it up. Components load on demand (lazy), so a new tool
// doesn't make the rest of the app heavier.
import { lazy } from 'react'
import { Scissors } from 'lucide-react'

export const FERRAMENTAS = [
  {
    id: 'cortador-silencio',
    nome: 'Cortador de silêncio',
    descricao: 'Corta as pausas de áudios e narrações, ajusta a velocidade sem mudar o tom da voz e baixa em WAV.',
    tags: ['Áudio', 'VSL'],
    Icon: Scissors,
    Componente: lazy(() => import('./CortadorSilencio')),
  },
]
