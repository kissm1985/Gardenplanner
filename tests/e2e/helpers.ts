import type { Page } from '@playwright/test';

/** Items that live in the top bar's ⋯ menu (Project, View and layers, Redo, Dark/Light mode). */
export async function menuItem(page: Page, name: string | RegExp) {
  await page.getByRole('button', { name: /^(Menü|Menu)$/ }).click();
  await page.getByRole('menuitem', { name }).click();
}
