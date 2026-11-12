import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Status } from '../types'

const status = atom({ plugin: 'catch-me-up', key: 'status' } as const, 'idle')
const last = atom({ plugin: 'catch-me-up', key: 'last' } as const, null)

// What the briefing must hold, and how it must sound. It is heard, never read.
const BRIEF = `I have been away from this thread and have forgotten it. I am going to LISTEN to your answer, not read it: a speech synthesizer will read it aloud.

Tell me, in this order:
1. What this thread is for, in one sentence.
2. What you need from me. If there is more than one thing, give only the single most important one, and say how many others are waiting. If nothing is needed from me, say so plainly.
3. Where the work stands: what is finished, and what is in the middle.
4. What happens next, and who does it.

Rules for the ear: plain spoken sentences, under 130 words in all. No markdown, lists, headings, symbols, code, file paths, links or ticket numbers. Name things the way a person would say them aloud. Round the numbers. No greeting at the start and no offer at the end.`

const HASTE =
  'Stop the work for a moment. You have no tools here: answer straight away from what you already know, without thinking it over.\n\n'

const cut = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max)} ...` : text

/** Markdown and symbols a synthesizer would read aloud or trip on. */
export const forEar = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(?:[-*•]|\d+[.)]|#+)\s+/gm, '')
    .replace(/[*_`#>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const sentences = (text: string) =>
  text.split(/(?<=[.!?])\s+/).filter(one => one.length > 0)

// Counts briefings: a Stop or a newer briefing moves it on, and the one
// speaking sees it is no longer the current one between two sentences.
let current = 0

// The most natural voices macOS offers, best first. None ships with the Mac:
// each is a download in System Settings. The first one installed is used, and
// with none of them the system's own voice speaks.
const VOICES = [
  'Jamie (Premium)',
  'Lee (Premium)',
  'Fiona (Enhanced)',
  'Ava (Premium)',
  'Zoe (Premium)',
  'Evan (Premium)',
  'Nathan (Premium)',
  'Ava (Enhanced)',
  'Zoe (Enhanced)',
  'Evan (Enhanced)',
  'Samantha (Enhanced)',
]

/** Speaks with the first voice installed from `from` on; answers which. */
const speak = async ($: EngineInterface, text: string, from: number) => {
  for (let at = from; at < VOICES.length; at += 1) {
    try {
      await $.audio.speak(text, { voice: VOICES[at] })

      return at
    } catch {
      // Not installed: the next one down.
    }
  }

  await $.audio.speak(text)

  return VOICES.length
}

const say = async ($: EngineInterface, text: string) => {
  const mine = (current += 1)
  await update($, status, (): Status => 'speaking')

  try {
    // Looked for afresh each briefing, so a voice downloaded since is found.
    let voice = 0

    for (const sentence of sentences(text)) {
      if (mine !== current) {
        return
      }

      voice = await speak($, sentence, voice)
    }
  } catch (error) {
    $.ui.toast(`Could not speak: ${String(error)}`)
  } finally {
    if (mine === current) {
      await update($, status, (): Status => 'idle')
    }
  }
}

/** The briefing's text, or a short spoken line saying why there is none. */
const compose = async ($: EngineInterface) => {
  // The live conversation, whole, from the prompt cache.
  const fork = await $.model.fork({ prompt: HASTE + BRIEF })

  if (fork.isAnswered) {
    return forEar(fork.text)
  }

  // A thread just reopened holds nothing to fork: read what it saved.
  const messages = await $.session.messages()

  if ('deny' in messages || messages.length === 0) {
    return 'This thread is empty. Nothing has happened here yet.'
  }

  const first = messages.find(one => one.role === 'user')
  const tail = messages
    .slice(-40)
    .filter(one => one.text.trim().length > 0)
    .map(one => `${one.role.toUpperCase()}: ${cut(one.text, 1500)}`)
    .join('\n\n')
  const told = await $.model.complete({
    model: 'sonnet',
    system: BRIEF,
    maxTokens: 500,
    prompt:
      `The thread opened with this request:\n${cut(first?.text ?? '', 1500)}\n\n` +
      `Its most recent messages, oldest first:\n\n${tail}\n\n` +
      'Now give me the spoken catch-up.',
  })

  if (told.isAnswered) {
    return forEar(told.text)
  }

  return 'I could not put a catch-up together just now. Please try again.'
}

const catchUp = async ($: EngineInterface) => {
  if ((await read($, status)) !== 'idle') {
    return
  }

  await update($, status, (): Status => 'thinking')

  try {
    const text = await compose($)
    await update($, last, () => text)
    await say($, text)
  } catch (error) {
    await update($, status, (): Status => 'idle')
    $.ui.toast(`Catch-up failed: ${String(error)}`)
  }
}

const stop = async ($: EngineInterface) => {
  current += 1
  await update($, status, (): Status => 'idle')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // A reload drops the briefing that was speaking; the stored status stays.
    await update($, status, (): Status => 'idle')
    await $.command.register({
      name: 'catchup',
      description: 'Hear where this thread stands and what it needs from you',
    })

    return next(e)
  })

  on('command.run', { command: 'catchup' }, $ => {
    void catchUp($)

    return { text: 'Catching you up out loud.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const now = await read($, status)
    const heard = await read($, last)

    if (now === 'thinking') {
      return (
        <Box>
          <Text dimColor>Getting your catch-up ready...</Text>
        </Box>
      )
    }

    if (now === 'speaking') {
      return (
        <Box>
          <Text dimColor>Speaking... </Text>
          <Button key="stop" label="Stop" onPress={() => void stop($)} />
        </Box>
      )
    }

    return (
      <Box>
        <Button
          key="catch-up"
          label="Catch me up"
          onPress={() => void catchUp($)}
        />
        {heard !== null && <Text> </Text>}
        {heard !== null && (
          <Button
            key="again"
            label="Say it again"
            onPress={() => void say($, heard)}
          />
        )}
      </Box>
    )
  })
}
