export type ExerciseIllustration = {
  imageUrl: string
  author: string
  license: string
  licenseUrl: string
  sourceUrl: string
}

const licenses = {
  'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
} as const

function wgerIllustration(
  exerciseId: number,
  imagePath: string,
  author: string,
  license: keyof typeof licenses,
): ExerciseIllustration {
  return {
    imageUrl: `https://wger.de/media/exercise-images/${imagePath}`,
    author,
    license,
    licenseUrl: licenses[license],
    sourceUrl: `https://wger.de/api/v2/exerciseinfo/${exerciseId}/`,
  }
}

const illustrations: Record<string, ExerciseIllustration> = {
  'supino reto com barra': wgerIllustration(73, '192/Bench-press-1.png', 'Everkinetic', 'CC BY-SA 3.0'),
  'puxada frontal': wgerIllustration(158, '158/02e8a7c3-dc67-434e-a4bc-77fdecf84b49.webp', 'Autor não informado pelo wger', 'CC BY-SA 4.0'),
  'remada curvada com barra': wgerIllustration(83, '109/Barbell-rear-delt-row-1.png', 'Everkinetic', 'CC BY-SA 3.0'),
  'remada baixa': wgerIllustration(1117, '1117/2555c4c3-a84d-47db-b83b-cbf721f12e45.png', 'Franpol', 'CC BY-SA 4.0'),
  'barra fixa': wgerIllustration(475, '475/b0554016-16fd-4dbe-be47-a2a17d16ae0e.jpg', 'Imobard', 'CC BY-SA 4.0'),
  'leg press 45º': wgerIllustration(371, '371/d2136f96-3a43-4d4c-9944-1919c4ca1ce1.webp', 'Autor não informado pelo wger', 'CC BY-SA 4.0'),
  'cadeira extensora': wgerIllustration(369, '369/78c915d1-e46d-4d30-8124-65d68664c3ef.png', 'Franpol', 'CC BY-SA 4.0'),
  'cadeira flexora': wgerIllustration(366, '117/seated-leg-curl-large-1.png', 'Everkinetic', 'CC BY-SA 3.0'),
  'stiff com barra': wgerIllustration(507, '507/13d526ab-12fc-461e-828a-051dd7c13fb1.png', 'Autor não informado pelo wger', 'CC BY-SA 4.0'),
  'elevação pélvica': wgerIllustration(1642, '1642/a81ad922-caf5-47f8-99b4-640cb0717436.webp', 'AlucardEvil40', 'CC BY-SA 4.0'),
  'desenvolvimento com halteres': wgerIllustration(1968, '1968/cd92e973-a0d9-4e5f-9011-5369012598d3.png', 'Autor não informado pelo wger', 'CC BY-SA 4.0'),
  'elevação lateral': wgerIllustration(348, '148/lateral-dumbbell-raises-large-2.png', 'Everkinetic', 'CC BY-SA 3.0'),
  'crucifixo invertido': wgerIllustration(828, '828/2e959dab-f39b-4c7c-9063-eb43064ab5eb.png', 'cshep442', 'CC BY-SA 4.0'),
  'rosca martelo': wgerIllustration(272, '86/Bicep-hammer-curl-1.png', 'Everkinetic', 'CC BY-SA 3.0'),
  'tríceps na polia com corda': wgerIllustration(1185, '1185/c5ca283d-8958-4fd8-9d59-a3f52a3ac66b.jpg', 'anto.kreegyr', 'CC BY-SA 4.0'),
  'tríceps testa': wgerIllustration(246, '84/Lying-close-grip-triceps-press-to-chin-1.png', 'Everkinetic', 'CC BY-SA 3.0'),
  'abdominal supra': wgerIllustration(167, '91/Crunches-1.png', 'Autor não informado pelo wger', 'CC BY-SA 3.0'),
  prancha: wgerIllustration(458, '458/b7bd9c28-9f1d-4647-bd17-ab6a3adf5770.png', 'utkb', 'CC BY-SA 4.0'),
  'panturrilha em pé': wgerIllustration(622, '622/9a429bd0-afd3-4ad0-8043-e9beec901c81.jpeg', 'clafal', 'CC BY-SA 4.0'),
}

function normalizeExerciseName(name: string) {
  return name.trim().toLocaleLowerCase('pt-BR').normalize('NFC')
}

export function getExerciseIllustration(name: string) {
  return illustrations[normalizeExerciseName(name)]
}