function setScreenshotUrl(htmlElement,screenshotUrl) {
    document.getElementById('html-target').innerHTML = htmlElement;
    document.getElementById('img-target').src = screenshotUrl;
  }
  
  chrome.runtime.onMessage.addListener(function (request) {
    if (request.msg === 'screenshot') {
      setScreenshotUrl(request.data.htmlElement,request.data.screenshotUrl);
    }
  });