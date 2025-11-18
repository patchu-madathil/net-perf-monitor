// Global application namespace (App is the Orchestrator)
const app = {};

// --- Global Metrics Storage (Namespaced) ---
app.localMetrics = {};
app.youtubeMetrics = {};
app.webrtcMetrics = {};

// --- Initialization (DOM elements are attached to 'app' namespace) ---

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}

function handleEmailInput() {
    app.testButton.disabled = !validateEmail(app.emailInput.value);
    app.errorDisplay.style.display = 'none';
}

function initialize() {
    // Get DOM elements and attach them to the 'app' namespace
    app.emailInput = document.getElementById('emailInput');
    app.testButton = document.getElementById('testButton');
    app.localVideo = document.getElementById('localVideo');
    app.resultsContent = document.getElementById('resultsContent');
    app.errorDisplay = document.getElementById('errorDisplay');
    app.webrtcResultsContent = document.getElementById('webrtcResultsContent');
    
    // Retrieve headers for status updates
    app.webrtcSummaryHeader = document.querySelector('#webrtcSummary h2');
    app.videoSummaryHeader = document.querySelector('#summary h2');

    // Bind handlers
    app.emailInput.addEventListener('input', handleEmailInput);
    
    // Initialize YouTube API
    if (typeof videoTest !== 'undefined' && typeof videoTest.injectYoutubeAPI === 'function') {
        videoTest.injectYoutubeAPI(); 
    }
}

document.addEventListener('DOMContentLoaded', initialize);

// --- Display Functions ---

function calculateRebufferRatio(totalBufferingMs, totalDurationMs) {
    const ratio = totalBufferingMs / totalDurationMs;
    return `${(ratio * 100).toFixed(4)}%`;
}

function displayWebrtcSummary() {
    const metrics = app.webrtcMetrics;
    
    if (metrics.error) {
        app.webrtcSummaryHeader.innerHTML = "🎙️ VoIP WebRTC Test Metrics (❌ FAILED)";
        app.webrtcResultsContent.innerHTML = `
            <ul class="metric-list">
                <li style="background-color: #fdd; border-left: 4px solid red; font-weight: bold;">
                    ❌ WEB RTC TEST FAILED: ${metrics.errorMessage || 'Unknown WebRTC failure.'}
                </li>
            </ul>
        `;
        return;
    }

    app.webrtcSummaryHeader.innerHTML = "🎙️ VoIP WebRTC Test Metrics (✅ SUCCESS)";
    app.webrtcResultsContent.innerHTML = `
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
    const allMetrics = [app.localMetrics, app.youtubeMetrics];
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
        app.videoSummaryHeader.innerHTML = "📊 Video Test Summary (✅ SUCCESS)";
    } else if (testSuccessCount > 0) {
        app.videoSummaryHeader.innerHTML = `📊 Video Test Summary (⚠️ PARTIAL SUCCESS: ${testSuccessCount}/${allMetrics.length})`;
    } else {
        app.videoSummaryHeader.innerHTML = "📊 Video Test Summary (❌ FAILED)";
    }

    app.resultsContent.innerHTML = html;
}


// --- Main Orchestration Function ---

app.startAllTests = async function() {
    // Reset UI
    app.errorDisplay.style.display = 'none';
    app.resultsContent.innerHTML = '<p>Video test results will appear here after the tests are complete.</p>';
    app.webrtcResultsContent.innerHTML = '<p>WebRTC VoIP test metrics will appear here.</p>';
    app.webrtcSummaryHeader.innerHTML = "🎙️ VoIP WebRTC Test Metrics";
    app.videoSummaryHeader.innerHTML = "📊 Video Test Summary";
    app.testButton.disabled = true; 
    
    try {
        const videoId = await videoTest.getGuaranteedVideoId();
        
        // 1. STEP 1: WEB RTC TEST (Sequential)
        app.webrtcSummaryHeader.innerHTML = "🎙️ VoIP WebRTC Test Metrics (⏳ RUNNING: 30s)";
        app.webrtcResultsContent.innerHTML = '<p style="color: #1a73e8; font-weight: 500;">Please grant microphone access if prompted. Running test...</p>';
        
        const webrtcResult = await webrtcTest.runTest(); 
        app.webrtcMetrics = webrtcResult.metrics;
        displayWebrtcSummary(); 
        
        await new Promise(r => setTimeout(r, 1000)); 
        
        // 2. STEP 2: VIDEO TESTS (Sequential)
        
        // Local Test
        app.videoSummaryHeader.innerHTML = "📊 Video Test Summary (⏳ RUNNING: Local Video)";
        app.resultsContent.innerHTML = '<p style="color: #1a73e8; font-weight: 500;">Running Local Video Test (45s)...</p>';
        const localResult = await videoTest.runLocalVideoTest(app.localVideo); 
        app.localMetrics = localResult.metrics;
        
        await new Promise(r => setTimeout(r, 1000)); 
        
        // YouTube Test
        app.videoSummaryHeader.innerHTML = "📊 Video Test Summary (⏳ RUNNING: YouTube Video)";
        app.resultsContent.innerHTML = '<p style="color: #1a73e8; font-weight: 500;">Running YouTube Video Test (30s)...</p>';
        const youtubeResult = await videoTest.runYoutubeVideoTest(videoId); 
        app.youtubeMetrics = youtubeResult.metrics;

        // 3. Final Display
        displayVideoSummary();
        
    } catch (e) {
        // This catches orchestration errors, not test failures (which are handled internally)
        displayError(`An unexpected error occurred during test orchestration: ${e.message}`);
    } finally {
        app.testButton.disabled = false; 
    }
};