import fs from 'node:fs'
import path from 'node:path'

function xmur3(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = mulberry32(42)

function choice(arr) {
  return arr[Math.floor(rng() * arr.length)]
}

function sample(arr, k) {
  const copy = arr.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, k)
}

function sentence(...parts) {
  const s = parts
    .filter((p) => typeof p === 'string' && p.trim())
    .map((p) => p.trim())
    .join(' ')
  return s.replace(/\s+([,.;:!?])/g, '$1').trim()
}

function makeExercise(ex_id, mode, pack, title, difficulty, est, text, tags, extra) {
  const ex = {
    id: ex_id,
    mode,
    pack,
    title,
    difficulty,
    estimated_seconds: est,
    text,
    tags,
  }
  return extra ? { ...ex, ...extra } : ex
}

function makeTemplate(ex_id, mode, pack, title, difficulty, est, template, slots, tags, render_rules, extra) {
  const ex = {
    id: ex_id,
    mode,
    pack,
    title,
    difficulty,
    estimated_seconds: est,
    type: 'template',
    template,
    slots,
    tags,
  }
  const withRules = render_rules ? { ...ex, render_rules } : ex
  return extra ? { ...withRules, ...extra } : withRules
}

const names = [
  'Alex',
  'Jordan',
  'Sam',
  'Renee',
  'Morgan',
  'Taylor',
  'Casey',
  'Priya',
  'Lee',
  'Avery',
  'Cameron',
  'Drew',
  'Harper',
  'Noah',
  'Quinn',
  'Rowan',
  'Sasha',
  'Tara',
]
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const times = ['9:00 AM', '10:00 AM', '11:30 AM', '1:00 PM', '2:30 PM', '3:00 PM', '4:00 PM', '4:30 PM']
const alt_windows = ['in the morning', 'after 2 PM', 'between 1 and 4 PM', 'before noon', 'after 3 PM']
const meeting_types = ['check-in', 'review', 'sync', 'call', 'working session', 'retro', 'planning session']
const closing = ['Best,', 'Thanks,', 'Regards,', 'All the best,', 'Thank you,']
const topics = ['timeline', 'scope', 'budget', 'next steps', 'open questions', 'risk items', 'dependencies', 'handoff details', 'metrics', 'requirements']
const projects = [
  'the proposal',
  'the draft',
  'the rollout',
  'the Q1 plan',
  'the onboarding doc',
  'the report',
  'the dashboard',
  'the release notes',
  'the research summary',
  'the schedule',
]
const support_actions = [
  'sign out, close the app, and sign back in',
  'refresh the page and try again',
  'clear your cache and reload the site',
  'restart the device and retry the login',
  'update to the latest version and reopen the app',
]
const devices = ['mobile', 'desktop', 'tablet', 'both mobile and desktop']
const error_terms = ['error message', 'screenshot', 'timestamp', 'steps to reproduce', 'account email']
const places = ['the store', 'the office', 'the station', 'the library', 'the gym', 'the clinic', 'the café']
const journal_openers = [
  'Today I want to keep things simple.',
  'This is a short entry to clear my head.',
  'I’m practicing calm attention, one line at a time.',
  'I’m choosing steady effort over noisy effort.',
]
const journal_reflections = [
  'One clear priority is enough for today.',
  'If I slow down, I notice more—and I make fewer mistakes.',
  'Consistency matters more than intensity.',
  'I can be firm and still stay calm.',
  'A quiet plan is better than a rushed plan.',
]
const admin_items = [
  'date of birth',
  'mailing address',
  'phone number',
  'emergency contact',
  'account number',
  'invoice number',
  'order ID',
  'policy number',
]
const numbers = ['2', '3', '5', '7', '10', '12', '15', '18', '25', '30', '45', '60', '90']
const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function writeJson(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8')
}

function writePack({ pack_id, mode, exercises, version = 2, meta }) {
  const pack = { pack_id, mode, version, exercises, ...(meta ?? {}) }
  const filePath = path.join(process.cwd(), 'src', 'content', 'packs', `${pack_id}.json`)
  writeJson(filePath, pack)
  return pack
}

// --- Builders ---
function build_focus_pack(pack_id, count, difficulty_base) {
  const exercises = []
  const stems = [
    'Keep your hands light.',
    'Aim for an even tempo.',
    'Accuracy arrives before speed.',
    'Relax your shoulders and breathe.',
    'Let each keypress land, then move on.',
    'Stay with the next character only.',
    'Correct calmly; keep the line moving.',
    'Smooth is repeatable.',
    'Quiet focus beats forced speed.',
    'Reset, then continue.',
  ]
  const second_lines = [
    'Small improvements compound quickly.',
    'A calm start creates a calm finish.',
    'If you rush, you lose the pattern.',
    'Consistency makes speed feel effortless.',
    'Your best pace is the one you can sustain.',
    'Precision is a feeling you can practice.',
    'When in doubt, slow down slightly.',
    'Hold the rhythm through punctuation.',
    'Less tension, better control.',
    'Finish cleanly.',
  ]

  for (let i = 0; i < count; i++) {
    const d = Math.min(5, difficulty_base + Math.floor(i / 17))
    const title = choice(['Steady Rhythm', 'Light Hands', 'Even Tempo', 'Quiet Focus', 'Clean Starts', 'Soft Reset', 'Gentle Precision', 'Calm Finish'])
    let text = sentence(choice(stems), choice(second_lines))
    if (i % 7 === 0) text = sentence(choice(stems), 'Not fast, not slow—just consistent.')
    if (i % 11 === 0) text = sentence('Slow is smooth; smooth is fast.', choice(second_lines))
    const ex_id = `${pack_id}_${String(i + 1).padStart(3, '0')}`
    exercises.push(
      makeExercise(ex_id, 'focus', pack_id, title, d, choice([30, 35, 40, 45, 50, 55, 60]), text, ['calm', 'focus', 'sentences']),
    )
  }

  return exercises
}

