// The seven reunion steps as the site reads them, mirroring the server's rules
// so no button is shown that the server would refuse. Same file as the phone app.
import { describe, it, expect } from 'vitest'
import { STEPS, STEP_NAMES, GUEST_STATES, stepIndex, nextAction, guestLine } from './reunionSteps'

describe('reunion steps', () => {
  it('seven steps, in order, with elder words', () => {
    expect(STEPS).toEqual(['WISH', 'ORGANISER', 'FINDING', 'PLAN', 'DAY', 'SEND_OFF', 'DONE'])
    expect(STEP_NAMES).toEqual(['Wish', 'Who plans', 'Finding', 'The plan', 'The day', 'Send-off', 'After'])
    expect(GUEST_STATES.map((s) => s.key)).toEqual(['REMEMBERED', 'FOUND', 'REACHED', 'COMING', 'CANNOT_COME'])
    expect(stepIndex('PLAN')).toBe(3)
    expect(stepIndex('STOPPED')).toBe(0)
  })

  it('finding and the plan move on only by the elder, with their conditions', () => {
    expect(nextAction({ step: 'FINDING', comingCount: 0 }, 'ORGANISER').show).toBe(false)
    const waits = nextAction({ step: 'FINDING', comingCount: 0 }, 'ELDER')
    expect(waits.enabled).toBe(false)
    expect(waits.reason).toMatch(/coming/)
    expect(nextAction({ step: 'FINDING', comingCount: 1 }, 'ELDER').enabled).toBe(true)
    expect(nextAction({ step: 'PLAN', plannedOn: 'Sunday', venue: '' }, 'ELDER').enabled).toBe(false)
    expect(nextAction({ step: 'PLAN', plannedOn: 'Sunday', venue: 'The park' }, 'ELDER').label).toBe('Approve the plan')
  })

  it('the day ends by either side; the send-off closes only when everyone who came is home', () => {
    expect(nextAction({ step: 'DAY' }, 'ORGANISER').enabled).toBe(true)
    expect(nextAction({ step: 'SEND_OFF', arrivedCount: 3, homeCount: 2 }, 'ELDER').enabled).toBe(false)
    const allHome = nextAction({ step: 'SEND_OFF', arrivedCount: 3, homeCount: 3 }, 'ELDER')
    expect(allHome.enabled).toBe(true)
    expect(allHome.closes).toBe(true)
    expect(guestLine({ guestCount: 6, comingCount: 3 })).toBe('6 remembered · 3 coming')
  })
})
