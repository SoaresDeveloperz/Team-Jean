// Tratamento de fotos no próprio celular, antes de enviar ao Storage.

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('falha ao gerar a imagem'))), 'image/jpeg', quality)
  })
}

// Abre a foto já decodificada. A orientação EXIF é respeitada porque o
// navegador desenha a imagem na posição certa.
export async function loadImage(file: Blob) {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Reduz a foto (lado maior com até maxSide px, JPEG): envio rápido no 4G e
// pouco espaço no Storage.
export async function compressImage(file: Blob, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const image = await loadImage(file)
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas indisponível')
  context.fillStyle = '#000'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)
  return canvasToJpeg(canvas, quality)
}

export type CropRegion = { x: number; y: number; width: number; height: number }

// Recorta uma região da foto (em pixels da imagem original) e gera um JPEG
// do tamanho pedido (ex.: 512×512 para a foto de perfil).
export async function cropImage(image: HTMLImageElement, region: CropRegion, width: number, height: number, quality = 0.86) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas indisponível')
  context.fillStyle = '#000'
  context.fillRect(0, 0, width, height)
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, region.x, region.y, region.width, region.height, 0, 0, width, height)
  return canvasToJpeg(canvas, quality)
}