function build_email_pack(pack_id, count, difficulty_base) {
  const exercises = []
  for (let i = 0; i < count; i++) {
    const d = Math.min(5, difficulty_base + Math.floor(i / 17))
    const n = choice(names)
    const day = choice(days)
    const t = choice(times)
    const alt_day = choice(days.filter((x) => x !== day))
    const alt = choice(alt_windows)
    const topic = choice(topics)
    const proj = choice(projects)
    const close = choice(closing)

    const fmt = i % 5
    let text
    let tags
    let title

    if (fmt === 0) {
      text = `Hi ${n},\n\nCan we move our ${choice(meeting_types)} to ${day} at ${t}? If that doesn’t work, I’m free ${alt_day} ${alt}.\n\n${close}\n—`
      tags = ['email', 'newlines', 'times', 'question']
      title = 'Scheduling'
    } else if (fmt === 1) {
      text = `Hi ${n},\n\nQuick update on ${proj}: the draft is ready for review. I highlighted the sections that need attention and noted a few questions about the ${topic}.\n\n${close}\n—`
      tags = ['email', 'newlines', 'colon']
      title = 'Project Update'
    } else if (fmt === 2) {
      const m = choice(months)
      const num = choice(numbers)
      const prev = Number.isFinite(Number(num)) && Number(num) > 1 ? String(Number(num) - 1) : num
      text = `Hi ${n},\n\nOne small correction: the deadline is ${m} ${num}, not ${m} ${prev}. Everything else looks solid.\n\n${close}\n—`
      tags = ['email', 'newlines', 'numbers', 'comma']
      title = 'Small Correction'
    } else if (fmt === 3) {
      text = `Hi ${n},\n\nNext steps:\n1) Review the draft by ${day}.\n2) Add comments directly in the doc.\n3) I’ll consolidate feedback and share a clean version.\n\n${close}\n—`
      tags = ['email', 'newlines', 'list', 'numbers']
      title = 'Next Steps'
    } else {
      text = `Hi ${n},\n\nI can take this on, but I’ll need until ${alt_day} to do it well. If that timeline works, I’ll confirm the next steps.\n\n${close}\n—`
      tags = ['email', 'newlines', 'boundaries', 'apostrophe']
      title = 'Timeline'
    }

    const ex_id = `${pack_id}_${String(i + 1).padStart(3, '0')}`
    exercises.push(makeExercise(ex_id, 'real_life', pack_id, title, d, choice([55, 60, 70, 80, 90, 100, 110]), text, tags))
  }
  return exercises
}

function build_texts_pack(pack_id, count, difficulty_base) {
  const exercises = []
  for (let i = 0; i < count; i++) {
    const d = Math.min(5, difficulty_base + Math.floor(i / 17))
    const fmt = i % 6

    let text
    let tags
    let title

    if (fmt === 0) {
      text = `On my way now. See you in ${choice(numbers)}.`
      tags = ['texts', 'short', 'numbers']
      title = 'On My Way'
    } else if (fmt === 1) {
      text = `Quick question: are we still on for ${choice(['tonight', 'tomorrow', 'Saturday', 'next week'])}?`
      tags = ['texts', 'question', 'colon']
      title = 'Quick Check'
    } else if (fmt === 2) {
      text = 'Running a few minutes late, but I’m close.'
      tags = ['texts', 'comma', 'apostrophe']
      title = 'Small Update'
    } else if (fmt === 3) {
      text = `Can we do ${choice(['6:30', '7:15', '5:45'])} instead of ${choice(['6:00', '7:00', '5:30'])}? Traffic is heavier than I expected.`
      tags = ['texts', 'times', 'question']
      title = 'Plan Shift'
    } else if (fmt === 4) {
      const items = sample(['eggs', 'rice', 'tea', 'fruit', 'coffee', 'bread', 'pasta', 'soap', 'yogurt', 'oats'], 3)
      text = `If you’re stopping by ${choice(places)}, could you grab ${items[0]}, ${items[1]}, and ${items[2]}?`
      tags = ['texts', 'list', 'apostrophe']
      title = 'Quick Errand'
    } else {
      text = 'Heads up—my phone might be spotty for a bit, but I’ll reply when I can.'
      tags = ['texts', 'dash', 'apostrophe']
      title = 'Heads Up'
    }

    const ex_id = `${pack_id}_${String(i + 1).padStart(3, '0')}`
    exercises.push(makeExercise(ex_id, 'real_life', pack_id, title, d, choice([15, 20, 25, 30, 35, 40, 45]), text, tags))
  }
  return exercises
}

