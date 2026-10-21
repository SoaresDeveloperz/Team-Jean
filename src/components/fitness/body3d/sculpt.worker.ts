// Gera a malha do corpo fora do thread da tela.
import { sculptFigure } from './shape'

self.onmessage = () => {
  const mesh = sculptFigure()
  self.postMessage(mesh, {
    transfer: [mesh.positions.buffer, mesh.indices.buffer, mesh.regionA.buffer, mesh.regionB.buffer, mesh.weights.buffer, mesh.grooves.buffer],
  })
}
