// content.js
console.log("content script");


async function captureAndCropScreenshot(rect) {
    try {
      console.log('Capturing and cropping screenshot...');
  
      // Capture visible tab as base screenshot
      const dataUrl = await new Promise((resolve, reject) => {
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, dataUrl => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError.message);
          } else {
            resolve(dataUrl);
          }
        });
      });
  
      // Fetch the base screenshot as a blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
  
      // Create an ImageBitmap from the blob
      const imgBitmap = await createImageBitmap(blob);
  
      // Create an OffscreenCanvas and draw the base image on it
      const canvas = new OffscreenCanvas(imgBitmap.width, imgBitmap.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgBitmap, 0, 0);
  
      // Calculate cropping dimensions
      const padding = 10;
      const { left, top, width, height } = rect;
      const cropX = Math.max(Math.floor(left) - padding, 0);
      const cropY = Math.max(Math.floor(top) - padding, 0);
      const cropWidth = Math.min(Math.floor(width) + 2 * padding, imgBitmap.width - cropX);
      const cropHeight = Math.min(Math.floor(height) + 2 * padding, imgBitmap.height - cropY);
  
      // Crop the image
      const croppedCanvas = new OffscreenCanvas(cropWidth, cropHeight);
      const croppedCtx = croppedCanvas.getContext('2d');
      croppedCtx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  
      // Convert cropped canvas to a blob and then to data URL
      const croppedBlob = await croppedCanvas.convertToBlob();
      const croppedDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(croppedBlob);
      });
  
      return croppedDataUrl;
    } catch (error) {
      console.error('Error capturing or cropping screenshot:', error);
      return null;
    }
  }
  
  // Message listener for screenshot capture
  chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.msg === 'captureScreenshots') {
      const { interactiveElements } = message.data;
  
      const screenshotUrls = [];
      const screenshotFocusedUrls = [];
  
      for (const element of interactiveElements) {
        try {
          // Focus on the element
          element.focus();
  
          // Capture screenshot with focus
          const screenshotFocusedUrl = await captureAndCropScreenshot(element.getBoundingClientRect());
          console.log('Captured focused screenshot:', screenshotFocusedUrl);
          screenshotFocusedUrls.push(screenshotFocusedUrl);
  
          // Blur the element
          element.blur();
  
          // Capture screenshot without focus
          const screenshotUrl = await captureAndCropScreenshot(element.getBoundingClientRect());
          console.log('Captured unfocused screenshot:', screenshotUrl);
          screenshotUrls.push(screenshotUrl);
  
        } catch (error) {
          console.error('Error capturing screenshots for element:', element, error);
        }
      }
  
      // Send captured screenshots or data back to the service worker
      sendResponse({ screenshotUrls, screenshotFocusedUrls });
    }
  });
  