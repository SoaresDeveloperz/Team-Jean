// Gera a imagem 1080x1920 (formato stories) do treino concluído no próprio
// navegador, com canvas. Nada é enviado para servidor.

export type ShareImageData = {
  workoutName: string
  date: Date
  minutes: number | null
  volume: number
  sets: number
  rpe: number
  prs: { name: string; weight: number; reps: number }[]
  muscleSvg: string | null
}

const WIDTH = 1080
const HEIGHT = 1920
const LOGO_PATHS = [
  'M60 120 L340 120 L300 150 L225 150 L225 280 L200 310 L150 250 L175 220 L200 250 L200 150 L100 150 Z',
  'M245 170 L290 170 L290 280 L200 350 L160 300 L180 275 L200 295 L265 245 L265 170 Z',
]

const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)

function fontFamilies() {
  const display = getComputedStyle(document.documentElement).getPropertyValue('--font-barlow-condensed').trim()
  return {
    display: display ? `${display}, "Arial Narrow", sans-serif` : '"Arial Narrow", sans-serif',
    sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word
    if (ctx.measureText(attempt).width <= maxWidth || !current) {
      current = attempt
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\s*\S*$/, '')}…`
    return kept
  }
  return lines
}

function loadSvgImage(svg: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = (error) => {
      URL.revokeObjectURL(url)
      reject(error)
    }
    image.src = url
  })
}

export async function renderShareImage(data: ShareImageData): Promise<Blob> {
  await document.fonts?.ready
  const { display, sans } = fontFamilies()
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível')

  // Fundo preto com brilhos esmeralda.
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  const glow = ctx.createRadialGradient(WIDTH * 0.92, 120, 0, WIDTH * 0.92, 120, 980)
  glow.addColorStop(0, 'rgba(52, 211, 153, 0.34)')
  glow.addColorStop(1, 'rgba(52, 211, 153, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  const glowBottom = ctx.createRadialGradient(0, HEIGHT, 0, 0, HEIGHT, 900)
  glowBottom.addColorStop(0, 'rgba(255, 255, 255, 0.07)')
  glowBottom.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = glowBottom
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Marca.
  ctx.save()
  ctx.translate(72, 70)
  ctx.scale(0.42, 0.42)
  ctx.fillStyle = '#ffffff'
  for (const path of LOGO_PATHS) ctx.fill(new Path2D(path))
  ctx.restore()
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 70px ${display}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('TEAM JEAN', 250, 190)
  ctx.fillStyle = '#71717a'
  ctx.font = `700 26px ${sans}`
  ctx.fillText('CONSULTORIA ESPORTIVA', 254, 232)

  // Título.
  ctx.fillStyle = '#34d399'
  ctx.font = `800 34px ${sans}`
  ctx.fillText('TREINO CONCLUÍDO ✓', 80, 400)
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 150px ${display}`
  const titleLines = wrapText(ctx, data.workoutName.toUpperCase(), WIDTH - 160, 3)
  titleLines.forEach((line, index) => ctx.fillText(line, 76, 540 + index * 140))
  const afterTitle = 540 + (titleLines.length - 1) * 140
  ctx.fillStyle = '#a1a1aa'
  ctx.font = `600 34px ${sans}`
  const dateText = data.date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  ctx.fillText(dateText.charAt(0).toUpperCase() + dateText.slice(1), 80, afterTitle + 80)

  // Estatísticas em bento 2x2.
  const stats = [
    { label: 'VOLUME', value: `${formatNumber(data.volume)}`, unit: 'kg' },
    { label: 'SÉRIES', value: String(data.sets), unit: '' },
    { label: 'DURAÇÃO', value: data.minutes ? String(data.minutes) : '—', unit: data.minutes ? 'min' : '' },
    { label: 'ESFORÇO', value: String(data.rpe), unit: '/10' },
  ]
  const gridTop = afterTitle + 150
  const boxWidth = (WIDTH - 160 - 30) / 2
  const boxHeight = 230
  stats.forEach((stat, index) => {
    const x = 80 + (index % 2) * (boxWidth + 30)
    const y = gridTop + Math.floor(index / 2) * (boxHeight + 30)
    roundedRect(ctx, x, y, boxWidth, boxHeight, 44)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#71717a'
    ctx.font = `800 26px ${sans}`
    ctx.fillText(stat.label, x + 40, y + 62)
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 120px ${display}`
    ctx.fillText(stat.value, x + 36, y + 190)
    if (stat.unit) {
      const valueWidth = ctx.measureText(stat.value).width
      ctx.fillStyle = '#71717a'
      ctx.font = `700 46px ${display}`
      ctx.fillText(stat.unit, x + 46 + valueWidth, y + 190)
    }
  })

  // Mapa muscular + recordes.
  const sectionTop = gridTop + boxHeight * 2 + 30 + 60
  const sectionHeight = HEIGHT - sectionTop - 170
  if (data.muscleSvg) {
    try {
      const image = await loadSvgImage(data.muscleSvg)
      const mapHeight = Math.min(sectionHeight, 470)
      const mapWidth = mapHeight * (212 / 224)
      ctx.drawImage(image, 70, sectionTop, mapWidth, mapHeight)
    } catch {
      // Sem o mapa a imagem continua válida.
    }
  }
  const listX = data.muscleSvg ? 560 : 80
  if (data.prs.length > 0) {
    ctx.fillStyle = '#fbbf24'
    ctx.font = `800 28px ${sans}`
    ctx.fillText(`🏆 ${data.prs.length === 1 ? 'NOVO RECORDE' : 'NOVOS RECORDES'}`, listX, sectionTop + 40)
    data.prs.slice(0, 3).forEach((record, index) => {
      const y = sectionTop + 100 + index * 120
      ctx.fillStyle = '#ffffff'
      ctx.font = `700 34px ${sans}`
      const name = wrapText(ctx, record.name, WIDTH - listX - 80, 1)[0]
      ctx.fillText(name, listX, y)
      ctx.fillStyle = '#fbbf24'
      ctx.font = `700 64px ${display}`
      ctx.fillText(`${formatNumber(record.weight)} kg × ${record.reps}`, listX, y + 64)
    })
  } else {
    ctx.fillStyle = '#a1a1aa'
    ctx.font = `600 32px ${sans}`
    wrapText(ctx, 'Mais um treino no histórico. Constância é o que transforma.', WIDTH - listX - 80, 4).forEach((line, index) =>
      ctx.fillText(line, listX, sectionTop + 60 + index * 46),
    )
  }

  // Rodapé.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.10)'
  ctx.fillRect(80, HEIGHT - 150, WIDTH - 160, 2)
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 40px ${display}`
  ctx.fillText('@TEAMJEAN', 80, HEIGHT - 82)
  ctx.fillStyle = '#71717a'
  ctx.font = `600 26px ${sans}`
  const footer = 'Treine com consistência'
  ctx.fillText(footer, WIDTH - 80 - ctx.measureText(footer).width, HEIGHT - 84)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem'))), 'image/png')
  })
}

// Prepara o SVG do mapa muscular para virar imagem (tamanho explícito).
export function serializeSvg(svg: SVGSVGElement | null) {
  if (!svg) return null
  const markup = new XMLSerializer().serializeToString(svg)
  return markup.replace('<svg', '<svg width="848" height="896"')
}