function build_support_pack(pack_id, count, difficulty_base) {
  const exercises = []
  for (let i = 0; i < count; i++) {
    const d = Math.min(5, difficulty_base + Math.floor(i / 17))
    const fmt = i % 6

    let text
    let tags
    let title

    if (fmt === 0) {
      text = 'Thanks for reaching out. I understand the issue, and I’m happy to help.'
      tags = ['support', 'calm', 'apostrophe']
      title = 'Warm Welcome'
    } else if (fmt === 1) {
      text = `To confirm, are you seeing this on ${choice(devices)}?`
      tags = ['support', 'question', 'comma']
      title = 'Clarify Device'
    } else if (fmt === 2) {
      text = `Please try to ${choice(support_actions)}. This often resolves the problem.`
      tags = ['support', 'instruction']
      title = 'Next Step'
    } else if (fmt === 3) {
      text = `Could you share the exact ${choice(error_terms)} and the time it happened? A screenshot helps, if available.`
      tags = ['support', 'question', 'comma']
      title = 'Request Details'
    } else if (fmt === 4) {
      text = 'I’m escalating this to our engineering team. We’ll follow up within one business day.'
      tags = ['support', 'expectations', 'apostrophe']
      title = 'Set Expectations'
    } else {
      text = 'For security reasons, we can’t make account changes without verification. Please use the link we sent to confirm ownership.'
      tags = ['support', 'policy', 'apostrophe']
      title = 'Policy Tone'
    }

    const ex_id = `${pack_id}_${String(i + 1).padStart(3, '0')}`
    exercises.push(makeExercise(ex_id, 'real_life', pack_id, title, d, choice([45, 55, 65, 75, 85, 95, 110, 125]), text, tags))
  }
  return exercises
}

function build_meetings_pack(pack_id, count, difficulty_base) {
  const exercises = []
  const bullets = ['Decision', 'Action', 'Owner', 'Due', 'Risk', 'Question', 'Follow-up']

  for (let i = 0; i < count; i++) {
    const d = Math.min(5, difficulty_base + Math.floor(i / 17))
    const fmt = i % 5

    let text
    let tags
    let title

    if (fmt === 0) {
      text = `Notes: confirm ${choice(topics)}; update ${choice(projects)}; flag blockers early; share status by ${choice(times)}.`
      tags = ['meetings', 'semicolon', 'times']
      title = 'Quick Notes'
    } else if (fmt === 1) {
      const items = sample(topics, 3)
      text = `Agenda:\n1) ${items[0]}\n2) ${items[1]}\n3) ${items[2]}\n\nGoal: leave with clear next steps.`
      tags = ['meetings', 'newlines', 'list', 'numbers']
      title = 'Agenda'
    } else if (fmt === 2) {
      const owner = choice(names)
      const due = `${choice(days)} ${choice(times)}`
      text = `${choice(bullets)}: Draft update on ${choice(projects)}.\nOwner: ${owner}\nDue: ${due}`
      tags = ['meetings', 'newlines', 'colon']
      title = 'Action Item'
    } else if (fmt === 3) {
      text = 'Summary: we agreed on the approach, but the timeline depends on one open question. We’ll confirm after the next review.'
      tags = ['meetings', 'sentences', 'apostrophe']
      title = 'Summary'
    } else {
      text = 'Please keep comments specific: cite the section, explain the concern, and suggest a workable alternative.'
      tags = ['meetings', 'colon']
      title = 'Commenting'
    }

    const ex_id = `${pack_id}_${String(i + 1).padStart(3, '0')}`
    exercises.push(makeExercise(ex_id, 'real_life', pack_id, title, d, choice([50, 60, 70, 80, 90, 110]), text, tags))
  }

  return exercises
}

function build_admin_pack(pack_id, count, difficulty_base) {
  const exercises = []
  for (let i = 0; i < count; i++) {
    const d = Math.min(5, difficulty_base + Math.floor(i / 17))
    const fmt = i % 6

    let text
    let tags
    let title

    if (fmt === 0) {
      text = `Form check: enter your ${choice(admin_items)}, then select the correct date from the calendar.`
      tags = ['admin', 'colon']
      title = 'Form Check'
    } else if (fmt === 1) {
      text = `Reminder: confirm the address, verify the phone number, and submit the request before ${choice(times)}.`
      tags = ['admin', 'comma', 'times']
      title = 'Reminder'
    } else if (fmt === 2) {
      const m = choice(months)
      const num = choice(numbers)
      text = `Appointment: ${m} ${num} at ${choice(times)}. Bring a photo ID and arrive 10 minutes early.`
      tags = ['admin', 'numbers', 'colon']
      title = 'Appointment'
    } else if (fmt === 3) {
      text = 'Shipping instructions: include the unit number, use the correct ZIP code, and double-check the recipient name.'
      tags = ['admin', 'colon', 'comma']
      title = 'Shipping'
    } else if (fmt === 4) {
      text = 'Receipt note: save the confirmation email and keep the reference number in a safe place.'
      tags = ['admin', 'colon']
      title = 'Receipt'
    } else {
      text = 'Checklist: pay the bill, file the document, and set a reminder for next month.'
      tags = ['admin', 'colon', 'list_inline']
      title = 'Checklist'
    }

    const ex_id = `${pack_id}_${String(i + 1).padStart(3, '0')}`
    exercises.push(makeExercise(ex_id, 'real_life', pack_id, title, d, choice([35, 45, 55, 65, 75, 85]), text, tags))
  }

  return exercises
}

