import { expect, test, type Page } from '@playwright/test'

const mentor = (page: Page) => page.getByTestId('stage')
const press = (page: Page, name: RegExp) => mentor(page).getByRole('button', { name }).last().click()

/** Drags from the right handle of one node to the left handle of another, or (`body`) to the middle of it. */
async function connect(page: Page, from: string, to: string, body = false) {
  const a = page.locator(`.react-flow__handle[data-nodeid="${from}"][data-handlepos="right"]`)
  const b = body ? page.locator(`.react-flow__node[data-id="${to}"]`) : page.locator(`.react-flow__handle[data-nodeid="${to}"][data-handlepos="left"]`)
  await a.hover({ force: true })
  await page.mouse.down()
  const box = (await b.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 })
  await page.mouse.up()
}

test('a new learner completes the first lesson and unlocks blocks', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Your first request/ })).toHaveAttribute('aria-current', 'true')
  await page.getByRole('link', { name: /Start episode/ }).first().click()

  // Concept: narration in the dock, three block cards and one question popping up over the board.
  await press(page, /^Continue/)
  await press(page, /^Continue/)
  for (let i = 0; i < 3; i++) await press(page, /Got it/)
  await expect(page.getByRole('dialog', { name: 'Question' })).toBeVisible()
  await press(page, /HTML of your homepage/)
  await expect(mentor(page)).toContainText('DNS never sees your content')
  await press(page, /IP address/)
  await press(page, /^Continue/)
  await press(page, /^Continue/)
  await press(page, /^Continue/) // section complete → drill

  // Drill: place two blocks via the tray, wire them (the second by dropping on the block itself), run traffic.
  await press(page, /^Continue/)
  await page.getByTitle(/^DNS:/).click()
  await page.getByTitle(/^Web Server:/).click()
  await connect(page, 'client', 'dns-1')
  await connect(page, 'dns-1', 'web-server-1', true)
  await press(page, /Run traffic/)
  await expect(mentor(page)).toContainText('Goals met', { timeout: 6000 })
  await press(page, /^Continue/)
  await press(page, /^Continue/) // → level

  // Level: watch it pass, then melt.
  await press(page, /^Continue/)
  await press(page, /Run traffic/)
  await expect(mentor(page)).toContainText('Goals met', { timeout: 8000 })
  await press(page, /^Continue/)
  await press(page, /^Continue/)
  // Predict-before-run: call the part that breaks first, then check the reveal.
  await expect(mentor(page)).toContainText('which part breaks first?')
  await page.locator('.react-flow__node[data-id="web"]').click()
  await expect(mentor(page)).toContainText('Your call:')
  await press(page, /Run traffic/)
  await expect(mentor(page)).toContainText('It broke', { timeout: 10000 })
  await expect(mentor(page)).toContainText('You called it')
  await press(page, /^Continue/)
  await press(page, /One machine is doing two/)
  await press(page, /^Continue/)
  await press(page, /^Continue/)

  await expect(page.getByText('New block unlocked!')).toBeVisible()

  // Progress survives a reload.
  await page.reload()
  await page.goto('/')
  // The next episode is now the selected "up next" one on the story page.
  await expect(page.getByRole('button', { name: /Give data its own home/ })).toHaveAttribute('aria-current', 'true')
})
