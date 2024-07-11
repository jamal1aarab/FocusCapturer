// service-worker.js

console.log("Service worker running...");

// Listen for clicks on the extension's action (popup) button
chrome.action.onClicked.addListener(async function () {


  console.log("Action button clicked");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    console.error("No active tab found");
    return;
  }

  const tabId = tab.id;

  console.log("Capturing elements...");


  const interactiveElements = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => {
      const selectors = `
      a[href]
        `;
      const interactiveElements = document.querySelectorAll(selectors);
      return Array.from(interactiveElements).map(el => el.outerHTML);
    }
  });

  const interactiveElementsRects = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => {
      const selectors = `
      a[href]
    `;
      const interactiveElements = document.querySelectorAll(selectors);
      return Array.from(interactiveElements).map(el => {
        const rect = el.getBoundingClientRect();
        return {
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height
        };
      });
    }
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
  
      const { top, left, width, height } = rect;
      const cropWidth = Math.floor(width);
      const cropHeight = Math.floor(height);
      const cropX = Math.floor(left);
      const cropY = Math.floor(top);
  
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
  

  // Get the focused element's bounding box

  // const result = await chrome.scripting.executeScript({
  //   target: { tabId: tabId },
  //   func: () => {
  //     const focusedElement = document.activeElement;
  //     if (focusedElement && focusedElement !== document.body && focusedElement !== document.documentElement) {
  //       const rect = focusedElement?.getBoundingClientRect() || null;
  //       const padding = 5; // Adjust the padding value as needed
  //       if (rect) {
  //         const x = Math.max(Math.floor(rect.left) - padding, 0);
  //         const y = Math.max(Math.floor(rect.top) - padding, 0);
  //         const width = Math.min(Math.floor(rect.width) + 2 * padding, window.innerWidth - x);
  //         const height = Math.min(Math.floor(rect.height) + 2 * padding, window.innerHeight - y);
  //         return { x, y, width, height };
  //       }
  //       return null;
  //     } else {
  //       return "No element focused on";
  //     }
  //   }
  // });

  // const rect = result[0]?.result || { x: 0, y: 0, width: 400, height: 1000 };

  // const screenshotUrl = await captureAndCropScreenshot(rect);

  // Extract the first rectangle from the result
  const rectsArray = interactiveElementsRects[0]?.result || [];

  if (rectsArray.length > 0) {
    const firstRect = rectsArray[0];
    console.log(firstRect);

    if (firstRect && typeof firstRect.top === 'number' && typeof firstRect.left === 'number' &&
      typeof firstRect.width === 'number' && typeof firstRect.height === 'number') {
      const screenshotUrl = await captureAndCropScreenshot(firstRect);
    } else {
      console.error('Invalid rect object:', firstRect);
    }
  } else {
    console.error('No rectangles found in the result.');
  }


  const screenshotUrl = await captureAndCropScreenshot(rectsArray[0]);

  //

  const htmlElements = interactiveElements[0]?.result || "";
  const htmlElement = htmlElements[0];
  console.log(htmlElement);


  //


  const viewTabUrl = chrome.runtime.getURL('screenshot.html');
  let targetId = null;

  chrome.tabs.onUpdated.addListener(function listener(tabId, changedProps) {
    if (tabId != targetId || changedProps.status != 'complete') return;

    chrome.tabs.onUpdated.removeListener(listener);
    chrome.tabs.sendMessage(tabId, { msg: 'screenshot', data: { screenshotUrl, htmlElement } });
  });

  const tab2 = await chrome.tabs.create({ url: viewTabUrl });
  targetId = tab2.id;

});
