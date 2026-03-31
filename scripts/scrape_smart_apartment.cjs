const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');

const TARGET_URL = 'https://members.smartapartmentdata.com/share/map(left:share/in-view)?guid=1d2d516d-4aa9-4929-8b1a-0b0025a6b0ba&mode=recieved';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // Capture all network requests/responses
  const apiResponses = [];
  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    // Log API calls (skip static assets)
    if (!url.match(/\.(js|css|png|jpg|gif|svg|woff|ttf|ico)(\?|$)/i)) {
      console.log(`[${status}] ${url.substring(0, 150)}`);
      // Capture JSON API responses
      if (response.headers()['content-type']?.includes('json')) {
        try {
          const body = await response.json();
          apiResponses.push({ url, status, body });
        } catch (e) {}
      }
    }
  });

  console.log('Navigating to page...');
  // Don't wait for full load — just go and let it render
  try {
    await page.goto(TARGET_URL, { waitUntil: 'commit', timeout: 30000 });
  } catch (e) {
    console.log('Navigation note:', e.message.substring(0, 100));
  }

  // Wait for JS to run and make API calls
  console.log('\nWaiting 15s for API calls...');
  await page.waitForTimeout(15000);

  // Screenshot
  try {
    await page.screenshot({ path: '/home/user/truv-brain/smart_apartment_screenshot.png', timeout: 10000 });
    console.log('Screenshot saved.');
  } catch (e) {
    console.log('Screenshot failed:', e.message.substring(0, 100));
  }

  // Save HTML
  const html = await page.content();
  fs.writeFileSync('/home/user/truv-brain/smart_apartment_page.html', html);
  console.log('HTML saved (' + html.length + ' chars)');

  // Save captured API responses
  if (apiResponses.length > 0) {
    fs.writeFileSync('/home/user/truv-brain/smart_apartment_api.json', JSON.stringify(apiResponses, null, 2));
    console.log('\nCaptured ' + apiResponses.length + ' API responses');
    for (const r of apiResponses) {
      const preview = JSON.stringify(r.body).substring(0, 300);
      console.log(`\n--- ${r.url.substring(0, 100)} ---`);
      console.log(preview);
    }
  } else {
    console.log('\nNo JSON API responses captured');
  }

  // Get visible text
  try {
    const text = await page.evaluate(() => document.body.innerText.substring(0, 5000));
    console.log('\n--- Visible Text ---');
    console.log(text);
  } catch (e) {
    console.log('Could not get text:', e.message.substring(0, 100));
  }

  await browser.close();
})();
