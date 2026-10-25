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

test('solve the bakery: the skeleton fails, a CDN gets it accepted', async ({ page }) => {
  await page.goto('/problems')
  await page.getByRole('link', { name: /The Bakery Goes Viral/ }).click()
  await expect(page.getByRole('heading', { name: /The Bakery Goes Viral/ })).toBeVisible()

  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByText('Wrong answer')).toBeVisible()

  // Hints reveal one at a time; the last one drops a ghost slot.
  await page.getByRole('tab', { name: /Hints/ }).click()
  await page.getByRole('button', { name: 'Reveal hint 1' }).click()
  await expect(page.getByText(/Does a croissant photo need a web server/)).toBeVisible()

  await page.getByTitle(/^CDN:/).click()
  await page.getByTitle(/^Object Storage:/).click()
  await connect(page, 'client', 'cdn-1')
  await connect(page, 'cdn-1', 'object-storage-1')

  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByRole('dialog', { name: 'Accepted' })).toBeVisible()
  await expect(page.getByText('Used 1 hint')).toBeVisible()

  await page.getByRole('link', { name: 'Next problem' }).click()
  await expect(page.getByRole('link', { name: /The Bakery Goes Viral/ })).toBeVisible()
  await expect(page.getByText('1/8')).toBeVisible()
})
