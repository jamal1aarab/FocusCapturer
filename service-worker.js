// service-worker.js
console.log("Service worker running...");

// Listen for clicks on the extension's action button
chrome.action.onClicked.addListener(async function () {

  console.log("Action button clicked");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    console.error("No active tab found");
    return;
  }

  const tabId = tab.id;

  console.log("Capturing elements...");

  const selector = `
    a[href]
  `;

  const interactiveElements = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (selector) => {
      const interactiveElements = document.querySelectorAll(selector);
      return [...interactiveElements];
    },
    args: [selector]
  });

  const interactiveElementsHtml = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (selector) => {
      const interactiveElements = document.querySelectorAll(selector);

      function escapeHtml(html) {
        return html.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }

      return Array.from(interactiveElements).map(el => escapeHtml(el.outerHTML));
    },
    args: [selector]
  });

  const interactiveElementsRects = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (selector) => {
      const interactiveElements = document.querySelectorAll(selector);
      interactiveElements[0].blur();
      return Array.from(interactiveElements).map(el => {
        const rect = el.getBoundingClientRect();
        return {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        };
      });
    },
    args: [selector]
  });



  // Function to capture and crop a screenshot
  async function captureAndCropScreenshot(rect) {
    try {
      console.log('Capturing and cropping screenshot...');
      const preCut = await new Promise((resolve, reject) => {
        chrome.tabs.captureVisibleTab(null, { format: "png" }, function (dataUrl) {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(dataUrl);
          }
        });
      });

      const response = await fetch(preCut);
      const blob = await response.blob();

      const imgBitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(imgBitmap.width, imgBitmap.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgBitmap, 0, 0);

      const padding = 10;

      const { top, left, width, height } = rect;
      const cropX = Math.max(Math.floor(left) - padding, 0);
      const cropY = Math.max(Math.floor(top) - padding, 0);
      const cropWidth = Math.min(Math.floor(width) + 2 * padding, imgBitmap.width - cropX);
      const cropHeight = Math.min(Math.floor(height) + 2 * padding, imgBitmap.height - cropY);


      if (cropWidth <= 0 || cropHeight <= 0 || cropX < 0 || cropY < 0) {
        throw new Error('Invalid crop dimensions');
      }

      const croppedCanvas = new OffscreenCanvas(cropWidth, cropHeight);
      const croppedCtx = croppedCanvas.getContext('2d');
      croppedCtx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      const croppedBlob = await croppedCanvas.convertToBlob();
      const croppedDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(croppedBlob);
      });

      return croppedDataUrl;

    } catch (error) {
      console.error('Error capturing or cropping screenshot:', error);
    }
  }



  const rectsArray = interactiveElementsRects[0]?.result || [];


  const screenshotUrl = await captureAndCropScreenshot(rectsArray[0]);

  const screenshotUrls = [screenshotUrl];




  const interactiveElementsRectsFocused = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (selector) => {
      const interactiveElements = document.querySelectorAll(selector);

      interactiveElements[0].focus();
      return Array.from(interactiveElements).map(el => {
        const rect = el.getBoundingClientRect();
        return {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        };
      });
    },
    args: [selector]
  });



  const rectsArrayFocused = interactiveElementsRectsFocused[0]?.result || [];

  const screenshotFocusedUrl = await captureAndCropScreenshot(rectsArrayFocused[0]);

  const screenshotFocusedUrls = [screenshotFocusedUrl]


  //

  // for (const element of interactiveElements.result) {
  //   try {
  //     // Focus on the element
  //     element.focus();

  //     // Capture screenshot with focus
  //     const screenshotFocusedUrl = await captureAndCropScreenshot(element.getBoundingClientRect());
  //     console.log('Captured focused screenshot:', screenshotFocusedUrl);

  //     // Capture screenshot without focus
  //     element.blur();
  //     const screenshotUrl = await captureAndCropScreenshot(element.getBoundingClientRect());
  //     console.log('Captured unfocused screenshot:', screenshotUrl);

  //     // Process or display the screenshots as needed
  //     // Example: Send screenshots to another tab or process them further
  //   } catch (error) {
  //     console.error('Error capturing screenshot for element:', element, error);
  //   }
  // }




  //

  const htmlElements = interactiveElementsHtml[0]?.result || "";
  const htmlElement = htmlElements[1];
  console.log(htmlElement);


  // Open the screenshot in a new tab

  const viewTabUrl = chrome.runtime.getURL('screenshot.html');
  let targetId = null;

  chrome.tabs.onUpdated.addListener(function listener(tabId, changedProps) {
    if (tabId != targetId || changedProps.status != 'complete') return;

    chrome.tabs.onUpdated.removeListener(listener);
    chrome.tabs.sendMessage(tabId, { msg: 'screenshot', data: { screenshotUrls, screenshotFocusedUrls, htmlElement } });
  });

  const tab2 = await chrome.tabs.create({ url: viewTabUrl });
  targetId = tab2.id;

});
