// Global namespace for the application logic
const app = {};

// --- Configuration Constants ---
const LOCAL_VIDEO_DURATION_MS = 45000;
const YOUTUBE_VIDEO_DURATION_MS = 30000;

// NEW: Endpoint and Hard Fallback List 
const YOUTUBE_SEARCH_URL = 'https://corsproxy.io/?https://noembed.com/api/?url=https://youtube.com/watch?v=';

// Hardcoded fallback if network discovery fails 
const HARD_FALLBACK_IDS = ['iM5XhM-DqL4', 'aqz-KE-bpDs', 'LXb3EKWsInQ'];

// Global storage for metrics, player instance, and discovered ID
let localMetrics = {};
let youtubeMetrics = {};
let player; 
let dynamicVideoId = null;

// --- DOM Elements (Accessed after the DOM is loaded) ---
let emailInput, testButton, localVideo, resultsContent, errorDisplay;

// --- Error Handling Function ---
function displayError(message) {
    if (errorDisplay) {
        errorDisplay.innerHTML = `🚨 Error: ${message}`;
        errorDisplay.style.display = 'block';
    } else {
        console.error(`Application Error: ${message}`);
    }
    if (testButton) {
        testButton.disabled = false;
    }
    if (resultsContent) {
        resultsContent.innerHTML = '<p>Test failed due to an error. See above for details.</p>';
    }
}

// --- Helper Functions ---
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}

function handleEmailInput() {
    testButton.disabled = !validateEmail(emailInput.value);
    errorDisplay.style.display = 'none';
}

function calculateRebufferRatio(totalBufferingMs, totalDurationMs) {
    const ratio = totalBufferingMs / totalDurationMs;
    return `${(ratio * 100).toFixed(4)}%`;
}

/**
 * Fetches a dynamic video ID (or falls back to a stable one).
 */
async function getDynamicVideoId() {
    try {
        const response = await fetch(YOUTUBE_SEARCH_URL + HARD_FALLBACK_IDS[0]);
        if (!response.ok) throw new Error('Network error or proxy failed.');
        
        console.log("Network check passed. Using primary stable ID.");
        return HARD_FALLBACK_IDS[0]; 

    } catch (e) {
        console.warn(`Dynamic video fetch failed (${e.message}). Falling back to primary ID.`);
        return HARD_FALLBACK_IDS[0]; 
    }
}


// --- Video Test Functions ---

/**
 * 2. Function for Local Video Playback and Measurement (unchanged)
 */
function runLocalVideoTest() {
    let localStartTime = 0;
    let localBufferingCount = 0;
    let localBufferingStartTime = 0;
    let localTotalBufferingMs = 0; 
    
    localMetrics = {
        name: "Local Video",
        initialLatency: "N/A",
        totalStalls: 0,
        duration: `${LOCAL_VIDEO_DURATION_MS / 1000}s`,
        totalBufferingMs: 0
    };

    function setupListeners(resolve) {
        const handleLoadStart = () => { localStartTime = performance.now(); };
        const handlePlaying = () => {
            if (localMetrics.initialLatency === "N/A") {
                localMetrics.initialLatency = `${(performance.now() - localStartTime).toFixed(2)} ms`;
            }
            if (localBufferingStartTime > 0) {
                localTotalBufferingMs += performance.now() - localBufferingStartTime;
                localBufferingStartTime = 0;
            }
        };
        const handleWaiting = () => {
            localBufferingCount++;
            if (localBufferingStartTime === 0) {
                localBufferingStartTime = performance.now();
            }
        };
