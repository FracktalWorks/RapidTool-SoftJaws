const { chromium } = require('playwright');

(async () => {
  console.log('Testing Navigation Clicks...');
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    browser = await chromium.launch({ headless: true });
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  
  const page = await context.newPage();
  
  page.on('console', msg => {
    console.log(`[PAGE LOG]: [${msg.type()}] ${msg.text()}`);
  });

  try {
    await page.goto('http://localhost:5173', { timeout: 15000 });
    await page.waitForSelector('text=soft jaws', { timeout: 20000 });
    console.log('App loaded.');

    // Print initial step text
    let headerText = await page.locator('h2').first().textContent();
    console.log(`Initial Step: ${headerText.trim()}`);

    // Try to click Step 3 (Jaw Blank Setup) in Sidebar
    console.log('Clicking Step 3 (Jaw Blank Setup) in Sidebar...');
    const sidebarBlankBtn = page.locator('button[title="Jaw Blank Setup"]');
    await sidebarBlankBtn.click();
    await page.waitForTimeout(1000);

    headerText = await page.locator('h2').first().textContent();
    console.log(`Step after Sidebar Click: ${headerText.trim()}`);

    // Go back to step 1
    console.log('Clicking Step 1 (Vise Config) in Sidebar...');
    const sidebarViseBtn = page.locator('button[title="Vise Configuration"]');
    await sidebarViseBtn.click();
    await page.waitForTimeout(1000);

    headerText = await page.locator('h2').first().textContent();
    console.log(`Step after returning to Step 1: ${headerText.trim()}`);

    // Try clicking Step 3 in the bottom mini-map
    console.log('Clicking Step 3 (Jaw Blank Setup) in bottom mini-map...');
    const miniMapBlankBtn = page.locator('button[title="Jaw Blank Setup"]').nth(1); // Wait, first is sidebar, second is mini-map? Or let's use exact selectors.
    // In WorkflowNavigation, the title is "Jaw Blank Setup" (or similar).
    // Let's print all buttons with title "Jaw Blank Setup"
    const count = await page.locator('button[title="Jaw Blank Setup"]').count();
    console.log(`Found ${count} buttons with title "Jaw Blank Setup"`);
    
    if (count > 1) {
      await page.locator('button[title="Jaw Blank Setup"]').last().click();
      await page.waitForTimeout(1000);
      headerText = await page.locator('h2').first().textContent();
      console.log(`Step after bottom mini-map Click: ${headerText.trim()}`);
    }

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await browser.close();
  }
})();
