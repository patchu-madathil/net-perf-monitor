// Global namespace for all video playback functions and metrics storage
const videoTest = {}; 

// --- Configuration Constants ---
const LOCAL_VIDEO_DURATION_MS = 45000;
const YOUTUBE_VIDEO_DURATION_MS = 30000;
const ABSOLUTE_GUARANTEE_ID = 'aqz-KE-bpDs'; 

// --- Helper Functions ---

function calculateRebufferRatio(totalBufferingMs, totalDurationMs) {
    const ratio = totalBufferingMs / totalDurationMs;
    return `${(ratio * 100).toFixed(4)}%`;
}

videoTest.getGuaranteedVideoId = async function() {
    return ABSOLUTE_GUARANTEE_ID; 
};


// --- Video Test Functions ---

/**
 * Runs Local Video Playback and Measurement.
 * @param {HTMLElement} videoElement - The video element passed from the orchestrator.
 * @returns {Promise<object>} Returns the collected metrics object.
 */
videoTest.runLocalVideoTest = function(videoElement) {
    let localStartTime = 0;
    let localBufferingCount = 0;
    let localBufferingStartTime = 0;
    let localTotalBufferingMs = 0; 
    
    // Reset metrics for this specific test
    let metrics = {
        name: "Local Video",
        initialLatency: "N/A",
        totalStalls: 0,
        duration: `${LOCAL_VIDEO_DURATION_MS / 1000}s`,
        totalBufferingMs: 0,
        error: false,
        errorMessage: ''
    };

    function setupListeners(resolve) {
        const handleLoadStart = () => { localStartTime = performance.now(); };
        const handlePlaying = () => {
            if (metrics.initialLatency === "N/A") {
                metrics.initialLatency = `${(performance.now() - localStartTime).toFixed(2)} ms`;
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
            videoElement.pause();
            metrics.errorMessage = `Error loading file: Check "bigbunny1.mp4" path/format.`;
            metrics.error = true;
            resolve({ metrics: metrics });
        };

        videoElement.addEventListener('loadstart', handleLoadStart);
        videoElement.addEventListener('playing', handlePlaying);
        videoElement.addEventListener('waiting', handleWaiting);
        videoElement.addEventListener('error', handleError);

        return { handleLoadStart, handlePlaying, handleWaiting, handleError };
    }

    videoElement.src = videoElement.getElementsByTagName('source')[0].src;
    videoElement.load();

    return new Promise(async (resolve) => {
        const eventListeners = setupListeners(resolve);

        try {
            await videoElement.play();
        } catch (e) {
            metrics.errorMessage = `Playback failed (Autoplay policy or permission denied).`;
            metrics.error = true;
            return resolve({ metrics: metrics });
        }

        setTimeout(() => {
            if (!metrics.error) {
                videoElement.pause();
                videoElement.currentTime = 0; 

                // Cleanup Listeners
                videoElement.removeEventListener('loadstart', eventListeners.handleLoadStart);
                videoElement.removeEventListener('playing', eventListeners.handlePlaying);
                videoElement.removeEventListener('waiting', eventListeners.handleWaiting);
                videoElement.removeEventListener('error', eventListeners.handleError);

                metrics.totalStalls = localBufferingCount;
                metrics.totalBufferingMs = localTotalBufferingMs;
            }
            resolve({ metrics: metrics });
        }, LOCAL_VIDEO_DURATION_MS);
    });
};

/**
 * Runs YouTube Video Playback and Measurement.
 * @param {string} videoId - The video ID to test.
 * @returns {Promise<object>} Returns the collected metrics object.
 */
videoTest.runYoutubeVideoTest = function(videoId) {
    // Access the YouTube player instance via the global window object
    let player = window.youtubePlayerInstance; 
    
    // Fallback if the player instance hasn't been set yet
    if (!player) {
         return Promise.resolve({ metrics: { name: "YouTube Video", error: true, errorMessage: "YouTube Player API not ready." } });
    }

    return new Promise((resolve) => {
        let youtubeStartTime = 0;
        let youtubeBufferingCount = 0;
        let youtubeBufferingStartTime = 0;
        let youtubeTotalBufferingMs = 0; 
        
        const currentVideoID = videoId; 
        let attempts = 0; 

        let metrics = {
            name: "YouTube Video",
            initialLatency: "N/A",
            totalStalls: 0,
            duration: `${YOUTUBE_VIDEO_DURATION_MS / 1000}s`,
            totalBufferingMs: 0,
            error: false
        };

        const startAttempt = () => {
            attempts++;
            
            youtubeStartTime = performance.now();

            const handleStateChange = (event) => {
                // Video Unavailable Error Check
                if (event.data === -2) {
                    player.stopVideo();
                    player.removeEventListener('onStateChange', handleStateChange);
                    
                    if (attempts < 3) { 
                        setTimeout(startAttempt, 1000);
                        return;
                    } else {
                        metrics.errorMessage = `Failed to play video ID ${currentVideoID} after ${attempts} attempts (Unavailable/Restricted).`;
                        metrics.error = true;
                        return resolve({ metrics: metrics }); 
                    }
                }
                
                // Normal metric collection logic
                if (event.data === YT.PlayerState.PLAYING) {
                    if (metrics.initialLatency === "N/A") {
                        metrics.initialLatency = `${(performance.now() - youtubeStartTime).toFixed(2)} ms`;
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
                if (!metrics.error) {
                    player.stopVideo();
                    player.removeEventListener('onStateChange', handleStateChange);

                    metrics.totalStalls = youtubeBufferingCount;
                    metrics.totalBufferingMs = youtubeTotalBufferingMs;
                }
                resolve({ metrics: metrics }); 
            }, YOUTUBE_VIDEO_DURATION_MS);
        };

        // Start the first attempt after player is ready
        const interval = setInterval(() => {
            // Check player ready state
            if (player.getPlayerState() !== -1) { 
                clearInterval(interval);
                startAttempt();
            }
        }, 500);
    });
};

// --- YouTube API Setup ---

videoTest.injectYoutubeAPI = function() {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
};

// Global callback function (Sets the player instance on the window object)
window.onYouTubeIframeAPIReady = function() {
    const githubPagesOrigin = 'https://patchu-madathil.github.io'; 

    window.youtubePlayerInstance = new YT.Player('youtubePlayer', { // Set global instance here
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