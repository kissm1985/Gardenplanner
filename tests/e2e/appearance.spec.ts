import { expect, test } from '@playwright/test';

test('one-tap language and dark mode in the top bar; author and rights notice', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.welcome-credit')).toContainText('Kiss-Mihály István');
  await page.getByRole('button', { name: /Kezdés/ }).click();

  await page.getByRole('button', { name: 'Sötét mód' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Világos mód' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.getByRole('button', { name: 'Select', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Váltás magyarra' }).click();
  await expect(page.getByRole('button', { name: 'Kijelölés', exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Projekt: mentés/ }).click();
  const about = page.locator('dialog[open] .about');
  await expect(about).toContainText('Készítette: Kiss-Mihály István');
  await expect(about).toContainText('Minden jog fenntartva');
  await expect(about).toContainText(/Verzió \d+\.\d+\.\d+ · build/);
});
