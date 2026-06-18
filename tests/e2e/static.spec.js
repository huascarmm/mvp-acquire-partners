const { test, expect } = require('@playwright/test');

// El frontend estatico se sirve y renderiza (selector de mercado + embudo).
test('index lista los 4 mercados', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('h1.title')).toBeVisible();
  await expect(page.locator('#grid .card')).toHaveCount(4);
});

test('funnel carga el hero del mercado cafe', async ({ page }) => {
  await page.goto('/funnel.html?m=cafe');
  await expect(page.locator('.step .title')).toBeVisible();
  await expect(page.locator('#go')).toBeVisible();
});

test('funnel sin mercado valido redirige a index', async ({ page }) => {
  await page.goto('/funnel.html?m=inexistente');
  await expect(page).toHaveURL(/index\.html$/);
});

test('admin muestra login', async ({ page }) => {
  await page.goto('/admin.html');
  await expect(page.locator('#signin')).toBeVisible();
});
