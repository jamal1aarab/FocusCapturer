// content.js

// Function to write text to clipboard
async function writeTextToClipboard(value) {
    if (!value) {
        console.error('No value provided to write to clipboard');
        return { status: 'error', message: 'No value provided' };
    }
    try {
        await navigator.clipboard.writeText(value);
        console.log('Text copied to clipboard successfully!');
        return { status: 'success' };
    } catch (err) {
        console.error('Failed to add text to clipboard:', err);
        return { status: 'error', message: err.toString() };
    }
}

// Function to write blob to clipboard
async function writeBlobToClipboard(blob) {
    if (!blob) {
        console.error('No blob provided to write to clipboard');
        return { status: 'error', message: 'No blob provided' };
    }
    try {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        console.log('Image blob copied to clipboard successfully!');
        return { status: 'success' };
    } catch (err) {
        handleClipboardError(err);
        return { status: 'error', message: err.toString() };
    }
}

// Function to write base64 data to clipboard
async function writeBase64ToClipboard(base64data) {
    if (!base64data) {
        console.error('No base64 data provided to write to clipboard');
        return { status: 'error', message: 'No base64 data provided' };
    }
    try {
        const blob = await fetch(base64data).then(response => response.blob());
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        console.log('Image blob copied to clipboard successfully!');
        return { status: 'success' };
    } catch (err) {
        handleClipboardError(err);
        return { status: 'error', message: err.toString() };
    }
}

// Helper function to handle clipboard errors
function handleClipboardError(err) {
    if (err instanceof DOMException) {
        console.error('Failed to add to clipboard: DOMException', err);
    } else if (err instanceof TypeError) {
        console.error('Failed to add to clipboard: TypeError', err);
    } else {
        console.error('Failed to add to clipboard: Unknown error', err);
    }
    console.error('Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack
    });
}

// Listening for messages from background or popup scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || !request.action) {
        console.error('Invalid request received');
        sendResponse({ status: 'error', message: 'Invalid request' });
        return false;
    }

    if (request.action === 'copyTextToClipboard') {
        if (!request.value) {
            console.error('No value provided for copyTextToClipboard');
            sendResponse({ status: 'error', message: 'No value provided' });
            return false;
        }
        writeTextToClipboard(request.value).then(response => {
            sendResponse(response);
        }).catch((error) => {
            sendResponse({ status: 'error', message: error.toString() });
        });
        return true;  // Will respond asynchronously
    } else if (request.action === 'copyBlobToClipboard') {
        if (!request.blob) {
            console.error('No blob provided for copyBlobToClipboard');
            sendResponse({ status: 'error', message: 'No blob provided' });
            return false;
        }
        writeBlobToClipboard(request.blob).then(response => {
            sendResponse(response);
        }).catch((error) => {
            sendResponse({ status: 'error', message: error.toString() });
        });
        return true;  // Will respond asynchronously
    } else if (request.action === 'copyImageUrlToClipboard') {
        if (!request.imageUrl) {
            console.error('No imageUrl provided for copyImageUrlToClipboard');
            sendResponse({ status: 'error', message: 'No imageUrl provided' });
            return false;
        }
        const imageUrl = request.imageUrl;
        fetch(imageUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.blob();
            })
            .then(blob => writeBlobToClipboard(blob))
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ status: 'error', message: error.toString() }));
        return true;  // Will respond asynchronously
    } else {
        console.error('Unknown action:', request.action);
        sendResponse({ status: 'error', message: 'Unknown action' });
        return false;
    }
});
