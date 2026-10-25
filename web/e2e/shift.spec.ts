import { expect, test } from '@playwright/test'

test('a shift: briefing, lose a wave, open hints, then survive and score', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    const unlocked = ['client', 'dns', 'web-server', 'sql-db', 'nosql-db', 'load-balancer', 'read-replica']
    localStorage.setItem('neet-syst:progress', JSON.stringify({ state: { unlocked, devMode: true }, version: 2 }))
  })
  await page.goto('/')
  await page.getByRole('link', { name: /Monday Rush/ }).click()
  const stage = page.getByTestId('stage')

  // Visual-novel briefing, then the build.
  for (let i = 0; i < 3; i++) await stage.getByRole('button', { name: /^Continue/ }).click()
  await stage.getByRole('button', { name: /Start building/ }).click()
  await expect(stage).toContainText('Open after your first run')

  // The starting design falls over and hints open.
  await stage.getByRole('button', { name: /Start the shift/ }).click()
  await expect(stage).toContainText('Shift lost', { timeout: 12000 })
  await stage.getByRole('button', { name: /Show hint 1/ }).click()
  await expect(stage).toContainText('Count the peak first')

  // Swap in the reference design and survive with three stars.
  await page.evaluate(async () => {
    const { shiftById } = await import('/src/content/shifts/index.ts')
    const { useShifts } = await import('/src/store/shifts.ts')
    useShifts.getState().setDesign('monday-rush', shiftById('monday-rush')!.solution)
  })
  await stage.getByRole('button', { name: /Start the shift/ }).click()
  const victory = page.getByRole('dialog', { name: 'Shift survived' })
  await expect(victory).toBeVisible({ timeout: 12000 })
  await expect(victory.getByLabel('3 of 3 stars')).toBeVisible()
  await victory.getByRole('link', { name: 'Back to the story' }).click()
  await expect(page.getByRole('link', { name: /Monday Rush/ }).getByLabel('3 of 3 stars')).toBeVisible()
})
