// Global application namespace (App is the Orchestrator)
const app = {};

// --- DOM Elements ---
let emailInput, testButton, localVideo, resultsContent, errorDisplay, webrtcResultsContent;
let webrtcSummaryHeader, videoSummaryHeader; 

// --- Global Metrics Storage ---
let localMetrics;
let youtubeMetrics;
let webrtcMetrics;

// --- Helper Functions (Assuming unchanged: validateEmail, handleEmailInput, calculateRebufferRatio) ---
// ... (omitting helper functions for brevity - assume they are present) ...

// --- Display Functions (Unchanged) ---
// ... (omitting displayWebrtcSummary and displayVideoSummary for brevity - assume they are present) ...


// --- Main Orchestration Function ---

/**
 * Main Orchestration function, starts all tests sequentially and updates UI status.
 */
app.startAllTests = async function() {
    // 1. Initial Reset and Setup
    errorDisplay.style.display = 'none';
    resultsContent.innerHTML = '<p>Video test results will appear here after the tests are complete.</p>';
    webrtcResultsContent.innerHTML = '<p>WebRTC VoIP test metrics will appear here.</p>';
    webrtcSummaryHeader.innerHTML = "🎙️ VoIP WebRTC Test Metrics";
    videoSummaryHeader.innerHTML = "📊 Video Test Summary";
    testButton.disabled = true; 
    
    try {
        const videoId = await videoTest.getGuaranteedVideoId();
        
        // --- STEP 1: WEB RTC TEST ---
        webrtcSummaryHeader.innerHTML = "🎙️ VoIP WebRTC Test Metrics (⏳ RUNNING: 30s)";
        webrtcResultsContent.innerHTML = '<p style="color: #1a73e8; font-weight: 500;">Please grant microphone access if prompted. Running test...</p>';
        console.log("Starting WebRTC VoIP Test...");
        
        const webrtcResult = await webrtcTest.runTest(); 
        webrtcMetrics = webrtcResult.metrics;
        displayWebrtcSummary(); // Updates header to SUCCESS or FAILED
        
        await new Promise(r => setTimeout(r, 1000)); 
        
        // --- STEP 2: VIDEO TESTS (Local & YouTube) ---
        
        // Local Test
        videoSummaryHeader.innerHTML = "📊 Video Test Summary (⏳ RUNNING: Local Video)";
        resultsContent.innerHTML = '<p style="color: #1a73e8; font-weight: 500;">Running Local Video Test (45s)...</p>';
        console.log("Starting Local Video Test...");
        const localResult = await videoTest.runLocalVideoTest(); 
        localMetrics = localResult.metrics;
        
        await new Promise(r => setTimeout(r, 1000)); 
        
        // YouTube Test
        videoSummaryHeader.innerHTML = "📊 Video Test Summary (⏳ RUNNING: YouTube Video)";
        resultsContent.innerHTML = '<p style="color: #1a73e8; font-weight: 500;">Running YouTube Video Test (30s)...</p>';
        console.log("Starting YouTube Video Test...");
        const youtubeResult = await videoTest.runYoutubeVideoTest(videoId); 
        youtubeMetrics = youtubeResult.metrics;

        // 4. Final Display
        displayVideoSummary(); // Updates header to FINAL SUCCESS/PARTIAL/FAILED
        
    } catch (e) {
        displayError(`An unexpected error occurred during test orchestration: ${e.message}`);
    } finally {
        testButton.disabled = false; 
    }
};

// --- Initialization ---

function initialize() {
    // Get DOM elements
    emailInput = document.getElementById('emailInput');
    testButton = document.getElementById('testButton');
    localVideo = document.getElementById('localVideo');
    resultsContent = document.getElementById('resultsContent');
    errorDisplay = document.getElementById('errorDisplay');
    webrtcResultsContent = document.getElementById('webrtcResultsContent');
    
    // Retrieve headers for status updates
    webrtcSummaryHeader = document.querySelector('#webrtcSummary h2');
    videoSummaryHeader = document.querySelector('#summary h2');

    // Bind handlers
    emailInput.addEventListener('input', handleEmailInput);
    
    // Initialize YouTube API and WebRTC environment
    // Note: videoTest.injectYoutubeAPI is assumed to be present in videotest.js
    // If you are using the full refactored code, ensure videoTest.injectYoutubeAPI is callable or integrated.
    if (typeof videoTest !== 'undefined' && typeof videoTest.injectYoutubeAPI === 'function') {
        videoTest.injectYoutubeAPI(); 
    }
}

document.addEventListener('DOMContentLoaded', initialize);
// ... (window.onYouTubeIframeAPIReady remains in videotest.js)