function build_journal_pack(pack_id, count, difficulty_base) {
  const exercises = []
  for (let i = 0; i < count; i++) {
    const d = Math.min(5, difficulty_base + Math.floor(i / 17))
    const fmt = i % 6

    let text
    let tags
    let title

    if (fmt === 0) {
      text = sentence(choice(journal_openers), choice(journal_reflections))
      tags = ['journal', 'calm']
      title = 'Short Entry'
    } else if (fmt === 1) {
      text = 'What’s the next smallest step I can take right now?'
      tags = ['journal', 'question', 'apostrophe']
      title = 'Focus Question'
    } else if (fmt === 2) {
      text = 'I can be kind and still say no. I can be firm and still stay calm.'
      tags = ['journal', 'sentences']
      title = 'Boundaries'
    } else if (fmt === 3) {
      text = 'Slow is smooth; smooth is fast. The key is staying relaxed while moving.'
      tags = ['journal', 'semicolon', 'comma']
      title = 'Tempo'
    } else if (fmt === 4) {
      text = 'I’m ending this entry with one clear sentence, and then I’m done for today.'
      tags = ['journal', 'apostrophe']
      title = 'Closing Line'
    } else {
      text = 'I don’t need more input. I need a few minutes of quiet attention.'
      tags = ['journal', 'apostrophe']
      title = 'Less Noise'
    }

    const ex_id = `${pack_id}_${String(i + 1).padStart(3, '0')}`
    exercises.push(makeExercise(ex_id, 'real_life', pack_id, title, d, choice([40, 55, 65, 75, 85, 95, 110]), text, tags))
  }

  return exercises
}

function build_comp_pack(pack_id, count, difficulty_base) {
  const exercises = []
  for (let i = 0; i < count; i++) {
    const d = Math.min(5, difficulty_base + Math.floor(i / 17))
    const fmt = i % 6

    let text
    let tags
    let title

    if (fmt === 0) {
      text = sentence(
        choice([
          'Type clean.',
          'Type calmly and cleanly.',
          'Clean entries first.',
          'Start controlled.',
        ]),
        choice([
          'Keep the pace.',
          'Hold a steady tempo.',
          'No spikes—steady cadence.',
        ]),
        choice([
          'Let accuracy lead the run.',
          'Convert speed with accuracy.',
          'Make it repeatable.',
        ]),
      )
      tags = ['competitive', 'short']
      title = 'Clean Sprint'
    } else if (fmt === 1) {
      text = sentence(
        choice([
          'Fast, but precise:',
          'Speed is fine, but precision wins:',
          'Push pace, but keep it clean:',
        ]),
        choice([
          'commas, periods, and apostrophes still count.',
          'punctuation is part of the score.',
          'spacing and punctuation are still errors if missed.',
        ]),
      )
      tags = ['competitive', 'punctuation', 'colon']
      title = 'Punctuation Snap'
    } else if (fmt === 2) {
      text = `Targets: 95% accuracy, ${choice(['45+', '50+', '55+'])} WPM, and fewer than ${choice(['10', '12', '15'])} backspaces.`
      tags = ['competitive', 'numbers', 'plus']
      title = 'Targets'
    } else if (fmt === 3) {
      text = `Notes: finalize ${choice(projects)} by ${choice(days)}; share updates by ${choice(times)}; flag blockers early.`
      tags = ['competitive', 'semicolon', 'times']
      title = 'Work Notes'
    } else if (fmt === 4) {
      text = sentence(
        choice(['Hold tempo.', 'Hold pace.', 'Stay on tempo.']),
        choice(['Don’t spike.', 'No surges.', 'No panic corrections.']),
        choice([
          'Keep the cadence steady through the finish.',
          'Carry the cadence through the last line.',
          'Finish clean and controlled.',
        ]),
      )
      tags = ['competitive', 'cadence', 'apostrophe']
      title = 'Tempo Hold'
    } else {
      text = sentence(
        choice([
          'Heads up—speed is fine, but clean entries win.',
          'Reminder: speed is fine, but clean entries win.',
          'Speed is good, but clean entries win.',
        ]),
        choice([
          'Tighten spacing, then push.',
          'Keep spaces clean, then push pace.',
          'Lock spacing, then accelerate.',
        ]),
      )
      tags = ['competitive', 'dash']
      title = 'Dash Discipline'
    }

    const ex_id = `${pack_id}_${String(i + 1).padStart(3, '0')}`
    exercises.push(makeExercise(ex_id, 'competitive', pack_id, title, d, choice([20, 30, 45, 60, 75, 90, 120]), text, tags))
  }

  return exercises
}

