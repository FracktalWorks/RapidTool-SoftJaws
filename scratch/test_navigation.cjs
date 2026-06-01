const { chromium } = require('playwright');

(async () => {
  console.log('Testing Navigation Clicks...');
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
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

    // Try to click Step 3 (Jaw Blank Setup) in Sidebar using its exact sidebar title
    console.log('Clicking Step 3 Sidebar Icon (title="Configure jaw blank dimensions and material")...');
    const sidebarBlankBtn = page.locator('button[title="Configure jaw blank dimensions and material"]');
    await sidebarBlankBtn.click();
    await page.waitForTimeout(1000);

    headerText = await page.locator('h2').first().textContent();
    console.log(`Step after Sidebar Click: ${headerText.trim()}`);

    // Go back to step 1
    console.log('Clicking Step 1 Sidebar Icon (title="Select vise or chuck type, jaw count, and dimensions")...');
    const sidebarViseBtn = page.locator('button[title="Select vise or chuck type, jaw count, and dimensions"]');
    await sidebarViseBtn.click();
    await page.waitForTimeout(1000);

    headerText = await page.locator('h2').first().textContent();
    console.log(`Step after returning to Step 1: ${headerText.trim()}`);

    // Try clicking Step 3 in the bottom mini-map
    console.log('Clicking Step 3 (Jaw Blank Setup) in bottom mini-map...');
    const count = await page.locator('button[title="Jaw Blank Setup"]').count();
    console.log(`Found ${count} buttons with title "Jaw Blank Setup"`);
    
    if (count >= 1) {
      await page.locator('button[title="Jaw Blank Setup"]').last().click();
      await page.waitForTimeout(1000);
      headerText = await page.locator('h2').first().textContent();
      console.log(`Step after bottom mini-map Click: ${headerText.trim()}`);
      if (headerText.trim() !== 'Jaw Blank Setup') {
        throw new Error('Expected to navigate to Jaw Blank Setup');
      }
    }

    // Now try to click Step 4 (Jaw Profile) which is blocked (since no part is loaded)
    console.log('Trying to click blocked Step 4 (Jaw Profile) in bottom mini-map...');
    const profileBtn = page.locator('button[title="Jaw Profile"]').last();
    // Check if disabled attribute is present
    const isDisabled = await profileBtn.isDisabled();
    console.log(`Is Jaw Profile button disabled? ${isDisabled}`);
    if (!isDisabled) {
      throw new Error('Expected Jaw Profile button to be disabled');
    }

    // Try clicking it anyway (it shouldn't navigate because of the gate check in onGoToStep and disabled attribute)
    await profileBtn.click({ force: true });
    await page.waitForTimeout(1000);
    headerText = await page.locator('h2').first().textContent();
    console.log(`Step after attempting blocked click: ${headerText.trim()}`);
    if (headerText.trim() !== 'Jaw Blank Setup') {
      throw new Error('Should not have navigated away from Jaw Blank Setup!');
    }
    
    console.log('All navigation click tests passed!');

  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
