import { expect, test, type Page } from '@playwright/test'

async function connect(page: Page, from: string, to: string) {
  const a = page.locator(`.react-flow__handle[data-nodeid="${from}"][data-handlepos="right"]`)
  const b = page.locator(`.react-flow__handle[data-nodeid="${to}"][data-handlepos="left"]`)
  await a.hover({ force: true })
  await page.mouse.down()
  const box = (await b.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 })
  await page.mouse.up()
}

const seed = (page: Page, unlocked: string[]) =>
  page.addInitScript((unlocked) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('neet-syst:progress', JSON.stringify({ state: { unlocked }, version: 2 }))
  }, unlocked)

test('a new learner has nothing to build with yet', async ({ page }) => {
  await page.goto('/sandbox')
  await expect(page.getByText('Nothing to build with yet')).toBeVisible()
})

test('build, clear a challenge, break it, and share it', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await seed(page, ['client', 'dns', 'web-server'])
  await page.goto('/sandbox')

  // Only earned blocks are offered, and challenges that need more stay locked.
  await expect(page.getByTitle(/^Web Server:/)).toBeVisible()
  await expect(page.getByTitle(/^Load Balancer:/)).toHaveCount(0)
  await expect(page.getByText(/^Needs LB/).first()).toBeVisible()

  await page.getByRole('button', { name: /^Hello, world/ }).click()
  await page.getByTitle(/^DNS:/).click()
  await page.getByTitle(/^Web Server:/).click()
  await connect(page, 'client', 'dns-1')
  await connect(page, 'dns-1', 'web-server-1')
  await expect(page.getByText('Challenge cleared: Hello, world')).toBeVisible()
  await expect(page.getByTestId('breaking-point')).toHaveText(/^[45]\d\d$/)

  // Chaos: kill the only server and nothing gets through.
  await page.locator('.react-flow__node', { hasText: 'web-server-1' }).click()
  await page.getByRole('button', { name: /Kill it/ }).click()
  await expect(page.getByText('Nothing gets through')).toBeVisible()
  await page.getByRole('button', { name: /Revive 1/ }).click()

  // Remove a block with the mouse: the inspector's button, then the badge on a selected block.
  await page.getByTitle(/^Web Server:/).click()
  await page.locator('.react-flow__node', { hasText: 'web-server-2' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^Remove/ }).click()
  await expect(page.locator('.react-flow__node', { hasText: 'web-server-2' })).toHaveCount(0)
  await page.getByTitle(/^Web Server:/).click()
  await page.locator('.react-flow__node', { hasText: 'web-server-' }).last().click()
  await page.getByRole('button', { name: 'Remove Server' }).click()
  await expect(page.locator('.react-flow__node', { hasText: 'web-server-' })).toHaveCount(1)

  await page.getByRole('button', { name: /^Share/ }).click()
  const url = await page.evaluate(() => navigator.clipboard.readText())
  expect(url).toContain('/sandbox#design=')

  // Opening the link elsewhere shows the design and keeps the visitor's own one recoverable.
  const other = await context.newPage()
  await other.goto(url)
  await expect(other.getByText('You’re looking at a shared design.')).toBeVisible()
  await expect(other.locator('.react-flow__node', { hasText: 'web-server-1' })).toBeVisible()
})
