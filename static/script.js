
// ===================================
// PHISHGUARD - URL SCANNER
// ===================================

function scanURL() {

    const urlInput = document.getElementById("urlInput");
    const resultBox = document.getElementById("resultBox");
    const scanButton = document.getElementById("scanButton");

    const url = urlInput.value.trim();

    // Check if input is empty
    if (url === "") {
        alert("Please enter a website URL.");
        return;
    }

    // Basic URL validation
    let formattedURL = url;

    if (!/^https?:\/\//i.test(formattedURL)) {
        formattedURL = "https://" + formattedURL;
    }

    try {
        new URL(formattedURL);
    } catch (error) {
        alert("Please enter a valid website URL.");
        return;
    }

    // Show loading state
    resultBox.style.display = "block";
    resultBox.innerHTML = `
        <h3>🔍 Analyzing Website...</h3>
        <p>Please wait while we check the URL.</p>
    `;

    scanButton.disabled = true;
    scanButton.textContent = "Scanning...";

    // Temporary demonstration result
    // We will connect this to Flask and the ML model later.

    setTimeout(() => {

        resultBox.innerHTML = `
            <h3>Demo Scan Completed</h3>
            <p><strong>Website:</strong> ${escapeHTML(formattedURL)}</p>
            <p>This is a demonstration result.
            Actual phishing detection will be connected
            to the machine learning model later.</p>
        `;

        scanButton.disabled = false;
        scanButton.textContent = "Scan URL";

    }, 1500);
}


// Safely display user-entered text
function escapeHTML(value) {
    return value.replace(/[&<>"']/g, function(character) {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[character];
    });
}
