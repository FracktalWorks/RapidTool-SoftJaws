const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('Starting E2E Playwright Test for CSG Cut on Preview...');
  
  const stlPath = path.join(__dirname, 'test_cube.stl');
  if (!fs.existsSync(stlPath)) {
    console.error(`Error: Sample STL not found at ${stlPath}`);
    process.exit(1);
  }

  let browser;
  try {
    console.log('Launching browser (channel: chrome)...');
    browser = await chromium.launch({ 
      channel: 'chrome',
      headless: true 
    });
  } catch (err) {
    console.log('System Chrome not found or failed to launch. Falling back to default Playwright chromium...');
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
    console.log('Navigating to http://localhost:4173...');
    await page.goto('http://localhost:4173', { timeout: 15000 });
    
    await page.waitForSelector('text=soft jaws', { timeout: 20000 });
    console.log('App loaded successfully.');

    console.log('Navigating to Import Part step...');
    const importStepBtn = page.locator('button[title="Import Part"]');
    await importStepBtn.click();
    await page.waitForTimeout(1000);

    console.log(`Uploading STL: ${stlPath}`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(stlPath);
    
    await page.waitForSelector('text=cube', { timeout: 20000 });
    console.log('STL part loaded successfully into App.');

    console.log('Navigating to Jaw Blank Setup step...');
    const blankStepBtn = page.locator('button[title="Jaw Blank Setup"]');
    await blankStepBtn.click();
    await page.waitForTimeout(1000);

    console.log('Navigating to Jaw Profile step...');
    const profileStepBtn = page.locator('button[title="Jaw Profile"]');
    await profileStepBtn.click();
    await page.waitForTimeout(1000);

    console.log('Reading calculated visual overlaps from Step 4...');
    const leftOverlapEl = page.locator('text=Left Overlap (X) >> xpath=following-sibling::span');
    const rightOverlapEl = page.locator('text=Right Overlap (X) >> xpath=following-sibling::span');
    
    await leftOverlapEl.waitFor({ timeout: 10000 });
    await rightOverlapEl.waitFor({ timeout: 10000 });

    const leftOverlap = await leftOverlapEl.textContent();
    const rightOverlap = await rightOverlapEl.textContent();
    console.log(`Left Overlap calculated: ${leftOverlap}`);
    console.log(`Right Overlap calculated: ${rightOverlap}`);

    console.log('Clicking "Generate Profile" to run CSG workers...');
    const generateBtn = page.locator('button:has-text("Generate Profile")');
    await generateBtn.click();

    console.log('Waiting for CSG computation and success confirmation...');
    const successAlert = page.locator('text=Profile generated — visible in the 3D viewport');
    await successAlert.waitFor({ timeout: 60000 });
    
    const details = await page.locator('text=triangles across both jaws').textContent();
    console.log(`Success alert visible: ${details.trim()}`);

    console.log('E2E TEST PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('E2E TEST FAILED:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
