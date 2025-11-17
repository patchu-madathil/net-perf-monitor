// Global application namespace (App is the Orchestrator)
const app = {};

// --- DOM Elements ---
let emailInput, testButton, localVideo, resultsContent, errorDisplay, webrtcResultsContent;

// --- Global Metrics Storage ---
let localMetrics;
let youtubeMetrics;
let webrtcMetrics;

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

// --- Display Functions ---

function displayWebrtcSummary() {
    const metrics = webrtcMetrics;
    
    if (metrics.error) {
        webrtcResultsContent.innerHTML = `
            <ul class="metric-list">
                <li style="background-color: #fdd; border-left: 4px solid red; font-weight: bold;">
                    ❌ WEB RTC TEST FAILED: ${metrics.errorMessage || 'Unknown WebRTC failure.'}
                </li>
            </ul>
        `;
        return;
    }

    webrtcResultsContent.innerHTML = `
        <ul class="metric-list">
            <li style="font-weight: bold; border-left: 4px solid #1a73e8;">**Overall MOS Score (E-Model):** ${metrics.mosScore.toFixed(2)}</li>
            <li>**Average One-Way Latency (ms):** ${metrics.avgLatency.toFixed(2)}</li>
            <li>**Average Jitter (ms):** ${metrics.avgJitter.toFixed(2)}</li>
            <li>**Total Packet Loss (%):** ${metrics.packetLoss.toFixed(2)}%</li>
            <li>**Test Duration:** ${metrics.durationMs / 1000}s</li>
        </ul>
    `;
}

function displayVideoSummary() {
    const allMetrics = [localMetrics, youtubeMetrics];
    let testSuccessCount = 0;
    
    let html = '';
    
    allMetrics.forEach(metrics => {
        
        html += `<h3>${metrics.name} Metrics</h3>`;
        
        if (metrics.error) {
            html += `
                <ul class="metric-list">
                    <li style="background-color: #fdd; border-left: 4px solid red; font-weight: bold;">
                        ❌ TEST FAILED: ${metrics.errorMessage || 'Unknown Error'}
                    </li>
                    <li>Duration: ${metrics.duration || 'N/A'}</li>
                </ul>
            `;
        } else {
            testSuccessCount++;
            const totalBufferingTimeDisplay = `${(metrics.totalBufferingMs / 1000).toFixed(2)}s`;
            const durationMs = metrics.name === "Local Video" ? 45000 : 30000;
            const rebufferRatio = calculateRebufferRatio(metrics.totalBufferingMs, durationMs);
            
            html += `
                <ul class="metric-list">
                    <li>**Test Duration:** ${metrics.duration}</li>
                    <li>**Initial Latency:** ${metrics.initialLatency}</li>
                    <li class="buffering-time" style="font-weight: bold;">
                        🛑 **Total Buffering Time:** ${totalBufferingTimeDisplay}
                    </li>
                    <li class="rebuffer-ratio" style="font-weight: bold;">
                        ⚠️ **Rebuffer Ratio:** ${rebufferRatio}
                    </li>
                    <li>**Number of Stalls (#):** ${metrics.totalStalls}</li>
                </ul>
            `;
        }
    });

    if (testSuccessCount === 0) {
        html = `<h2>Video Test Failed Completely!</h2>${html}`;
    } else {
        html = `<h2>Video Test Complete! (${testSuccessCount} of ${allMetrics.length} successful)</h2>` + html;
    }

    resultsContent.innerHTML = html;
}


// --- Main Orchestration Function ---

/**
 * 1. Main Orchestration function, starts all tests sequentially.
 */
app.startAllTests = async function() {
    // Reset UI
    errorDisplay.style.display = 'none';
    resultsContent.innerHTML = '<p style="color: #1a73e8; font-weight: 500;">Starting tests...</p>';
    webrtcResultsContent.innerHTML = '<p style="color: #1a73e8; font-weight: 500;">Starting WebRTC VoIP Test...</p>';
    testButton.disabled = true; 
    
    try {
        // --- STEP 1: WEB RTC TEST ---
        console.log("Starting WebRTC VoIP Test...");
        const webrtcResult = await webrtcTest.runTest(); // Call the function from webrtc_test.js
        webrtcMetrics = webrtcResult.metrics;
        displayWebrtcSummary(); 

        await new Promise(r => setTimeout(r, 1000)); 
        
        // --- STEP 2: VIDEO TESTS SETUP ---
        const videoId = await videoTest.getGuaranteedVideoId();
        
        // --- STEP 3: LOCAL VIDEO TEST ---
        console.log("Starting Local Video Test...");
        const localResult = await videoTest.runLocalVideoTest(); 
        localMetrics = localResult.metrics;
        
        await new Promise(r => setTimeout(r, 1000)); 
        
        // --- STEP 4: YOUTUBE TEST ---
        console.log("Starting YouTube Video Test...");
        const youtubeResult = await videoTest.runYoutubeVideoTest(videoId); 
        youtubeMetrics = youtubeResult.metrics;

        // --- STEP 5: DISPLAY VIDEO SUMMARY ---
        displayVideoSummary();
        
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
    
    // Bind handlers
    emailInput.addEventListener('input', handleEmailInput);
    
    // Initialize YouTube API and WebRTC environment
    videoTest.injectYoutubeAPI(); 
}

document.addEventListener('DOMContentLoaded', initialize);
