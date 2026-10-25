import { expect, test } from '@playwright/test'

const stage = (page: import('@playwright/test').Page) => page.getByTestId('stage')

test('a case study: pick a branch, then compare with what the experts built', async ({ page }) => {
  await page.goto('/cases')
  await expect(page.getByRole('heading', { name: 'Case studies' })).toBeVisible()
  await page.getByRole('link', { name: /Instagram’s photo feed/ }).click()
  await expect(page.getByRole('button', { name: /Scope/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Deep dives/ })).toBeDisabled()

  // Dev mode opens every section, so we can jump straight to the deep dive.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('neet-syst:progress') ?? '{"state":{},"version":2}')
    raw.state.devMode = true
    localStorage.setItem('neet-syst:progress', JSON.stringify(raw))
  })
  await page.goto('/learn/case-instagram/2')
  await stage(page).getByRole('button', { name: /^Continue/ }).last().click()
  await stage(page).getByRole('button', { name: /Run traffic/ }).last().click()
  await expect(stage(page)).toContainText('It broke', { timeout: 10000 })
  await stage(page).getByRole('button', { name: /^Continue/ }).last().click()

  await page.getByRole('button', { name: /Shard Postgres by user/ }).click()
  await stage(page).getByRole('button', { name: /Run traffic/ }).last().click()
  await expect(stage(page)).toContainText('Goals met', { timeout: 10000 })
  await stage(page).getByRole('button', { name: /^Continue/ }).last().click()

  const reveal = page.getByRole('dialog', { name: 'How the experts did it' })
  await expect(reveal).toBeVisible()
  await expect(reveal).toContainText('What they built')
  await expect(reveal.getByText('Passes the test')).toHaveCount(2)
})
