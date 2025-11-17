// Global namespace for the application logic
const app = {};

// --- Configuration Constants ---
const LOCAL_VIDEO_DURATION_MS = 45000;
const YOUTUBE_VIDEO_DURATION_MS = 30000;

// ⚠️ List of stable video IDs for fallback ⚠️
const YOUTUBE_VIDEO_IDS = [
    'QH2-TGUlwu4',  // Primary generic video
    'w_f2lJ4_7yQ',  // Fallback 1
    'xcJtL7Qz8HM',  // Fallback 2
    '5i_B3P7tX-M', // YouTube Test Video (Channel: Test Video)
    'aqz-KE-bpDs', // Big Buck Bunny (known public domain sample)
    '2Vv-BfVoq4g'  // High-Quality Global Music Video Example
]; 

// Global storage for metrics, player instance, and video index
let localMetrics = {};
let youtubeMetrics = {};
let player; 
let currentVideoIndex = 0; // Tracks which video ID we are currently attempting to use

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
    // Ensure button is re-enabled if an error occurs
    if (testButton) {
        testButton.disabled = false;
    }
    // Clear summary content
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
    // Hide errors on input change
    errorDisplay.style.display = 'none';
}

function calculateRebufferRatio(totalBufferingMs, totalDurationMs) {
    const ratio = totalBufferingMs / totalDurationMs;
    return `${(ratio * 100).toFixed(4)}%`;
}

// --- Video Test Functions ---

/**
 * 2. Function for Local Video Playback and Measurement
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
        
        const handleError = (e) => {
            localVideo.pause();
            displayError(`Local Video Error (${e.type}): Could not load "bigbunny1.mp4". Check file path and format.`);
            resolve({ error: true });
        };

        localVideo.addEventListener('loadstart', handleLoadStart);
        localVideo.addEventListener('playing', handlePlaying);
        localVideo.addEventListener('waiting', handleWaiting);
        localVideo.addEventListener('error', handleError);

        return { handleLoadStart, handlePlaying, handleWaiting, handleError };
    }

    localVideo.src = localVideo.getElementsByTagName('source')[0].src;
    localVideo.load();

    return new Promise(async (resolve) => {
        const eventListeners = setupListeners(resolve);

        try {
            await localVideo.play();
        } catch (e) {
            displayError(`Local Video Playback Failed: ${e.message}`);
            return resolve({ error: true });
        }

        setTimeout(() => {
            // Only proceed if no error was triggered
            if (!eventListeners.errorCalled) {
                localVideo.pause();
                localVideo.currentTime = 0; 

                // Cleanup Listeners
                localVideo.removeEventListener('loadstart', eventListeners.handleLoadStart);
                localVideo.removeEventListener('playing', eventListeners.handlePlaying);
                localVideo.removeEventListener('waiting', eventListeners.handleWaiting);
                localVideo.removeEventListener('error', eventListeners.handleError);

                localMetrics.totalStalls = localBufferingCount;
                localMetrics.totalBufferingMs = localTotalBufferingMs;
            }
            resolve({ error: false });
        }, LOCAL_VIDEO_DURATION_MS);
    });
}

/**
 * 3. Function for YouTube Video Playback and Measurement (With Fallback)
 */
function runYoutubeVideoTest() {
    let youtubeStartTime = 0;
    let youtubeBufferingCount = 0;
    let youtubeBufferingStartTime = 0;
    let youtubeTotalBufferingMs = 0; 
    
    currentVideoIndex = 0; // Reset index for the start of the entire test function

    const startTestAttempt = (resolve, reject) => {
        
        if (currentVideoIndex >= YOUTUBE_VIDEO_IDS.length) {
            displayError("YouTube Test Failed: All defined video IDs are unavailable.");
            return reject({ error: true });
        }
        
        const currentVideoID = YOUTUBE_VIDEO_IDS[currentVideoIndex];
        
        youtubeMetrics = {
            name: "YouTube Video",
            initialLatency: "N/A",
            totalStalls: 0,
            duration: `${YOUTUBE_VIDEO_DURATION_MS / 1000}s`,
            totalBufferingMs: 0
        };
        youtubeStartTime = performance.now();

        const interval = setInterval(() => {
            if (player && player.getPlayerState() !== -1) { 
                clearInterval(interval);
                
                player.loadVideoById(currentVideoID); 
                player.mute(); 
                player.playVideo(); 

                const handleStateChange = (event) => {
                    // State -2: YouTube API Error (Invalid video ID, unplayable)
                    if (event.data === -2) {
                        player.stopVideo();
                        player.removeEventListener('onStateChange', handleStateChange);
                        console.warn(`YouTube Video ID ${currentVideoID} failed. Attempting next video.`);
                        
                        // Increment index and retry the test immediately
                        currentVideoIndex++;
                        return startTestAttempt(resolve, reject); 
                    }
                    
                    // State 1: Playing
                    if (event.data === YT.PlayerState.PLAYING) {
                        if (youtubeMetrics.initialLatency === "N/A") {
                            youtubeMetrics.initialLatency = `${(performance.now() - youtubeStartTime).toFixed(2)} ms`;
                        }
                        if (youtubeBufferingStartTime > 0) {
                            youtubeTotalBufferingMs += performance.now() - youtubeBufferingStartTime;
                            youtubeBufferingStartTime = 0;
                        }
                    // State 3: Buffering
                    } else if (event.data === YT.PlayerState.BUFFERING) {
                        youtubeBufferingCount++;
                        if (youtubeBufferingStartTime === 0) {
                            youtubeBufferingStartTime = performance.now();
                        }
                    }
                };

                player.addEventListener('onStateChange', handleStateChange);

                setTimeout(() => {
                    player.stopVideo();
                    player.removeEventListener('onStateChange', handleStateChange);

                    youtubeMetrics.totalStalls = youtubeBufferingCount;
                    youtubeMetrics.totalBufferingMs = youtubeTotalBufferingMs;
                    
                    // The test was successful with the current video
                    resolve({ error: false }); 
                }, YOUTUBE_VIDEO_DURATION_MS);
            }
        }, 500);
    };

    // Return a promise that wraps the retry logic
    return new Promise(startTestAttempt);
}

