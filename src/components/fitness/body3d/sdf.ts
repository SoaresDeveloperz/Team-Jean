// Escultura por campo de distância (SDF): cada parte do corpo é uma forma
// (elipsoide ou cone arredondado) e a união suave entre elas gera uma
// superfície contínua, sem emendas. A malha sai por "surface nets".

export type Vec3 = [number, number, number]

export type Primitive = {
  // 0 = base (cabeça, mãos, articulações...); 1..n = região muscular.
  region: number
  // Raio da fusão suave com o que já existe (maior = mais orgânico).
  blend: number
  bounds: [number, number, number, number, number, number]
  // Esfera que contém a forma: |p − centro| − raio nunca passa da distância real.
  sphere: [number, number, number, number]
  distance: (x: number, y: number, z: number) => number
}

// Matriz de rotação (linhas) a partir de ângulos de Euler XYZ.
function rotationRows([ax, ay, az]: Vec3) {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(ax), Math.sin(ax), Math.cos(ay), Math.sin(ay), Math.cos(az), Math.sin(az)]
  // R = Rx * Ry * Rz (mesma ordem do Euler 'XYZ' do three.js)
  return [
    [cy * cz, -cy * sz, sy],
    [cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy],
    [sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy],
  ]
}

// Rotação que leva o eixo Y até a direção dada (linhas da matriz).
function alignYRows(direction: Vec3) {
  const length = Math.hypot(...direction)
  const [dx, dy, dz] = direction.map((value) => value / length)
  // eixo = Y × d; ângulo = acos(Y · d)
  const axis: Vec3 = [dz, 0, -dx]
  const sin = Math.hypot(...axis)
  const cos = dy
  if (sin < 1e-6) {
    return cos > 0
      ? [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ]
      : [
          [1, 0, 0],
          [0, -1, 0],
          [0, 0, -1],
        ]
  }
  const [x, y, z] = axis.map((value) => value / sin)
  const t = 1 - cos
  return [
    [t * x * x + cos, t * x * y - sin * z, t * x * z + sin * y],
    [t * x * y + sin * z, t * y * y + cos, t * y * z - sin * x],
    [t * x * z - sin * y, t * y * z + sin * x, t * z * z + cos],
  ]
}

function multiplyRows(a: number[][], b: number[][]) {
  return a.map((row) => [0, 1, 2].map((column) => row[0] * b[0][column] + row[1] * b[1][column] + row[2] * b[2][column]))
}

function boundsAround(points: Vec3[], radius: number): Primitive['bounds'] {
  const xs = points.map((point) => point[0])
  const ys = points.map((point) => point[1])
  const zs = points.map((point) => point[2])
  return [
    Math.min(...xs) - radius,
    Math.min(...ys) - radius,
    Math.min(...zs) - radius,
    Math.max(...xs) + radius,
    Math.max(...ys) + radius,
    Math.max(...zs) + radius,
  ]
}

// Elipsoide (aproximação de distância de Inigo Quilez), com rotação.
function ellipsoidFrom(region: number, center: Vec3, radii: Vec3, rows: number[][], blend: number): Primitive {
  const [cx, cy, cz] = center
  const [rx, ry, rz] = radii
  // Inversa da rotação = transposta: local = Rᵀ · (p − c)
  const [[r00, r01, r02], [r10, r11, r12], [r20, r21, r22]] = rows
  const smallest = Math.min(rx, ry, rz)
  const largest = Math.max(rx, ry, rz)
  return {
    region,
    blend,
    bounds: boundsAround([center], largest),
    sphere: [cx, cy, cz, largest],
    distance: (x, y, z) => {
      const px = x - cx
      const py = y - cy
      const pz = z - cz
      const lx = (r00 * px + r10 * py + r20 * pz) / rx
      const ly = (r01 * px + r11 * py + r21 * pz) / ry
      const lz = (r02 * px + r12 * py + r22 * pz) / rz
      const k0 = Math.sqrt(lx * lx + ly * ly + lz * lz)
      const k1 = Math.sqrt((lx / rx) ** 2 + (ly / ry) ** 2 + (lz / rz) ** 2)
      if (k1 < 1e-9) return -smallest
      return (k0 * (k0 - 1)) / k1
    },
  }
}

export function ellipsoid(region: number, center: Vec3, radii: Vec3, rotation: Vec3 = [0, 0, 0], blend = 0.06) {
  return ellipsoidFrom(region, center, radii, rotationRows(rotation), blend)
}

// Elipsoide esticado entre dois pontos (fusos musculares). twist gira em
// torno do próprio eixo; radii: [largura, profundidade].
export function spindle(region: number, from: Vec3, to: Vec3, [width, depth]: [number, number], blend = 0.05, twist = 0) {
  const direction: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
  const half = Math.hypot(...direction) / 2
  const center: Vec3 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]
  const rows = multiplyRows(alignYRows(direction), rotationRows([0, twist, 0]))
  return ellipsoidFrom(region, center, [width, half, depth], rows, blend)
}

