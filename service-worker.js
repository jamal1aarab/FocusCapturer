// service-worker.js
console.log("Service worker running...");

// Listen for click on the extension icon
chrome.commands.onCommand.addListener(async function (command) {
  if (command !== "focusGardAction") return;

  console.log("FocusGard shortcut triggered");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    console.error("No active tab found");
    return;
  }

  if (tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Extension Error',
      message: 'This functionality is not supported in special pages like settings or extension pages.'
    });
    return;
  }

  const tabId = tab.id;

  const selector = `
    a[href],
    button,
    input:not([type="hidden"]),
    textarea,
    select,
    details,
    [tabindex]:not([tabindex="-1"]),
    [contenteditable],
    [role="button"],
    [role="link"]
  `;

  // Function to capture and crop a screenshot
  async function captureAndCropScreenshot(rect) {
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        chrome.tabs.captureVisibleTab(null, { format: "png" }, dataUrl => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(dataUrl);
          }
        });
      });

      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const imgBitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(imgBitmap.width, imgBitmap.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgBitmap, 0, 0);

      const padding = 10;
      const { top, left, width, height } = rect;
      const availableTop = top;
      const availableLeft = left;
      const availableRight = imgBitmap.width - (left + width);
      const availableBottom = imgBitmap.height - (top + height);

      const effectiveTopPadding = Math.min(padding, availableTop);
      const effectiveLeftPadding = Math.min(padding, availableLeft);
      const effectiveRightPadding = Math.min(padding, availableRight);
      const effectiveBottomPadding = Math.min(padding, availableBottom);

      const cropX = Math.max(Math.floor(left) - effectiveLeftPadding, 0);
      const cropY = Math.max(Math.floor(top) - effectiveTopPadding, 0);
      const cropWidth = Math.min(Math.floor(width) + effectiveLeftPadding + effectiveRightPadding, imgBitmap.width - cropX);
      const cropHeight = Math.min(Math.floor(height) + effectiveTopPadding + effectiveBottomPadding, imgBitmap.height - cropY);

      if (cropWidth <= 0 || cropHeight <= 0) {
        console.warn('Invalid crop dimensions:', cropX, cropY, cropWidth, cropHeight);
        return;
      }

      const croppedCanvas = new OffscreenCanvas(cropWidth, cropHeight);
      const croppedCtx = croppedCanvas.getContext('2d');
      croppedCtx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      const croppedBlob = await croppedCanvas.convertToBlob();
      const croppedDataUrl = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(croppedBlob);
      });

      return croppedDataUrl;
    } catch (error) {
      console.error('Error capturing or cropping screenshot:', error);
    }
  }

  // Find interactive elements
  async function getInteractiveElements() {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (selector) => {
        const isVisible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        const interactiveElements = document.querySelectorAll(selector);
        const visibleElements = Array.from(interactiveElements).filter(isVisible);

        visibleElements.forEach(el => {
          if (!el.id) {
            el.id = `auto-generated-id-${Math.random().toString(36).substr(2, 9)}`;
          }
        });

        return visibleElements.map(el => el.id);
      },
      args: [selector]
    });

    return result[0].result;
  }

  async function getInteractiveElementsHtml() {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (selector) => {
        const isVisible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        const interactiveElements = document.querySelectorAll(selector);
        const visibleElements = Array.from(interactiveElements).filter(isVisible);

        function escapeHtml(html) {
          return html.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }

        return visibleElements.map(el => el.outerHTML);
      },
      args: [selector]
    });

    return result[0].result;
  }

  async function processElements(elementIds) {
    const screenshotUrls = [];
    const screenshotFocusedUrls = [];

    for (const elementId of elementIds) {

      try {
        if (!elementId) {
          console.error('Invalid element:', elementId);
          continue;
        }

        await chrome.scripting.executeScript({
          target: { tabId },
          func: elementId => {
            const el = document.getElementById(elementId);
            if (el) el.focus();
          },
          args: [elementId]
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        const boundingClientRect = await chrome.scripting.executeScript({
          target: { tabId },
          func: elementId => {
            const el = document.getElementById(elementId);
            if (el) {
              const rect = el.getBoundingClientRect();
              return {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
              };
            }
          },
          args: [elementId]
        });

        const rect = boundingClientRect[0].result;
        const screenshotFocusedUrl = await captureAndCropScreenshot(rect);
        screenshotFocusedUrls.push(screenshotFocusedUrl);

        await chrome.scripting.executeScript({
          target: { tabId },
          func: elementId => {
            const el = document.getElementById(elementId);
            if (el) el.blur();
          },
          args: [elementId]
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        const screenshotUrl = await captureAndCropScreenshot(rect);
        screenshotUrls.push(screenshotUrl);
      } catch (error) {
        console.error('Error capturing screenshots for element:', elementId, error);
      }
    }

    return { screenshotUrls, screenshotFocusedUrls };
  }

  async function compareImages(screenshotUrls, screenshotFocusedUrls) {
    const results = [];

    for (let i = 0; i < screenshotUrls.length; i++) {
      const [blob1, blob2] = await Promise.all([
        (await fetch(screenshotUrls[i])).blob(),
        (await fetch(screenshotFocusedUrls[i])).blob()
      ]);

      const [bitmap1, bitmap2] = await Promise.all([
        createImageBitmap(blob1),
        createImageBitmap(blob2)
      ]);

      const canvas = new OffscreenCanvas(bitmap1.width, bitmap1.height);
      const ctx = canvas.getContext('2d');

      ctx.drawImage(bitmap1, 0, 0);
      ctx.globalCompositeOperation = 'difference';
      ctx.drawImage(bitmap2, 0, 0);
      ctx.globalCompositeOperation = 'source-over';

      const imageData = ctx.getImageData(0, 0, bitmap1.width, bitmap1.height);
      const pixels = imageData.data;

      const notSame = pixels.some((value, index) => value !== 0 && (index % 4 !== 3)); // Ignore alpha channel

      results.push(notSame);
    }

    return results;
  }

  const interactiveElementsIds = await getInteractiveElements();
  const interactiveElementsHtml = await getInteractiveElementsHtml();
  const { screenshotUrls, screenshotFocusedUrls } = await processElements(interactiveElementsIds);
  const comparisonResult = await compareImages(screenshotUrls, screenshotFocusedUrls);

  const message = `There are ${comparisonResult.length} interactive elements on the page. ${comparisonResult.filter(x => !x).length} of them do not have focus.`;

  // Open the screenshot in a new tab
  const viewTabUrl = chrome.runtime.getURL('screenshot.html');
  let targetId = null;

  function onTabUpdate(tabId, changedProps) {
    if (tabId !== targetId || changedProps.status !== 'complete') return;

    chrome.tabs.onUpdated.removeListener(onTabUpdate);
    chrome.tabs.sendMessage(tabId, { msg: 'screenshot', data: { htmlElements: interactiveElementsHtml, screenshotFocusedUrls, comparisonResult, message } });
  }

  const tab2 = await chrome.tabs.create({ url: viewTabUrl });
  targetId = tab2.id;
  chrome.tabs.onUpdated.addListener(onTabUpdate);
});
