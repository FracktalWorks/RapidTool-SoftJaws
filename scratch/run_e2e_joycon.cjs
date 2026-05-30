const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('Starting E2E Playwright Test for Joycon Grip CSG Cut...');
  
  const stlPath = path.join(__dirname, 'single_joycon_grip+.stl');
  if (!fs.existsSync(stlPath)) {
    console.error(`Error: Joycon STL not found at ${stlPath}`);
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
    console.log(`[PAGE LOG]: [${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  try {
    console.log('Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { timeout: 15000 });
    
    await page.waitForSelector('text=soft jaws', { timeout: 15000 });
    console.log('App loaded successfully.');

    // 1. Switch to "Import Part" step
    console.log('Navigating to Import Part step...');
    const importStepBtn = page.locator('button[title="Import Part"]');
    await importStepBtn.click();
    await page.waitForTimeout(1000);

    // 2. Upload the generated STL file
    console.log(`Uploading STL: ${stlPath}`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(stlPath);
    
    // Wait for part to load and show in card
    await page.waitForSelector('text=single_joycon_grip', { timeout: 25000 });
    console.log('STL part loaded successfully into App.');

    // 3. Switch to "Jaw Blank Setup" step
    console.log('Navigating to Jaw Blank Setup step...');
    const blankStepBtn = page.locator('button[title="Jaw Blank Setup"]');
    await blankStepBtn.click();
    await page.waitForTimeout(1000);

    // 4. Switch to "Jaw Profile" step
    console.log('Navigating to Jaw Profile step...');
    const profileStepBtn = page.locator('button[title="Jaw Profile"]');
    await profileStepBtn.click();
    await page.waitForTimeout(1000);

    // 5. Read visual overlaps
    console.log('Reading calculated visual overlaps from Step 4...');
    const leftOverlapEl = page.locator('text=Left Overlap (X) >> xpath=following-sibling::span');
    const rightOverlapEl = page.locator('text=Right Overlap (X) >> xpath=following-sibling::span');
    
    await leftOverlapEl.waitFor({ timeout: 10000 });
    await rightOverlapEl.waitFor({ timeout: 10000 });

    const leftOverlap = await leftOverlapEl.textContent();
    const rightOverlap = await rightOverlapEl.textContent();
    console.log(`Left Overlap calculated: ${leftOverlap}`);
    console.log(`Right Overlap calculated: ${rightOverlap}`);

    // 6. Click "Generate Profile"
    console.log('Clicking "Generate Profile" to run CSG workers...');
    const generateBtn = page.locator('button:has-text("Generate Profile")');
    await generateBtn.click();

    // 7. Wait for Success Toast/Alert
    console.log('Waiting for CSG computation and success confirmation...');
    const successAlert = page.locator('text=Profile generated — visible in the 3D viewport');
    await successAlert.waitFor({ timeout: 90000 });
    
    const details = await page.locator('text=triangles across both jaws').textContent();
    console.log(`Success alert visible: ${details.trim()}`);

    // 8. Take a screenshot of the viewport and panel
    const screenshotPath = 'C:\\Users\\Sidda\\.gemini\\antigravity-ide\\brain\\a0abe166-9fa8-404a-b062-d5685695841e\\media_test_joycon.png';
    console.log(`Taking screenshot and saving to: ${screenshotPath}`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log('E2E TEST PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('E2E TEST FAILED:', err);
    try {
      const errScreenshotPath = 'C:\\Users\\Sidda\\.gemini\\antigravity-ide\\brain\\a0abe166-9fa8-404a-b062-d5685695841e\\media_test_joycon_failure.png';
      await page.screenshot({ path: errScreenshotPath, fullPage: true });
      console.log(`Saved failure screenshot to: ${errScreenshotPath}`);
    } catch (_) {}
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