// Cone com pontas arredondadas (membros), raio r1 em a e r2 em b.
export function roundCone(region: number, a: Vec3, b: Vec3, r1: number, r2: number, blend = 0.12): Primitive {
  const [ax, ay, az] = a
  const bax = b[0] - ax
  const bay = b[1] - ay
  const baz = b[2] - az
  const l2 = bax * bax + bay * bay + baz * baz
  const rr = r1 - r2
  const a2 = l2 - rr * rr
  const il2 = 1 / l2
  return {
    region,
    blend,
    bounds: boundsAround([a, b], Math.max(r1, r2)),
    sphere: [ax + bax / 2, ay + bay / 2, az + baz / 2, Math.sqrt(l2) / 2 + Math.max(r1, r2)],
    distance: (x, y, z) => {
      const pax = x - ax
      const pay = y - ay
      const paz = z - az
      const yy = pax * bax + pay * bay + paz * baz
      const zz = yy - l2
      const qx = pax * l2 - bax * yy
      const qy = pay * l2 - bay * yy
      const qz = paz * l2 - baz * yy
      const x2 = qx * qx + qy * qy + qz * qz
      const y2 = yy * yy * l2
      const z2 = zz * zz * l2
      const k = Math.sign(rr) * rr * rr * x2
      if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2
      if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1
      return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1
    },
  }
}

// União suave polinomial.
function smoothMin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

export type SculptMesh = {
  positions: Float32Array
  indices: Uint32Array
  // Região mais próxima, a segunda mais próxima e o peso da primeira
  // (0,5 na divisa): as cores se misturam sem serrilhado.
  regionA: Float32Array
  regionB: Float32Array
  weights: Float32Array
  grooves: Float32Array
}

const FAR = 10

