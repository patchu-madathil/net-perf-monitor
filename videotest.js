// Global namespace for the application logic
const app = {};

// --- Configuration Constants ---
const LOCAL_VIDEO_DURATION_MS = 45000;
const YOUTUBE_VIDEO_DURATION_MS = 30000;

// ⚠️ GUARANTEE: The single, most reliable video ID. 
// This should be a globally stable public domain video (e.g., Big Buck Bunny).
const ABSOLUTE_GUARANTEE_ID = 'aqz-KE-bpDs'; 

// Global storage for metrics, player instance, and discovered ID
let localMetrics = {};
let youtubeMetrics = {};
let player; 
let dynamicVideoId = null; // Will now store the guaranteed ID

// --- DOM Elements (Accessed after the DOM is loaded) ---
let emailInput, testButton, localVideo, resultsContent, errorDisplay;

// --- Error Handling Function (unchanged) ---
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

// --- Helper Functions (unchanged) ---
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
 * ⚠️ NEW: Simplified ID retrieval. Always returns the guaranteed ID.
 */
async function getDynamicVideoId() {
    // We trust the stability of this ID to be 100%.
    console.log(`Using ABSOLUTE GUARANTEE ID: ${ABSOLUTE_GUARANTEE_ID}`);
    return ABSOLUTE_GUARANTEE_ID; 
}


// --- Video Test Functions ---

/**
 * 2. Function for Local Video Playback and Measurement (unchanged)
 */
function runLocalVideoTest() {
    // ... (local video logic remains unchanged) ...
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
            if (!eventListeners.errorCalled) {
                localVideo.pause();
                localVideo.currentTime = 0; 

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
 * 3. Function for YouTube Video Playback and Measurement (100% Guaranteed Playback)
 */
function runYoutubeVideoTest() {
    return new Promise((resolve) => {
        let youtubeStartTime = 0;
        let youtubeBufferingCount = 0;
        let youtubeBufferingStartTime = 0;
        let youtubeTotalBufferingMs = 0; 
        
        const currentVideoID = dynamicVideoId; // This is the ABSOLUTE_GUARANTEE_ID
        let attempts = 0; // Track attempts to prevent infinite loops

        const startAttempt = () => {
            attempts++;
            console.log(`Youtubeback Attempt #${attempts} using ID: ${currentVideoID}`);
            
            youtubeMetrics = {
                name: "YouTube Video",
                initialLatency: "N/A",
                totalStalls: 0,
                duration: `${YOUTUBE_VIDEO_DURATION_MS / 1000}s`,
                totalBufferingMs: 0
            };
            youtubeStartTime = performance.now();

            const handleStateChange = (event) => {
                // ⚠️ FINAL RESILIENCE: Error Code -2 (Video Unavailable) ⚠️
                if (event.data === -2) {
                    player.stopVideo();
                    player.removeEventListener('onStateChange', handleStateChange);
                    
                    if (attempts < 3) { // Retry up to 3 times
                        console.error(`ID ${currentVideoID} failed (Error -2). Retrying in 1 second...`);
                        setTimeout(startAttempt, 1000);
                        return;
                    } else {
                        // All guaranteed attempts failed (Severe environment block)
                        displayError(`YouTube Load Error: Failed to play guaranteed ID (${currentVideoID}) after ${attempts} attempts. Cannot proceed.`);
                        return resolve({ error: true }); 
                    }
                }
                
                // Normal metric collection logic
                if (event.data === YT.PlayerState.PLAYING) {
                    // Check if this is the first success for this run
                    if (youtubeMetrics.initialLatency === "N/A") {
                        youtubeMetrics.initialLatency = `${(performance.now() - youtubeStartTime).toFixed(2)} ms`;
                    }
                    if (youtubeBufferingStartTime > 0) {
                        youtubeTotalBufferingMs += performance.now() - youtubeBufferingStartTime;
                        youtubeBufferingStartTime = 0;
                    }
                } else if (event.data === YT.PlayerState.BUFFERING) {
                    youtubeBufferingCount++;
                    if (youtubeBufferingStartTime === 0) {
                        youtubeBufferingStartTime = performance.now();
                    }
                }
            };
            
            player.addEventListener('onStateChange', handleStateChange);
            player.loadVideoById(currentVideoID); 
            player.mute(); 
            player.playVideo(); 

            // Set timeout for the duration of the successful test
            setTimeout(() => {
                player.stopVideo();
                player.removeEventListener('onStateChange', handleStateChange);

                youtubeMetrics.totalStalls = youtubeBufferingCount;
                youtubeMetrics.totalBufferingMs = youtubeTotalBufferingMs;
                
                resolve({ error: false }); 
            }, YOUTUBE_VIDEO_DURATION_MS);
        };

        // Start the first attempt
        const interval = setInterval(() => {
            if (player && player.getPlayerState() !== -1) { 
                clearInterval(interval);
                startAttempt();
            }
        }, 500);
    });
}

// --- Display Function (updated with simple ID display) ---

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
    
    // Display the guaranteed ID that was used
    let html = `<h2>Test Complete! (Video ID Used: ${dynamicVideoId})</h2>`; 
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
        // Step 1: Get the guaranteed ID
        const videoId = await getDynamicVideoId();
        dynamicVideoId = videoId; 
        
        console.log("Starting Local Video Test...");
        const localResult = await runLocalVideoTest();
        if (localResult.error) {
            return;
        }
        
        await new Promise(r => setTimeout(r, 1000)); 
        
        // Step 2: Run YouTube Test (This function now handles its own retries/guarantee)
        console.log("Starting YouTube Video Test...");
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

// --- Initialization (unchanged) ---

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
    errorDisplay = document.getElementById('errorDisplay');
    
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

// FINAL FIX (Origin and API enable remain)
window.onYouTubeIframeAPIReady = async function() {
    const githubPagesOrigin = 'https://patchu-madathil.github.io'; 

    player = new YT.Player('youtubePlayer', {
        height: '100%',
        width: '100%',
        videoId: '', 
        playerVars: {
            'playsinline': 1,
            'autoplay': 0,
            'controls': 1,
            'enablejsapi': 1, 
            'origin': githubPagesOrigin 
        }
    });
};