// --- Generate packs ---
const packsDir = path.join(process.cwd(), 'src', 'content', 'packs')
fs.mkdirSync(packsDir, { recursive: true })

const packIds = [
  'focus_calm_01',
  'focus_calm_02',
  'focus_calm_03',
  'real_life_email_01',
  'real_life_email_02',
  'real_life_texts_01',
  'real_life_texts_02',
  'real_life_support_01',
  'real_life_meetings_notes_01',
  'real_life_admin_forms_01',
  'real_life_journal_01',
  'competitive_mixed_01',
  'competitive_mixed_02',
  'real_life_email_templates',
  'real_life_admin_templates',
  'real_life_support_templates',
  'real_life_meetings_templates',
  'real_life_texts_templates',
  'real_life_journal_templates',
  'competitive_templates',
]

// Remove any extra JSON files in packs dir (prevents old/corrupt leftovers from breaking builds).
for (const file of fs.readdirSync(packsDir)) {
  if (!file.toLowerCase().endsWith('.json')) continue
  const base = file.replace(/\.json$/i, '')
  if (!packIds.includes(base)) fs.unlinkSync(path.join(packsDir, file))
}

const writtenPacks = []
writtenPacks.push(writePack({ pack_id: 'focus_calm_01', mode: 'focus', exercises: build_focus_pack('focus_calm_01', 50, 1) }))
writtenPacks.push(writePack({ pack_id: 'focus_calm_02', mode: 'focus', exercises: build_focus_pack('focus_calm_02', 50, 2) }))
writtenPacks.push(writePack({ pack_id: 'focus_calm_03', mode: 'focus', exercises: build_focus_pack('focus_calm_03', 50, 3) }))

writtenPacks.push(writePack({ pack_id: 'real_life_email_01', mode: 'real_life', exercises: build_email_pack('real_life_email_01', 50, 1) }))
writtenPacks.push(writePack({ pack_id: 'real_life_email_02', mode: 'real_life', exercises: build_email_pack('real_life_email_02', 50, 2) }))

writtenPacks.push(writePack({ pack_id: 'real_life_texts_01', mode: 'real_life', exercises: build_texts_pack('real_life_texts_01', 50, 1) }))
writtenPacks.push(writePack({ pack_id: 'real_life_texts_02', mode: 'real_life', exercises: build_texts_pack('real_life_texts_02', 50, 2) }))

writtenPacks.push(writePack({ pack_id: 'real_life_support_01', mode: 'real_life', exercises: build_support_pack('real_life_support_01', 50, 2) }))
writtenPacks.push(writePack({ pack_id: 'real_life_meetings_notes_01', mode: 'real_life', exercises: build_meetings_pack('real_life_meetings_notes_01', 50, 2) }))
writtenPacks.push(writePack({ pack_id: 'real_life_admin_forms_01', mode: 'real_life', exercises: build_admin_pack('real_life_admin_forms_01', 50, 1) }))
writtenPacks.push(writePack({ pack_id: 'real_life_journal_01', mode: 'real_life', exercises: build_journal_pack('real_life_journal_01', 50, 1) }))

writtenPacks.push(writePack({ pack_id: 'competitive_mixed_01', mode: 'competitive', exercises: build_comp_pack('competitive_mixed_01', 50, 2) }))
writtenPacks.push(writePack({ pack_id: 'competitive_mixed_02', mode: 'competitive', exercises: build_comp_pack('competitive_mixed_02', 50, 3) }))

// Templates (150) — split into multiple packs so `exercise.pack === pack.pack_id`
const templatePacks = {
  real_life_email_templates: { mode: 'real_life', exercises: [] },
  real_life_admin_templates: { mode: 'real_life', exercises: [] },
  real_life_support_templates: { mode: 'real_life', exercises: [] },
  real_life_meetings_templates: { mode: 'real_life', exercises: [] },
  real_life_texts_templates: { mode: 'real_life', exercises: [] },
  real_life_journal_templates: { mode: 'real_life', exercises: [] },
  competitive_templates: { mode: 'competitive', exercises: [] },
}

