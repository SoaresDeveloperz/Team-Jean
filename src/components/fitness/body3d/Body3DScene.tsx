'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { MuscleRegion } from '@/lib/muscles'
import { IDLE_MUSCLE, REGION_FACING, REGION_ORDER, buildFigure, loadFigureMesh, parseFill, regionSlot, type Figure } from './anatomy'

export type BodyView = 'front' | 'side' | 'back'

export type Body3DSceneProps = {
  fills: Partial<Record<MuscleRegion, string>>
  selected: MuscleRegion | null
  // nonce: pedir de novo a mesma vista volta a girar até ela.
  view: { name: BodyView; nonce: number }
  autoRotate: boolean
  reducedMotion: boolean
  label: string
  onSelect: (region: MuscleRegion | null) => void
  onReady: () => void
  onUnavailable: () => void
}

type SceneApi = {
  setFills: (fills: Body3DSceneProps['fills']) => void
  setSelected: (region: MuscleRegion | null) => void
  setView: (view: BodyView) => void
  setAutoRotate: (enabled: boolean, reducedMotion: boolean) => void
}

const VIEW_ANGLE: Record<BodyView, number> = { front: 0, side: Math.PI / 2, back: Math.PI }
const DISTANCE = { default: 20.5, min: 10, max: 25, focus: 12.5 }
// A câmera mira um pouco abaixo do centro: sobra espaço para os controles.
const LOOK_Y = -0.5
const ELEVATION = { default: 0.04, min: -0.25, max: 0.45 }
const AUTO_SPEED = 0.32 // rad/s
const IDLE_BEFORE_SPIN = 2600 // ms sem mexer até voltar a girar sozinho
const WHITE = new THREE.Color('#ffffff')

// Ângulo equivalente mais próximo do atual (não dá a volta inteira).
function nearestAngle(current: number, target: number) {
  const full = Math.PI * 2
  return target + Math.round((current - target) / full) * full
}

// Aproximação suave e independente do FPS.
const damp = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt))

