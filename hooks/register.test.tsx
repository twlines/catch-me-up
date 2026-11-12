import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'catch-me-up',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 6,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 6 },
    view: {},
  },
} as const

const settle = () => new Promise(resolve => setTimeout(resolve, 50))

test('a press speaks the live thread, one clean sentence at a time', async ($, on) => {
  const spoken: string[] = []
  on('model.fork', () => ({
    value: {
      isAnswered: true,
      text: '**This thread** builds a spoken catch-up.\n- I need one thing: try the button.',
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
  }))
  on('audio.speak', (_, e) => {
    spoken.push(e.text)

    return { value: { via: 'system' } }
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'catch-up' })
  await settle()

  expect(spoken).toEqual([
    'This thread builds a spoken catch-up.',
    'I need one thing: try the button.',
  ])
  await ui.unmount()
})

test('a reopened thread with nothing to fork is read from its saved messages', async ($, on) => {
  const spoken: string[] = []
  let asked = ''
  on('model.fork', () => ({
    value: { isAnswered: false, reason: 'nothing-to-fork' },
  }))
  on('session.messages', () => ({
    value: [
      { role: 'user', text: 'Plan the garden beds.', toolUses: [] },
      { role: 'assistant', text: 'Sketch is done. Plant list is owed.', toolUses: [] },
    ],
  }))
  on('model.complete', (_, e) => {
    asked = String(e.prompt)

    return {
      value: {
        isAnswered: true,
        text: 'The sketch is done.',
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      },
    }
  })
  on('audio.speak', (_, e) => {
    spoken.push(e.text)

    return { value: { via: 'system' } }
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'catch-up' })
  await settle()

  expect(asked).toContain('Plan the garden beds.')
  expect(asked).toContain('Plant list is owed.')
  expect(spoken).toEqual(['The sketch is done.'])
  await ui.unmount()
})