for (let i = 0; i < 150; i++) {
  const fmt = i % 10
  const d = 2 + (i % 4) // 2-5
  const est = choice([45, 60, 75, 90, 110])
  const ex_id = `tpl_${String(i + 1).padStart(3, '0')}`
  const render_rules = { max_variants: 1000, seeded: true }

  let template
  let slots
  let tags
  let title
  let mode
  let pack

  if (fmt === 0) {
    template =
      'Hi {name},\n\nCan we move our {meeting_type} to {day} at {time}? If that doesn’t work, I’m free {alt_day} {alt_window}.\n\n{closing}\n—'
    slots = { name: names, meeting_type: meeting_types, day: days, time: times, alt_day: days, alt_window: alt_windows, closing }
    tags = ['email', 'newlines', 'times', 'question']
    title = 'Scheduling Template'
    mode = 'real_life'
    pack = 'real_life_email_templates'
  } else if (fmt === 1) {
    template =
      'Hi {name},\n\nQuick update on {project}: I’ve finished a first pass and added comments around the {topic}. I can walk you through it on {day}.\n\n{closing}\n—'
    slots = { name: names, project: projects, topic: topics, day: days, closing }
    tags = ['email', 'newlines', 'colon', 'apostrophe']
    title = 'Update Template'
    mode = 'real_life'
    pack = 'real_life_email_templates'
  } else if (fmt === 2) {
    template = 'Reminder: {task_1}, then {task_2}, then {task_3}. Keep it simple and finish one step at a time.'
    slots = {
      task_1: ['pay the bill', 'send the email', 'book the appointment', 'submit the form', 'confirm the address'],
      task_2: ['save the receipt', 'add a calendar reminder', 'attach the document', 'review the details', 'double-check the time'],
      task_3: ['file the note', 'share an update', 'follow up tomorrow', 'close the tab', 'take a short break'],
    }
    tags = ['admin', 'comma']
    title = 'Reminder Template'
    mode = 'real_life'
    pack = 'real_life_admin_templates'
  } else if (fmt === 3) {
    template = 'To confirm, are you seeing this on {device}? If possible, send the {detail} and the time it happened.'
    slots = { device: devices, detail: error_terms }
    tags = ['support', 'question']
    title = 'Support Confirm Template'
    mode = 'real_life'
    pack = 'real_life_support_templates'
  } else if (fmt === 4) {
    template = 'Agenda:\n1) {topic_a}\n2) {topic_b}\n3) {topic_c}\n\nGoal: {goal}.'
    slots = {
      topic_a: topics,
      topic_b: topics,
      topic_c: topics,
      goal: ['clear next steps', 'a decision we can act on', 'a clean timeline', 'a shared understanding'],
    }
    tags = ['meetings', 'newlines', 'list', 'numbers']
    title = 'Agenda Template'
    mode = 'real_life'
    pack = 'real_life_meetings_templates'
  } else if (fmt === 5) {
    template = 'Notes: {note_1}; {note_2}; {note_3}; share status by {time}.'
    slots = {
      note_1: ['confirm scope', 'review risks', 'align on requirements', 'update the timeline', 'clarify ownership'],
      note_2: ['flag blockers early', 'capture open questions', 'record decisions', 'assign follow-ups', 'summarize outcomes'],
      note_3: ['set the next check-in', 'close the loop', 'share the draft', 'post the recap', 'update the doc'],
      time: times,
    }
    tags = ['meetings', 'semicolon', 'times']
    title = 'Notes Template'
    mode = 'real_life'
    pack = 'real_life_meetings_templates'
  } else if (fmt === 6) {
    template = 'On my way—ETA {minutes} minutes. If anything changes, I’ll text you.'
    slots = { minutes: ['5', '8', '10', '12', '15', '20'] }
    tags = ['texts', 'dash', 'numbers', 'apostrophe']
    title = 'ETA Template'
    mode = 'real_life'
    pack = 'real_life_texts_templates'
  } else if (fmt === 7) {
    template = 'Today: {line_1} {line_2}'
    slots = { line_1: journal_openers, line_2: journal_reflections }
    tags = ['journal', 'calm', 'colon']
    title = 'Journal Template'
    mode = 'real_life'
    pack = 'real_life_journal_templates'
  } else if (fmt === 8) {
    template = 'Targets: {acc}% accuracy, {wpm}+ WPM, and fewer than {backs} backspaces. Run it clean.'
    slots = { acc: ['95', '96', '97', '98'], wpm: ['45', '50', '55', '60'], backs: ['10', '12', '15', '18'] }
    tags = ['competitive', 'numbers', 'plus']
    title = 'Targets Template'
    mode = 'competitive'
    pack = 'competitive_templates'
  } else {
    template = 'Hold tempo. Don’t spike. Keep the cadence steady through the {finish_word}.'
    slots = { finish_word: ['finish', 'last line', 'final sentence', 'closing stretch'] }
    tags = ['competitive', 'cadence', 'apostrophe']
    title = 'Tempo Template'
    mode = 'competitive'
    pack = 'competitive_templates'
  }

  templatePacks[pack].exercises.push(
    makeTemplate(ex_id, mode, pack, title, d, est, template, slots, tags, render_rules),
  )
}

for (const pack_id of [
  'real_life_email_templates',
  'real_life_admin_templates',
  'real_life_support_templates',
  'real_life_meetings_templates',
  'real_life_texts_templates',
  'real_life_journal_templates',
  'competitive_templates',
]) {
  writtenPacks.push(
    writePack({ pack_id, mode: templatePacks[pack_id].mode, exercises: templatePacks[pack_id].exercises }),
  )
}

// --- Extras (not in packs folder) ---
const phase2Dir = path.join(process.cwd(), 'src', 'content', 'phase2')
fs.mkdirSync(phase2Dir, { recursive: true })