// Cena em three.js puro (carregada sob demanda): o corpo gira com o dedo,
// tem inércia, aproxima com pinça/roda e foca o músculo tocado.
export default function Body3DScene(props: Body3DSceneProps) {
  const { fills, selected, view, autoRotate, reducedMotion, label, onSelect, onReady, onUnavailable } = props
  const hostRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<SceneApi | null>(null)
  const callbacks = useRef({ onSelect, onReady, onUnavailable })

  useEffect(() => {
    callbacks.current = { onSelect, onReady, onUnavailable }
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    } catch {
      callbacks.current.onUnavailable()
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.setClearColor(0x000000, 0)
    const canvas = renderer.domElement
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    // Arrastar na vertical continua rolando a página; na horizontal, gira.
    canvas.style.touchAction = 'pan-y'
    canvas.style.cursor = 'grab'
    canvas.setAttribute('aria-hidden', 'true')
    host.appendChild(canvas)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100)
    scene.add(new THREE.HemisphereLight(0xe9edf2, 0x0b0b0d, 1.5))
    const lights: [number, number, THREE.Vector3Tuple][] = [
      [0xffffff, 3.0, [4, 8, 7]], // principal
      [0x34d399, 2.4, [-6, 5, -6]], // contorno esmeralda
      [0xfbbf24, 0.9, [6, 2, -5]], // contorno dourado
      [0x9fb4ff, 0.55, [-5, 1, 6]], // preenchimento
    ]
    for (const [color, intensity, position] of lights) {
      const light = new THREE.DirectionalLight(color, intensity)
      light.position.set(...position)
      scene.add(light)
    }

    // A malha chega do Web Worker; até lá o contêiner mostra o mapa 2D.
    let figure: Figure | null = null
    let disposed = false

    const state = {
      angle: reducedMotion ? 0 : -0.9,
      targetAngle: 0,
      velocity: 0,
      elevation: ELEVATION.default,
      targetElevation: ELEVATION.default,
      distance: DISTANCE.default,
      targetDistance: DISTANCE.default,
      lookY: LOOK_Y,
      targetLookY: LOOK_Y,
      autoRotate: false,
      reducedMotion,
      selected: null as MuscleRegion | null,
      hovered: null as MuscleRegion | null,
      lastInteraction: performance.now(),
      entrance: reducedMotion ? 1 : 0,
      time: 0,
    }

    type RegionAnim = { slot: number; targetColor: THREE.Color; targetEmissive: THREE.Color; pulse: number }
    const anims = new Map<MuscleRegion, RegionAnim>()
    for (const region of REGION_ORDER) {
      anims.set(region, { slot: regionSlot(region), targetColor: IDLE_MUSCLE.clone(), targetEmissive: new THREE.Color(0, 0, 0), pulse: 0 })
    }
    const pulseGlow = new THREE.Color()
    let currentFills: Body3DSceneProps['fills'] = {}

    const refreshTargets = () => {
      for (const [region, anim] of anims) {
        const value = currentFills[region]
        const isSelected = state.selected === region
        const isHovered = state.hovered === region
        if (value) {
          const { color, intensity } = parseFill(value)
          anim.targetColor.copy(IDLE_MUSCLE).lerp(color, 0.45 + 0.55 * intensity)
          anim.targetEmissive.copy(color).multiplyScalar(0.16 + 0.5 * intensity + (isSelected ? 0.45 : isHovered ? 0.18 : 0))
        } else {
          anim.targetColor.copy(IDLE_MUSCLE)
          if (isSelected) anim.targetColor.lerp(WHITE, 0.18)
          anim.targetEmissive.setScalar(isSelected ? 0.08 : isHovered ? 0.04 : 0)
        }
      }
    }

    // ------------------------------------------------------- render loop
    let visible = true
    let running = false
    let frame = 0
    let last = performance.now()
    let readySent = false
    let dragging = false

    const resize = () => {
      const rect = host.getBoundingClientRect()
      const width = Math.max(1, Math.round(rect.width))
      const height = Math.max(1, Math.round(rect.height))
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    // Avança um quadro; devolve true enquanto algo ainda se mexe.
    const update = (dt: number, now: number) => {
      if (!figure) return false
      let busy = false
      state.time += dt

      if (state.entrance < 1) {
        state.entrance = Math.min(1, state.entrance + dt / 0.9)
        busy = true
      }
      const enter = 1 - Math.pow(1 - state.entrance, 3)
      figure.root.scale.setScalar(0.92 + 0.08 * enter)
      figure.pedestal.scale.setScalar(0.6 + 0.4 * enter)

      const spinning = state.autoRotate && !state.reducedMotion && !state.selected
      const idle = now - state.lastInteraction > IDLE_BEFORE_SPIN
      if (!dragging) {
        if (Math.abs(state.velocity) > 0.02) {
          state.angle += state.velocity * dt
          state.velocity *= Math.exp(-dt * 3.5)
          state.targetAngle = state.angle
          busy = true
        } else if (spinning && idle) {
          state.angle += AUTO_SPEED * dt
          state.targetAngle = state.angle
        } else {
          state.angle = damp(state.angle, state.targetAngle, state.reducedMotion ? 40 : 6, dt)
          if (Math.abs(state.angle - state.targetAngle) > 0.0005) busy = true
          else state.angle = state.targetAngle
        }
      }
      if (spinning) busy = true
      figure.root.rotation.y = state.angle

      const rate = state.reducedMotion ? 40 : 5
      state.elevation = damp(state.elevation, state.targetElevation, rate, dt)
      state.distance = damp(state.distance, state.targetDistance, rate, dt)
      state.lookY = damp(state.lookY, state.targetLookY, rate, dt)
      if (
        Math.abs(state.elevation - state.targetElevation) > 0.0008 ||
        Math.abs(state.distance - state.targetDistance) > 0.005 ||
        Math.abs(state.lookY - state.targetLookY) > 0.002
      ) {
        busy = true
      }
      camera.position.set(0, state.lookY + Math.sin(state.elevation) * state.distance, Math.cos(state.elevation) * state.distance)
      camera.lookAt(0, state.lookY, 0)

      // Flutuação leve e o anel do pedestal girando (só com movimento liberado).
      if (!state.reducedMotion) {
        figure.body.position.y = Math.sin(state.time * 1.2) * 0.025
        figure.dashes.rotation.z = state.time * 0.18
      }

      const colorRate = 1 - Math.exp(-(state.reducedMotion ? 40 : 7) * dt)
      for (const anim of anims.values()) {
        const color = figure.uniforms.colors[anim.slot]
        const emissive = figure.uniforms.emissive[anim.slot]
        if (!color || !emissive) continue
        color.lerp(anim.targetColor, colorRate)
        // O "acender" de um músculo novo é um clarão que se apaga.
        if (anim.pulse > 0) {
          anim.pulse = Math.max(0, anim.pulse - dt / 0.7)
          busy = true
        }
        pulseGlow.copy(anim.targetEmissive).multiplyScalar(1 + Math.sin((1 - anim.pulse) * Math.PI) * 1.6 * (anim.pulse > 0 ? 1 : 0))
        emissive.lerp(pulseGlow, colorRate)
        const distance =
          Math.abs(color.r - anim.targetColor.r) +
          Math.abs(color.g - anim.targetColor.g) +
          Math.abs(emissive.r - pulseGlow.r) +
          Math.abs(emissive.g - pulseGlow.g)
        if (distance > 0.002) busy = true
      }
      return busy
    }

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const busy = update(dt, now)
      renderer.render(scene, camera)
      if (!readySent && figure) {
        readySent = true
        callbacks.current.onReady()
      }
      if ((busy || dragging) && visible) frame = requestAnimationFrame(tick)
      else running = false
    }

    const kick = () => {
      if (running || !visible) return
      running = true
      last = performance.now()
      frame = requestAnimationFrame(tick)
    }

    // --------------------------------------------------------- interação
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const pointers = new Map<number, { x: number; y: number }>()
    let downAt = { x: 0, y: 0, time: 0 }
    let lastMove = 0
    let pinchStart = 0
    let distanceAtPinch = state.targetDistance

    const pick = (clientX: number, clientY: number) => {
      if (!figure) return null
      const rect = canvas.getBoundingClientRect()
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.intersectObject(figure.body, false)[0]
      return hit ? figure.regionAt(hit) : null
    }

    const touch = () => {
      state.lastInteraction = performance.now()
    }

    const onPointerDown = (event: PointerEvent) => {
      canvas.setPointerCapture(event.pointerId)
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      touch()
      state.velocity = 0
      if (pointers.size === 1) {
        downAt = { x: event.clientX, y: event.clientY, time: event.timeStamp }
        lastMove = event.timeStamp
        dragging = false
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinchStart = Math.hypot(a.x - b.x, a.y - b.y)
        distanceAtPinch = state.targetDistance
      }
      kick()
    }

    const onPointerMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId)
      if (!previous) {
        // Mouse passando por cima: destaca o músculo sob o cursor.
        if (event.pointerType !== 'mouse') return
        const region = pick(event.clientX, event.clientY)
        if (region !== state.hovered) {
          state.hovered = region
          canvas.style.cursor = region ? 'pointer' : 'grab'
          refreshTargets()
          kick()
        }
        return
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      touch()
      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()]
        const distance = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinchStart > 0 && distance > 0) {
          state.targetDistance = THREE.MathUtils.clamp(distanceAtPinch * (pinchStart / distance), DISTANCE.min, DISTANCE.max)
        }
        kick()
        return
      }
      if (!dragging && Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 5) {
        dragging = true
        canvas.style.cursor = 'grabbing'
      }
      if (!dragging) return
      const delta = (event.clientX - previous.x) * 0.011
      const elapsed = Math.max(8, event.timeStamp - lastMove) / 1000
      lastMove = event.timeStamp
      state.angle += delta
      state.targetAngle = state.angle
      state.velocity = state.velocity * 0.5 + (delta / elapsed) * 0.5
      if (event.pointerType === 'mouse') {
        state.targetElevation = THREE.MathUtils.clamp(state.targetElevation + (event.clientY - previous.y) * 0.004, ELEVATION.min, ELEVATION.max)
      }
      kick()
    }

    const onPointerUp = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return
      pointers.delete(event.pointerId)
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      touch()
      if (pointers.size > 0) return
      pinchStart = 0
      if (!dragging && event.type === 'pointerup' && event.timeStamp - downAt.time < 450) {
        callbacks.current.onSelect(pick(event.clientX, event.clientY))
      }
      // Soltou parado: sem inércia. Arremesso: limitado para não "voar".
      if (!dragging || event.timeStamp - lastMove > 90) state.velocity = 0
      state.velocity = THREE.MathUtils.clamp(state.velocity, -9, 9)
      dragging = false
      canvas.style.cursor = 'grab'
      kick()
    }

    const onLeave = () => {
      if (!state.hovered) return
      state.hovered = null
      refreshTargets()
      kick()
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      state.targetDistance = THREE.MathUtils.clamp(state.targetDistance * (1 + event.deltaY * 0.0012), DISTANCE.min, DISTANCE.max)
      touch()
      kick()
    }

    const zoom = (factor: number) => {
      state.targetDistance = THREE.MathUtils.clamp(state.targetDistance * factor, DISTANCE.min, DISTANCE.max)
    }
    const tilt = (amount: number) => {
      state.targetElevation = THREE.MathUtils.clamp(state.targetElevation + amount, ELEVATION.min, ELEVATION.max)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const step = event.shiftKey ? Math.PI / 4 : Math.PI / 10
      const actions: Record<string, () => void> = {
        ArrowLeft: () => (state.targetAngle -= step),
        ArrowRight: () => (state.targetAngle += step),
        ArrowUp: () => tilt(-0.1),
        ArrowDown: () => tilt(0.1),
        '+': () => zoom(0.85),
        '=': () => zoom(0.85),
        '-': () => zoom(1 / 0.85),
      }
      if (event.key === 'Escape' && state.selected) actions.Escape = () => callbacks.current.onSelect(null)
      const action = actions[event.key]
      if (!action) return
      event.preventDefault()
      event.stopPropagation()
      state.velocity = 0
      touch()
      action()
      kick()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    host.addEventListener('keydown', onKeyDown)

    const resizeObserver = new ResizeObserver(() => {
      resize()
      kick()
    })
    resizeObserver.observe(host)
    resize()

    // Fora da tela não desenha (economiza bateria).
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) kick()
    })
    visibilityObserver.observe(host)

    const onContextLost = (event: Event) => {
      event.preventDefault()
      callbacks.current.onUnavailable()
    }
    canvas.addEventListener('webglcontextlost', onContextLost)

    let autoInitialized = false
    apiRef.current = {
      setFills: (next) => {
        for (const [region, anim] of anims) {
          if (next[region] && next[region] !== currentFills[region] && !state.reducedMotion) anim.pulse = 1
        }
        currentFills = next
        refreshTargets()
        kick()
      },
      setSelected: (region) => {
        state.selected = region
        const center = region ? figure?.centers.get(region) : undefined
        if (region && center) {
          state.velocity = 0
          state.targetAngle = nearestAngle(state.angle, -REGION_FACING[region])
          state.targetLookY = THREE.MathUtils.clamp(center.y * 0.85, -2.6, 2.6)
          state.targetDistance = DISTANCE.focus
        } else {
          state.targetLookY = LOOK_Y
          state.targetDistance = DISTANCE.default
        }
        touch()
        refreshTargets()
        kick()
      },
      setView: (name) => {
        state.velocity = 0
        state.targetAngle = nearestAngle(state.angle, -VIEW_ANGLE[name])
        touch()
        kick()
      },
      setAutoRotate: (enabled, reduced) => {
        // Ao ligar pelo botão, já começa a girar; na abertura, espera a entrada.
        if (enabled && !state.autoRotate) {
          state.lastInteraction = autoInitialized ? 0 : performance.now() - IDLE_BEFORE_SPIN + 1100
        }
        autoInitialized = true
        state.autoRotate = enabled
        state.reducedMotion = reduced
        kick()
      },
    }

    void loadFigureMesh().then((mesh) => {
      if (disposed) return
      figure = buildFigure(mesh)
      scene.add(figure.root)
      refreshTargets()
      // Se um músculo já veio selecionado, foca nele agora que há centros.
      if (state.selected) apiRef.current?.setSelected(state.selected)
      kick()
    })

    return () => {
      disposed = true
      apiRef.current = null
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      visibilityObserver.disconnect()
      host.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      figure?.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    }
    // A cena nasce uma vez; as mudanças de props chegam pelos efeitos abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    apiRef.current?.setFills(fills)
  }, [fills])

  useEffect(() => {
    apiRef.current?.setSelected(selected)
  }, [selected])

  useEffect(() => {
    apiRef.current?.setView(view.name)
  }, [view])

  useEffect(() => {
    apiRef.current?.setAutoRotate(autoRotate, reducedMotion)
  }, [autoRotate, reducedMotion])

  return (
    <div
      ref={hostRef}
      tabIndex={0}
      role="img"
      aria-roledescription="modelo 3D"
      aria-label={`${label}. Setas giram o corpo; + e − aproximam.`}
      className="absolute inset-0 rounded-[inherit] outline-offset-[-3px]"
    />
  )
}
