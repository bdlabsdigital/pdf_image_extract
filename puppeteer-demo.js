import puppeteer from 'puppeteer';

async function puppeteerDemo() {
  console.log('🚀 Starting Puppeteer demo...');
  
  const browser = await puppeteer.launch({ 
    headless: false, // Set to true to run without GUI
    slowMo: 500 // Slow down for demo purposes
  });
  
  const page = await browser.newPage();
  
  try {
    // Demo 1: Navigate to a website and take a screenshot
    console.log('📸 Taking screenshot of Google homepage...');
    await page.goto('https://www.google.com');
    await page.screenshot({ path: 'google-homepage.png' });
    
    // Demo 2: Search for something
    console.log('🔍 Performing a search...');
    await page.type('textarea[name="q"]', 'puppeteer web scraping');
    await page.keyboard.press('Enter');
    await page.waitForSelector('h3');
    
    // Demo 3: Extract data from search results
    const searchResults = await page.evaluate(() => {
      const results = [];
      const elements = document.querySelectorAll('h3');
      for (let i = 0; i < Math.min(5, elements.length); i++) {
        results.push(elements[i].textContent);
      }
      return results;
    });
    
    console.log('📋 First 5 search results:');
    searchResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result}`);
    });
    
    // Demo 4: Generate a PDF of the search results page
    console.log('📄 Generating PDF of search results...');
    await page.pdf({ 
      path: 'search-results.pdf', 
      format: 'A4',
      printBackground: true
    });
    
    // Demo 5: Navigate to a different page and interact with forms
    console.log('🌐 Navigating to example.com...');
    await page.goto('https://httpbin.org/forms/post');
    
    // Fill out a form
    await page.type('input[name="custname"]', 'Puppeteer Demo User');
    await page.type('input[name="custtel"]', '555-123-4567');
    await page.type('input[name="custemail"]', 'demo@example.com');
    await page.select('select[name="size"]', 'large');
    
    console.log('✅ Form filled successfully!');
    
    // Demo 6: Get page performance metrics
    const metrics = await page.metrics();
    console.log('⚡ Page performance metrics:');
    console.log(`- Script duration: ${metrics.ScriptDuration}ms`);
    console.log(`- Layout duration: ${metrics.LayoutDuration}ms`);
    console.log(`- Nodes: ${metrics.Nodes}`);
    
  } catch (error) {
    console.error('❌ Error during demo:', error);
  } finally {
    console.log('🏁 Demo complete! Closing browser...');
    await browser.close();
  }
}

// Run the demo
puppeteerDemo().catch(console.error);