const micro_feedback_v2 = {
  version: 2,
  inputs_expected: [
    'mode',
    'wpm',
    'accuracy',
    'errors',
    'backspaces',
    'duration_ms',
    'is_personal_best_wpm',
    'is_personal_best_accuracy',
    'delta_wpm_vs_best',
    'delta_accuracy_vs_best',
    'screen_reader_mode',
    'reduced_motion',
    'hud_level',
  ],
  selection: {
    max_messages: 2,
    apply_order: 'top_to_bottom',
    rotate_within_same_rule: true,
  },
  calm: {
    primary_rules_ordered: [
      { id: 'calm_sr_short', if: 'screen_reader_mode == true AND accuracy >= 0.98', messages: ['High accuracy.', 'Clean run.'] },
      {
        id: 'calm_pb_clean',
        if: 'is_personal_best_wpm == true AND accuracy >= 0.97',
        messages: ['New personal best, and you kept it clean.', 'PB with control. Nice work.'],
      },
      { id: 'calm_accuracy_elite', if: 'accuracy >= 0.99 AND duration_ms >= 20000', messages: ['Excellent control. Very clean.', 'Calm, precise typing—great control.'] },
      { id: 'calm_accuracy_high', if: 'accuracy >= 0.98', messages: ['Strong accuracy. Steady work.', 'Clean entries. Nice rhythm.'] },
      { id: 'calm_speed_controlled', if: 'wpm >= 55 AND accuracy >= 0.96', messages: ['Good pace, and you stayed in control.', 'Speed with steadiness—keep that.'] },
      { id: 'calm_low_backspace', if: 'backspaces <= 5 AND duration_ms >= 20000', messages: ['Minimal corrections. Smooth flow.', 'Light touch—nice continuity.'] },
      { id: 'calm_recovery', if: 'errors > 0 AND accuracy >= 0.95', messages: ['Nice recovery. You kept moving calmly.', 'Good reset after errors—steady finish.'] },
      { id: 'calm_accuracy_low', if: 'accuracy < 0.93', messages: ['Slow slightly and aim for clean entries.', 'Ease off a bit; let accuracy lead.'] },
      { id: 'calm_default', if: 'true', messages: ['Good session. Keep the rhythm steady.', 'Nice work. Light hands, steady pace.'] },
    ],
    secondary_rules_ordered: [
      { id: 'calm_sr_hint', if: 'screen_reader_mode == true AND accuracy < 0.95', messages: ['Try slowing slightly for accuracy.'] },
      {
        id: 'calm_hint_backspace',
        if: 'backspaces >= 15',
        messages: ['Try fewer corrections—finish the word, then fix if needed.', 'Commit to the word, then correct calmly.'],
      },
      { id: 'calm_hint_errors', if: 'errors >= 8', messages: ['Aim for the next character only. Accuracy will bring speed.', 'Focus on clean characters; speed follows.'] },
      { id: 'calm_hint_hud', if: "hud_level == 'minimal' AND wpm < 35 AND duration_ms >= 30000", messages: ['When it feels effortless, nudge the pace up.'] },
      { id: 'calm_hint_none', if: 'true', messages: [''] },
    ],
  },
  competitive: {
    primary_rules_ordered: [
      {
        id: 'comp_sr_short',
        if: 'screen_reader_mode == true AND is_personal_best_wpm == true AND accuracy >= 0.95',
        messages: ['New WPM best.'],
      },
      { id: 'comp_pb_wpm', if: 'is_personal_best_wpm == true AND accuracy >= 0.95', messages: ['New PB WPM. Keep it repeatable.', 'PB set. Run it clean again.'] },
      { id: 'comp_pb_accuracy', if: 'is_personal_best_accuracy == true AND duration_ms >= 20000', messages: ['New PB accuracy. Clean run.', 'Accuracy PB. Excellent control.'] },
      { id: 'comp_elite_accuracy', if: 'accuracy >= 0.99', messages: ['Elite accuracy. Push pace next run.', '99%+ accuracy—now add speed.'] },
      { id: 'comp_fast_and_clean', if: 'wpm >= 60 AND accuracy >= 0.97', messages: ['Fast and clean. That’s the zone.', 'Strong pace with control.'] },
      { id: 'comp_fast_sloppy', if: 'wpm >= 60 AND accuracy < 0.95', messages: ['Pace is there. Tighten accuracy to convert it.', 'Speed is good; accuracy is the limiter.'] },
      {
        id: 'comp_accuracy_gate',
        if: 'accuracy < 0.95',
        messages: ['Accuracy under 95%. Ease off 5% and lock it in.', 'Below accuracy gate—slow slightly, then push.'],
      },
      { id: 'comp_default', if: 'true', messages: ['Solid run. Chase clean speed.', 'Good attempt. Run it back clean.'] },
    ],
    secondary_rules_ordered: [
      { id: 'comp_delta_up', if: 'delta_wpm_vs_best >= 1.0 AND accuracy >= 0.95', messages: ['Up vs best: +{delta_wpm_vs_best} WPM.'] },
      { id: 'comp_delta_down', if: 'delta_wpm_vs_best <= -1.0', messages: ['Down vs best: {delta_wpm_vs_best} WPM. Reset and rerun.'] },
      { id: 'comp_backspace', if: 'backspaces >= 15', messages: ['Too many backspaces. Commit, then correct.', 'Backspace budget blown—type through, then fix.'] },
      { id: 'comp_errors', if: 'errors >= 10', messages: ['Error spike. Rebuild rhythm, then push.', 'Too many misses—slow slightly for one clean run.'] },
      { id: 'comp_none', if: 'true', messages: [''] },
    ],
  },
}

