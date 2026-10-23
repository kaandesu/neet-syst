import { expect, test, type Page } from '@playwright/test'

const mentor = (page: Page) => page.locator('aside')
const press = (page: Page, name: RegExp) => mentor(page).getByRole('button', { name }).last().click()

/** Drags from the right handle of one node to the left handle of another. */
async function connect(page: Page, from: string, to: string) {
  const a = page.locator(`.react-flow__handle[data-nodeid="${from}"][data-handlepos="right"]`)
  const b = page.locator(`.react-flow__handle[data-nodeid="${to}"][data-handlepos="left"]`)
  await a.hover({ force: true })
  await page.mouse.down()
  const box = (await b.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 })
  await page.mouse.up()
}

test('a new learner completes the first lesson and unlocks blocks', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /Your first request/ }).click()

  // Concept: narration, three cards, one reasoning question.
  await press(page, /^Continue/)
  await press(page, /^Continue/)
  for (let i = 0; i < 3; i++) await press(page, /Got it/)
  await press(page, /HTML of your homepage/)
  await expect(mentor(page)).toContainText('DNS never sees your content')
  await press(page, /IP address/)
  await press(page, /^Continue/)
  await press(page, /^Continue/)
  await press(page, /^Continue/) // section complete → drill

  // Drill: place two blocks via the tray, wire them, run traffic.
  await press(page, /^Continue/)
  await page.getByTitle(/^DNS:/).click()
  await page.getByTitle(/^Web Server:/).click()
  await connect(page, 'client', 'dns-1')
  await connect(page, 'dns-1', 'web-server-1')
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
  await press(page, /Run traffic/)
  await expect(mentor(page)).toContainText('It broke', { timeout: 10000 })
  await press(page, /^Continue/)
  await press(page, /One machine is doing two/)
  await press(page, /^Continue/)
  await press(page, /^Continue/)

  await expect(page.getByText('New block unlocked!')).toBeVisible()

  // Progress survives a reload.
  await page.reload()
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Give data its own home/ })).toBeVisible()
})