// --- Display Function (unchanged) ---

function displaySummary() {
    if (localMetrics.error || youtubeMetrics.error) return; 

    const localRebufferRatio = calculateRebufferRatio(localMetrics.totalBufferingMs, LOCAL_VIDEO_DURATION_MS);
    const youtubeRebufferRatio = calculateRebufferRatio(youtubeMetrics.totalBufferingMs, YOUTUBE_VIDEO_DURATION_MS);

    const allMetrics = [
        { 
            ...localMetrics, 
            rebufferRatio: localRebufferRatio,
            totalBufferingTimeDisplay: `${(localMetrics.totalBufferingMs / 1000).toFixed(2)}s`
        }, 
        { 
            ...youtubeMetrics, 
            rebufferRatio: youtubeRebufferRatio,
            totalBufferingTimeDisplay: `${(youtubeMetrics.totalBufferingMs / 1000).toFixed(2)}s`
        }
    ];
    
    let html = '<h2>Test Complete!</h2>';
    
    allMetrics.forEach(metrics => {
        html += `
            <h3>${metrics.name} Metrics</h3>
            <ul class="metric-list">
                <li>**Test Duration:** ${metrics.duration}</li>
                <li>**Initial Latency:** ${metrics.initialLatency}</li>
                <li class="buffering-time" style="font-weight: bold;">
                    🛑 **Total Buffering Time:** ${metrics.totalBufferingTimeDisplay}
                </li>
                <li class="rebuffer-ratio" style="font-weight: bold;">
                    ⚠️ **Rebuffer Ratio:** ${metrics.rebufferRatio}
                </li>
                <li>**Number of Stalls (#):** ${metrics.totalStalls}</li>
            </ul>
        `;
    });

    resultsContent.innerHTML = html;
}

/**
 * 1. Main Video Test Function 
 */
app.runVideoTests = async function() {
    errorDisplay.style.display = 'none';
    resultsContent.innerHTML = '<p style="color: #1a73e8; font-weight: 500;">Running tests... Please wait.</p>';
    testButton.disabled = true; 
    
    try {
        console.log("Starting Local Video Test...");
        const localResult = await runLocalVideoTest();
        if (localResult.error) {
            return;
        }
        
        await new Promise(r => setTimeout(r, 1000)); 
        
        console.log("Starting YouTube Video Test...");
        // The YouTube function handles its own retries/errors internally
        const youtubeResult = await runYoutubeVideoTest(); 
        if (youtubeResult.error) {
            return;
        }

        displaySummary();
    } catch (e) {
        displayError(`An unexpected error occurred during testing: ${e.message}`);
    } finally {
        testButton.disabled = false; 
    }
};

// --- Initialization ---

function injectYoutubeAPI() {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

function initialize() {
    emailInput = document.getElementById('emailInput');
    testButton = document.getElementById('testButton');
    localVideo = document.getElementById('localVideo');
    resultsContent = document.getElementById('resultsContent');
    errorDisplay = document.getElementById('errorDisplay'); // Get the new error element
    
    emailInput.addEventListener('input', handleEmailInput);
    
    injectYoutubeAPI();
}

// Global window error handler (last resort)
window.onerror = function(message, source, lineno, colno, error) {
    if (message.includes('Script error.')) {
        displayError("A script failed to load. Check your internet connection or console.");
    } else {
        displayError(`Fatal Error: ${message} (Line: ${lineno})`);
    }
    return true;
};

document.addEventListener('DOMContentLoaded', initialize);

// Global function called by the YouTube API script when ready (MUST be global)
window.onYouTubeIframeAPIReady = function() {
    // Initialize the player with the first video ID from the fallback list
    player = new YT.Player('youtubePlayer', {
        height: '100%',
        width: '100%',
        videoId: YOUTUBE_VIDEO_IDS[0], 
        playerVars: {
            'playsinline': 1,
            'autoplay': 0,
            'controls': 1
        }
    });
};
