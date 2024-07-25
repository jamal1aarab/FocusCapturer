// service-worker.js
console.log("Service worker running...");

// listen for click on the extension icon
chrome.action.onClicked.addListener(async function () {

  console.log("Action button clicked");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    console.error("No active tab found");
    return;
  }
  const tabId = tab.id;


  const selector = `
  a[href]
`;

  // console.log("Selector: ", selector);

    // Function to capture and crop a screenshot
    async function captureAndCropScreenshot(rect) {
      try {
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
  
        const cropX = Math.floor(left);
        const cropY = Math.floor(top);
        const cropWidth = Math.floor(width);
        const cropHeight = Math.floor(height);
  
  
        if (cropWidth <= 0 || cropHeight <= 0) {
          console.warn('Invalid crop dimensions:', cropX, cropY, cropWidth, cropHeight);
          return;
        }
        else {
          console.log('Crop dimensions:', cropX, cropY, cropWidth, cropHeight);
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


//

  const interactiveElementsIds = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (selector) => {
      // Define the isVisible function
      const isVisible = (el) => {
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      };

      // Select all elements matching the selector
      const interactiveElements = document.querySelectorAll(selector);

      // Filter out elements that are not visible
      const visibleElements = Array.from(interactiveElements).filter(el => isVisible(el));

      // Assign unique IDs to elements that don't have one
      visibleElements.forEach(el => {
        if (!el.id) {
          el.id = `auto-generated-id-${Math.random().toString(36).substr(2, 9)}`;
        }
      });

      // Return the IDs of visible elements
      return visibleElements.map(el => el.id);
    },
    args: [selector]
  });


  const interactiveElementsRects = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (selector) => {
      // Define the isVisible function
      const isVisible = (el) => {
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      };

      const interactiveElements = document.querySelectorAll(selector);

      const visibleElements = Array.from(interactiveElements).filter(el => isVisible(el));

      return visibleElements.map(el => {
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



  const rectsArray = interactiveElementsRects[0]?.result || [];

  //

  const screenshotUrls = [];
  const screenshotFocusedUrls = [];

  // Iterate through interactive elements
  async function processElement(interactiveElementsIds, rectsArray) {
    for (let i = 3; i < interactiveElementsIds.length; i++) {

      console.log("capturing Element N : ", i);

      const elementId = interactiveElementsIds[i];
      const boundingClientRect = rectsArray[i];

      try {

        if (!elementId || !boundingClientRect) {
          console.error('Invalid element or boundingClientRect:', elementId, boundingClientRect);
          continue;
        }



        // Blur the element
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: async (elementId) => {
            const el = document.getElementById(elementId);
            if (el) {
              // scrollToElement(el);
              el.focus();
            }
          },
          args: [elementId]
        });

        // Wait for the element to be focused
        await new Promise(resolve => setTimeout(resolve, 4000));

        // Capture screenshot with focus
        const screenshotFocusedUrl = await captureAndCropScreenshot(boundingClientRect);
        screenshotFocusedUrls.push(screenshotFocusedUrl);


        // Focus the element
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: async (elementId) => {
            const el = document.getElementById(elementId);
            if (el) {
              el.blur();
            }
          },
          args: [elementId]
        });

        // Wait for the element to be blurred
        await new Promise(resolve => setTimeout(resolve, 500));

        // Capture screenshot without focus
        const screenshotUrl = await captureAndCropScreenshot(boundingClientRect);
        screenshotUrls.push(screenshotUrl);

      } catch (error) {
        console.error('Error capturing screenshots for element:', elementId, error);
      }
    }
  }

  const htmlElements = interactiveElementsHtml[0]?.result || "";
  const htmlElement = htmlElements[1];


  console.log(htmlElements.length);




  await processElement(interactiveElementsIds[0].result, rectsArray);




  //
  console.log(htmlElements);




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
