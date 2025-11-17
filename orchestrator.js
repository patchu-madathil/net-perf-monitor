// Global application namespace (App is the Orchestrator)
const app = {};

// --- DOM Elements ---
let emailInput, testButton, localVideo, resultsContent, errorDisplay, webrtcResultsContent;
let webrtcSummaryHeader, videoSummaryHeader; // Reference headers for status updates

// --- Global Metrics Storage ---
let localMetrics;
let youtubeMetrics;
let webrtcMetrics;

// --- Helper Functions (unchanged: validateEmail, handleEmailInput, calculateRebufferRatio) ---
// ...

// --- Display Functions ---

function displayWebrtcSummary() {
    const metrics = webrtcMetrics;
    
    if (metrics.error) {
        webrtcSummaryHeader.innerHTML = "🎙️ VoIP WebRTC Test Metrics (❌ FAILED)";
        webrtcResultsContent.innerHTML = `
            <ul class="metric-list">
                <li style="background-color: #fdd; border-left: 4px solid red; font-weight: bold;">
                    ❌ WEB RTC TEST FAILED: ${metrics.errorMessage || 'Unknown WebRTC failure.'}
                </li>
            </ul>
        `;
        return;
    }

    webrtcSummaryHeader.innerHTML = "🎙️ VoIP WebRTC Test Metrics (✅ SUCCESS)";
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
            const durationMs = metrics.name === "Local Video" ? 45000 : 30000;
            const totalBufferingTimeDisplay = `${(metrics.totalBufferingMs / 1000).toFixed(2)}s`;
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

    if (testSuccessCount === allMetrics.length) {
        videoSummaryHeader.innerHTML = "📊 Video Test Summary (✅ SUCCESS)";
    } else if (testSuccessCount > 0) {
        videoSummaryHeader.innerHTML = `📊 Video Test Summary (⚠️ PARTIAL SUCCESS: ${testSuccessCount}/${allMetrics.length})`;
    } else {
        videoSummaryHeader.innerHTML = "📊 Video Test Summary (❌ FAILED)";
    }

    resultsContent.innerHTML = html;
}


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
    
    let localResult = { metrics: { name: "Local Video", error: true } };
    let youtubeResult = { metrics: { name: "YouTube Video", error: true } };
    
    try {
        const videoId = await videoTest.getGuaranteedVideoId();
        
        // 2. STEP 1: WEB RTC TEST
        webrtcSummaryHeader.innerHTML = "🎙️ VoIP WebRTC Test Metrics (⏳ RUNNING...)";
        console.log("Starting WebRTC VoIP Test...");
        
        const webrtcResult = await webrtcTest.runTest(); 
        webrtcMetrics = webrtcResult.metrics;
        displayWebrtcSummary(); 
        
        await new Promise(r => setTimeout(r, 1000)); 
        
        // 3. STEP 2: VIDEO TESTS (Local & YouTube)
        
        // Local Test
        videoSummaryHeader.innerHTML = "📊 Video Test Summary (⏳ RUNNING LOCAL TEST...)";
        console.log("Starting Local Video Test...");
        localResult = await videoTest.runLocalVideoTest(); 
        localMetrics = localResult.metrics;
        
        await new Promise(r => setTimeout(r, 1000)); 
        
        // YouTube Test
        videoSummaryHeader.innerHTML = "📊 Video Test Summary (⏳ RUNNING YOUTUBE TEST...)";
        console.log("Starting YouTube Video Test...");
        youtubeResult = await videoTest.runYoutubeVideoTest(videoId); 
        youtubeMetrics = youtubeResult.metrics;

        // 4. Final Display
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
    
    // 🆕 Retrieve headers for status updates
    webrtcSummaryHeader = document.querySelector('#webrtcSummary h2');
    videoSummaryHeader = document.querySelector('#summary h2');

    // Bind handlers
    emailInput.addEventListener('input', handleEmailInput);
    
    // Initialize YouTube API and WebRTC environment
    videoTest.injectYoutubeAPI(); 
}

document.addEventListener('DOMContentLoaded', initialize);
