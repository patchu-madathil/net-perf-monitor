// Global namespace for the application logic
const app = {};

// --- Configuration Constants ---
const LOCAL_VIDEO_DURATION_MS = 45000;
const YOUTUBE_VIDEO_DURATION_MS = 30000;

// GUARANTEE: The single, most reliable video ID. 
const ABSOLUTE_GUARANTEE_ID = 'aqz-KE-bpDs'; 

// Global storage for metrics, player instance, and discovered ID
let localMetrics = { name: "Local Video", error: true }; // Initialize with error: true
let youtubeMetrics = { name: "YouTube Video", error: true }; // Initialize with error: true
let player; 
let dynamicVideoId = null;

// --- DOM Elements (Accessed after the DOM is loaded) ---
let emailInput, testButton, localVideo, resultsContent, errorDisplay;

// --- Error Handling Function ---
function displayError(message) {
    if (errorDisplay) {
        errorDisplay.innerHTML = `🚨 Critical Application Error: ${message}`;
        errorDisplay.style.display = 'block';
    } else {
        console.error(`Application Error: ${message}`);
    }
    if (testButton) {
        testButton.disabled = false;
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
 * Simplified ID retrieval. Always returns the guaranteed ID.
 */
async function getDynamicVideoId() {
    return ABSOLUTE_GUARANTEE_ID; 
}


// --- Video Test Functions ---

/**
 * 2. Function for Local Video Playback and Measurement 
 * Returns { error: true/false }
 */
function runLocalVideoTest() {
    let localStartTime = 0;
    let localBufferingCount = 0;
    let localBufferingStartTime = 0;
    let localTotalBufferingMs = 0; 
    
    // Reset metrics for this specific test
    localMetrics = {
        name: "Local Video",
        initialLatency: "N/A",
        totalStalls: 0,
        duration: `${LOCAL_VIDEO_DURATION_MS / 1000}s`,
        totalBufferingMs: 0,
        error: false // Assume success initially
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
            localMetrics.errorMessage = `Error loading file: Check "bigbunny1.mp4" path/format.`;
            localMetrics.error = true;
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
            localMetrics.errorMessage = `Playback failed (Autoplay policy or permission denied).`;
            localMetrics.error = true;
            return resolve({ error: true });
        }

        setTimeout(() => {
            if (!localMetrics.error) {
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
            resolve({ error: localMetrics.error });
        }, LOCAL_VIDEO_DURATION_MS);
    });
}

/**
 * 3. Function for YouTube Video Playback and Measurement 
 * Returns { error: true/false }
 */
function runYoutubeVideoTest() {
    return new Promise((resolve) => {
        let youtubeStartTime = 0;
        let youtubeBufferingCount = 0;
        let youtubeBufferingStartTime = 0;
        let youtubeTotalBufferingMs = 0; 
        
        const currentVideoID = dynamicVideoId; 
        let attempts = 0; 

        // Reset metrics for this specific test
        youtubeMetrics = {
            name: "YouTube Video",
            initialLatency: "N/A",
            totalStalls: 0,
            duration: `${YOUTUBE_VIDEO_DURATION_MS / 1000}s`,
            totalBufferingMs: 0,
            error: false
        };

        const startAttempt = () => {
            attempts++;
            console.log(`Youtubeback Attempt #${attempts} using ID: ${currentVideoID}`);
            
            youtubeStartTime = performance.now();

            const handleStateChange = (event) => {
                // Video Unavailable Error Check
                if (event.data === -2) {
                    player.stopVideo();
                    player.removeEventListener('onStateChange', handleStateChange);
                    
                    if (attempts < 3) { 
                        console.error(`ID ${currentVideoID} failed (Error -2). Retrying in 1 second...`);
                        setTimeout(startAttempt, 1000);
                        return;
                    } else {
                        // Mark test as failed
                        youtubeMetrics.errorMessage = `Failed to play video ID ${currentVideoID} after ${attempts} attempts (Unavailable/Restricted).`;
                        youtubeMetrics.error = true;
                        return resolve({ error: true }); 
                    }
                }
                
                // Normal metric collection logic
                if (event.data === YT.PlayerState.PLAYING) {
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

            setTimeout(() => {
                if (!youtubeMetrics.error) {
                    player.stopVideo();
                    player.removeEventListener('onStateChange', handleStateChange);

                    youtubeMetrics.totalStalls = youtubeBufferingCount;
                    youtubeMetrics.totalBufferingMs = youtubeTotalBufferingMs;
                }
                resolve({ error: youtubeMetrics.error }); 
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

// --- Display Function (Updated to handle errors) ---

function displaySummary() {
    // We display the summary regardless of test failures now
    const allMetrics = [localMetrics, youtubeMetrics];
    let testSuccessCount = 0;
    
    let html = '';
    
    allMetrics.forEach(metrics => {
        
        html += `<h3>${metrics.name} Metrics</h3>`;
        
        if (metrics.error) {
            // ⚠️ DISPLAY FAILURE MESSAGE ⚠️
            html += `
                <ul class="metric-list">
                    <li style="background-color: #fdd; border-left: 4px solid red; font-weight: bold;">
                        ❌ TEST FAILED: ${metrics.errorMessage || 'Unknown Error'}
                    </li>
                    <li>Duration: ${metrics.duration || 'N/A'}</li>
                </ul>
            `;
        } else {
            // ⚠️ DISPLAY SUCCESSFUL METRICS ⚠️
            testSuccessCount++;
            const totalBufferingTimeDisplay = `${(metrics.totalBufferingMs / 1000).toFixed(2)}s`;
            const rebufferRatio = calculateRebufferRatio(metrics.totalBufferingMs, metrics === localMetrics ? LOCAL_VIDEO_DURATION_MS : YOUTUBE_VIDEO_DURATION_MS);
            
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

    // Final heading adjustment based on results
    if (testSuccessCount === 0) {
        html = `<h2>Test Failed Completely!</h2>${html}`;
    } else {
        html = `<h2>Test Complete! (${testSuccessCount} of ${allMetrics.length} successful)</h2>` + html;
    }


    resultsContent.innerHTML = html;
}

/**
 * 1. Main Video Test Function (Updated to run tests independently)
 */
app.runVideoTests = async function() {
    errorDisplay.style.display = 'none';
    resultsContent.innerHTML = '<p style="color: #1a73e8; font-weight: 500;">Running tests... Please wait.</p>';
    testButton.disabled = true; 
    
    try {
        const videoId = await getDynamicVideoId();
        dynamicVideoId = videoId; 
        
        // --- Independent Local Test ---
        console.log("Starting Local Video Test...");
        // Capture the result (which updates localMetrics internally)
        await runLocalVideoTest(); 
        
        await new Promise(r => setTimeout(r, 1000)); 
        
        // --- Independent YouTube Test ---
        console.log("Starting YouTube Video Test...");
        // Capture the result (which updates youtubeMetrics internally)
        await runYoutubeVideoTest(); 

        // ⚠️ Core change: Display summary regardless of individual test results ⚠️
        displaySummary();
        
    } catch (e) {
        displayError(`An unexpected error occurred during test orchestration: ${e.message}`);
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

// FINAL FIX (unchanged)
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