// Avalia o campo numa grade e extrai a superfície com surface nets.
export function sculpt(primitives: Primitive[], cell: number, min: Vec3, max: Vec3): SculptMesh {
  const nx = Math.ceil((max[0] - min[0]) / cell) + 1
  const ny = Math.ceil((max[1] - min[1]) / cell) + 1
  const nz = Math.ceil((max[2] - min[2]) / cell) + 1
  const field = new Float32Array(nx * ny * nz).fill(FAR)
  const at = (i: number, j: number, k: number) => i + nx * (j + ny * k)

  // Com |campo| maior que isto num canto, a superfície não passa pela célula
  // (o campo cresce no máximo ~1 por unidade; folga para a aproximação).
  const skip = cell * 2.5
  const farEnough = skip + Math.max(...primitives.map((primitive) => primitive.blend))

  // 1. Campo: cada forma só mexe na região da grade perto dela; longe da
  // superfície basta um limite inferior barato (a malha ignora esses pontos).
  for (const primitive of primitives) {
    const [sx, sy, sz, radius] = primitive.sphere
    const blend = primitive.blend
    const margin = blend + cell * 2
    const [x0, y0, z0, x1, y1, z1] = primitive.bounds
    const i0 = Math.max(0, Math.floor((x0 - margin - min[0]) / cell))
    const i1 = Math.min(nx - 1, Math.ceil((x1 + margin - min[0]) / cell))
    const j0 = Math.max(0, Math.floor((y0 - margin - min[1]) / cell))
    const j1 = Math.min(ny - 1, Math.ceil((y1 + margin - min[1]) / cell))
    const k0 = Math.max(0, Math.floor((z0 - margin - min[2]) / cell))
    const k1 = Math.min(nz - 1, Math.ceil((z1 + margin - min[2]) / cell))
    for (let k = k0; k <= k1; k++) {
      const z = min[2] + k * cell
      const dz = z - sz
      for (let j = j0; j <= j1; j++) {
        const y = min[1] + j * cell
        const dy = y - sy
        let index = at(i0, j, k)
        for (let i = i0; i <= i1; i++, index++) {
          const x = min[0] + i * cell
          const dx = x - sx
          const current = field[index]
          const lower = Math.sqrt(dx * dx + dy * dy + dz * dz) - radius
          if (lower > current + blend) continue
          if (lower > farEnough) {
            if (lower < current) field[index] = lower
            continue
          }
          field[index] = smoothMin(current, primitive.distance(x, y, z), blend)
        }
      }
    }
  }

  const strideY = nx
  const strideZ = nx * ny

  // 2. Um vértice por célula cortada pela superfície (média dos cruzamentos).
  const cellIndex = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1)
  const at3 = (i: number, j: number, k: number) => i + (nx - 1) * (j + (ny - 1) * k)
  const positions: number[] = []
  const corner = new Float64Array(8)
  const CORNER_OFFSET = [0, 1, strideY, strideY + 1, strideZ, strideZ + 1, strideZ + strideY, strideZ + strideY + 1]
  const CORNER_X = [0, 1, 0, 1, 0, 1, 0, 1]
  const CORNER_Y = [0, 0, 1, 1, 0, 0, 1, 1]
  const CORNER_Z = [0, 0, 0, 0, 1, 1, 1, 1]
  const EDGE_A = [0, 2, 4, 6, 0, 1, 4, 5, 0, 1, 2, 3]
  const EDGE_B = [1, 3, 5, 7, 2, 3, 6, 7, 4, 5, 6, 7]
  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      let base = at(0, j, k)
      let cellAt = at3(0, j, k)
      for (let i = 0; i < nx - 1; i++, base++, cellAt++) {
        const first = field[base]
        if (first > skip || first < -skip) continue
        let inside = 0
        for (let c = 0; c < 8; c++) {
          const value = field[base + CORNER_OFFSET[c]]
          corner[c] = value
          if (value < 0) inside++
        }
        if (inside === 0 || inside === 8) continue
        let sx = 0
        let sy = 0
        let sz = 0
        let count = 0
        for (let e = 0; e < 12; e++) {
          const a = EDGE_A[e]
          const b = EDGE_B[e]
          const fa = corner[a]
          const fb = corner[b]
          if (fa < 0 === fb < 0) continue
          const t = fa / (fa - fb)
          sx += CORNER_X[a] + (CORNER_X[b] - CORNER_X[a]) * t
          sy += CORNER_Y[a] + (CORNER_Y[b] - CORNER_Y[a]) * t
          sz += CORNER_Z[a] + (CORNER_Z[b] - CORNER_Z[a]) * t
          count++
        }
        cellIndex[cellAt] = positions.length / 3
        positions.push(min[0] + (i + sx / count) * cell, min[1] + (j + sy / count) * cell, min[2] + (k + sz / count) * cell)
      }
    }
  }

  // 3. Um quadrilátero por aresta da grade que cruza a superfície.
  const indices: number[] = []
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return
    if (flip) indices.push(a, c, b, a, d, c)
    else indices.push(a, b, c, a, c, d)
  }
  for (let k = 1; k < nz - 1; k++) {
    for (let j = 1; j < ny - 1; j++) {
      let base = at(1, j, k)
      for (let i = 1; i < nx - 1; i++, base++) {
        const value = field[base]
        if (value > skip || value < -skip) continue
        const inside = value < 0
        if (inside !== field[base + 1] < 0) {
          quad(cellIndex[at3(i, j - 1, k - 1)], cellIndex[at3(i, j, k - 1)], cellIndex[at3(i, j, k)], cellIndex[at3(i, j - 1, k)], !inside)
        }
        if (inside !== field[base + strideY] < 0) {
          quad(cellIndex[at3(i - 1, j, k - 1)], cellIndex[at3(i - 1, j, k)], cellIndex[at3(i, j, k)], cellIndex[at3(i, j, k - 1)], !inside)
        }
        if (inside !== field[base + strideZ] < 0) {
          quad(cellIndex[at3(i - 1, j - 1, k)], cellIndex[at3(i, j - 1, k)], cellIndex[at3(i, j, k)], cellIndex[at3(i - 1, j, k)], !inside)
        }
      }
    }
  }

  // 4. Região de cada vértice (forma mais próxima) e sulco nas divisas.
  const vertexCount = positions.length / 3
  const regionA = new Float32Array(vertexCount)
  const regionB = new Float32Array(vertexCount)
  const weights = new Float32Array(vertexCount)
  const grooves = new Float32Array(vertexCount)
  const smooth = (value: number) => {
    const t = Math.min(1, Math.max(0, value))
    return t * t * (3 - 2 * t)
  }
  const regionCount = Math.max(...primitives.map((primitive) => primitive.region)) + 1
  const perRegion = new Float64Array(regionCount)
  const pad = 0.25
  for (let v = 0; v < vertexCount; v++) {
    const x = positions[v * 3]
    const y = positions[v * 3 + 1]
    const z = positions[v * 3 + 2]
    perRegion.fill(Infinity)
    let best = Infinity
    let bestRegion = 0
    for (const primitive of primitives) {
      const bounds = primitive.bounds
      if (x < bounds[0] - pad || x > bounds[3] + pad || y < bounds[1] - pad || y > bounds[4] + pad || z < bounds[2] - pad || z > bounds[5] + pad) continue
      const value = primitive.distance(x, y, z)
      if (value < perRegion[primitive.region]) perRegion[primitive.region] = value
      if (value < best) {
        best = value
        bestRegion = primitive.region
      }
    }
    let other = Infinity
    let otherRegion = bestRegion
    for (let region = 0; region < regionCount; region++) {
      if (region !== bestRegion && perRegion[region] < other) {
        other = perRegion[region]
        otherRegion = region
      }
    }
    regionA[v] = bestRegion
    regionB[v] = otherRegion
    weights[v] = 0.5 + 0.5 * smooth((other - best) / 0.05)
    // 0 bem na divisa entre duas regiões, 1 longe dela.
    grooves[v] = smooth((other - best) / 0.05)
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    regionA,
    regionB,
    weights,
    grooves,
  }
}