writeJson(path.join(phase2Dir, 'micro_feedback_rules_v2.json'), micro_feedback_v2)

const accessibility_presets = {
  version: 1,
  presets: [
    {
      id: 'default',
      label: 'Default',
      settings: {
        theme: 'calm',
        text_scale: 1.0,
        font_family: 'system',
        letter_spacing_em: 0.0,
        line_height: 1.4,
        reduced_motion: false,
        screen_reader_mode: false,
        minimal_hud: true,
        color_independent_markers: true,
        caret_thickness_px: 2,
      },
    },
    {
      id: 'high_contrast',
      label: 'High Contrast',
      settings: {
        theme: 'high_contrast',
        text_scale: 1.15,
        color_independent_markers: true,
        caret_thickness_px: 3,
      },
    },
    {
      id: 'extra_high_contrast',
      label: 'Extra High Contrast',
      settings: {
        theme: 'extra_high_contrast',
        text_scale: 1.2,
        color_independent_markers: true,
        caret_thickness_px: 4,
      },
    },
    {
      id: 'low_vision',
      label: 'Low Vision',
      settings: {
        theme: 'high_contrast',
        text_scale: 1.5,
        focus_line_mode: true,
        caret_thickness_px: 5,
        line_height: 1.7,
      },
    },
    {
      id: 'dyslexia_friendly',
      label: 'Dyslexia-friendly',
      settings: {
        font_family: 'atkinson_hyperlegible',
        text_scale: 1.15,
        letter_spacing_em: 0.03,
        line_height: 1.7,
        color_independent_markers: true,
      },
    },
    {
      id: 'screen_reader',
      label: 'Screen Reader',
      settings: {
        screen_reader_mode: true,
        minimal_hud: true,
        announce_debounced_errors: true,
        announce_progress: true,
        chunking_mode: 'sentence',
      },
    },
    {
      id: 'reduced_motion',
      label: 'Reduced Motion',
      settings: {
        reduced_motion: true,
        disable_pulsing_timers: true,
        disable_counter_animations: true,
      },
    },
    {
      id: 'minimal_hud',
      label: 'Minimal HUD',
      settings: {
        minimal_hud: true,
        show_live_wpm: false,
        show_live_accuracy: false,
      },
    },
  ],
}

writeJson(path.join(phase2Dir, 'accessibility_presets.json'), accessibility_presets)

const ui_strings_accessible = {
  version: 1,
  labels: {
    mode_focus: 'Focus mode',
    mode_real_life: 'Real-life mode',
    mode_competitive: 'Competitive mode',
    target_text: 'Target text',
    typed_text: 'Typed text',
    start_button: 'Start exercise',
    restart_button: 'Restart exercise',
    settings_button: 'Open settings',
    accessibility_button: 'Open accessibility settings',
    results_heading: 'Run results',
    wpm: 'Words per minute',
    accuracy: 'Accuracy',
    errors: 'Errors',
    backspaces: 'Backspaces',
    duration: 'Duration',
  },
  announcements: {
    exercise_start: 'Exercise started.',
    exercise_complete: 'Exercise complete.',
    mismatch_expected_char: "Mismatch—expected '{char}'.",
    progress_char_of_total: 'Character {pos} of {total}.',
    results_summary: '{wpm} words per minute, {accuracy}% accuracy, {errors} errors.',
  },
  sr_behavior: {
    do_not_announce_every_keystroke: true,
    error_announce_debounce_ms: 700,
    progress_announce_interval_chars: 25,
  },
}

writeJson(path.join(phase2Dir, 'ui_strings_accessible.json'), ui_strings_accessible)

const index = {
  version: 2,
  packs: writtenPacks.map((p) => p.pack_id).sort(),
  recommended_quickstart: {
    focus: ['focus_calm_01', 'focus_calm_02', 'focus_calm_03'],
    real_life: [
      'real_life_email_01',
      'real_life_texts_01',
      'real_life_support_01',
      'real_life_meetings_notes_01',
      'real_life_admin_forms_01',
      'real_life_journal_01',
    ],
    competitive: ['competitive_mixed_01', 'competitive_mixed_02', 'competitive_templates'],
  },
  extras: ['micro_feedback_rules_v2.json', 'accessibility_presets.json', 'ui_strings_accessible.json'],
}

writeJson(path.join(phase2Dir, 'content_index.json'), index)

console.log(`Wrote ${writtenPacks.length} packs to src/content/packs/ and extras to src/content/phase2/.`)
