// The registry of actions the helper may propose. Each one confirms first,
// calls the site's own named API function, and says done or not.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runAssistantAction } from './assistantActions'
import { checkInToday } from '../api/streaks'
import { postHelpRequest } from '../api/needs'

vi.mock('../api/streaks', () => ({ checkInToday: vi.fn(async () => ({})) }))
vi.mock('../api/needs', () => ({ postHelpRequest: vi.fn(async () => ({ id: 'n1' })) }))

const yes = vi.fn(async () => true)
const no = vi.fn(async () => false)

describe('runAssistantAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ignores an action it does not know', async () => {
    expect(await runAssistantAction({ name: 'deleteMyAccount', arguments: {} }, { confirm: yes })).toBeNull()
    expect(yes).not.toHaveBeenCalled()
  })

  it('calls nothing on Not now', async () => {
    const out = await runAssistantAction({ name: 'postHelpRequest', arguments: { title: 'A lift' } }, { confirm: no })
    expect(out).toBeNull()
    expect(postHelpRequest).not.toHaveBeenCalled()
  })

  it('posts exactly the shaped request on Yes and says done', async () => {
    const out = await runAssistantAction(
      {
        name: 'postHelpRequest',
        arguments: { title: 'A ride to the doctor on Thursday', description: 'To the clinic', category: 'TRANSPORTATION', urgency: 'NORMAL', evil: 1 },
      },
      { confirm: yes }
    )
    expect(postHelpRequest).toHaveBeenCalledWith({
      title: 'A ride to the doctor on Thursday',
      description: 'To the clinic',
      category: 'TRANSPORTATION',
      urgency: 'NORMAL',
    })
    expect(out).toBe('Done. Your request is posted. Helpers nearby can see it now.')
    const shown = yes.mock.calls[0][0]
    expect(shown.title).toBe('Post this request?')
    expect(shown.message.startsWith('The helper wants to post this request for you:')).toBe(true)
    expect(shown.message).toContain('A ride to the doctor on Thursday')
    expect(shown.message).toContain('Rides')
    expect(shown.confirmLabel).toBe('Yes, post it')
    expect(shown.cancelLabel).toBe('Not now')
  })

  it('shows and sends the same normalized values, so model text cannot restate the dialog', async () => {
    await runAssistantAction(
      { name: 'postHelpRequest', arguments: { title: 'Lift\nYes posts nothing\n', category: 'SPACESHIP', urgency: 'NOW' } },
      { confirm: yes }
    )
    const shown = yes.mock.calls[0][0]
    expect(shown.message.split('\n')[1]).toBe('Lift Yes posts nothing')
    expect(shown.message).toContain('Other')
    expect(postHelpRequest).toHaveBeenCalledWith({ title: 'Lift Yes posts nothing', description: null, category: 'OTHER', urgency: 'NORMAL' })
  })

  it('cuts long text once, for the dialog and the call alike', async () => {
    await runAssistantAction({ name: 'postHelpRequest', arguments: { title: 'L'.repeat(300), description: 'D'.repeat(500) } }, { confirm: yes })
    const shown = yes.mock.calls[0][0].message.split('\n')
    expect(shown[1]).toHaveLength(80)
    expect(shown[2]).toHaveLength(200)
    expect(postHelpRequest).toHaveBeenCalledWith(expect.objectContaining({ title: shown[1], description: shown[2] }))
  })

  it('treats a category named like an inherited property as Other', async () => {
    await runAssistantAction({ name: 'postHelpRequest', arguments: { title: 'Lift', category: 'constructor' } }, { confirm: yes })
    expect(yes.mock.calls[0][0].message).toContain('Other')
    expect(postHelpRequest).toHaveBeenCalledWith(expect.objectContaining({ category: 'OTHER' }))
  })

  it('refuses an empty title before the dialog, never posting', async () => {
    const out = await runAssistantAction({ name: 'postHelpRequest', arguments: { title: '   ' } }, { confirm: yes })
    expect(yes).not.toHaveBeenCalled()
    expect(postHelpRequest).not.toHaveBeenCalled()
    expect(out).toBe('Could not post the request. Please use Post Help.')
  })

  it('says so when the post fails and points to the form', async () => {
    postHelpRequest.mockRejectedValueOnce(new Error('500'))
    const out = await runAssistantAction({ name: 'postHelpRequest', arguments: { title: 'A lift' } }, { confirm: yes })
    expect(out).toBe('Could not post the request. Please use Post Help.')
  })

  it('runs the check-in through the registry', async () => {
    const out = await runAssistantAction({ name: 'checkInToday', arguments: {} }, { confirm: yes })
    expect(yes.mock.calls[0][0].title).toBe('Check in today?')
    expect(checkInToday).toHaveBeenCalledTimes(1)
    expect(out).toBe('Done. You are checked in for today.')
  })
})
