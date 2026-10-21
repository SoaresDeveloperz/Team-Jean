// Roda o axe (WCAG 2.1 A/AA) na página aberta e devolve as violações resumidas.
// Um toast entrando ou saindo tem o texto semitransparente (contraste falso):
// se aparecer algo, espera a animação acabar e só conta o que continuar.
const AXE = require.resolve('axe-core/axe.min.js')

const evaluate = (page) =>
  page.evaluate(async () => {
    const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })
    return res.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 4).map((n) => `${n.target.join(' ')} :: ${(n.failureSummary || '').split('\n').slice(1, 2).join(' ')}`),
      count: v.nodes.length,
    }))
  })

async function runAxe(page) {
  await page.addScriptTag({ path: AXE })
  const first = await evaluate(page)
  if (first.length === 0) return first
  await page.waitForTimeout(1200)
  return evaluate(page)
}

module.exports = { runAxe }
