// Global namespace for WebRTC logic
const webrtcTest = {};

// WebRTC configuration
const WEBRTC_DURATION_MS = 30000;
const STUN_SERVER = 'stun:stun.l.google.com:19302'; // Public STUN server

// --- E-Model Constants for MOS Calculation (Simplified) ---
const R_NOT = 94; 
const BPL_FACTOR = 2.5; 

/**
 * Calculates a simplified Mean Opinion Score (MOS) using the E-Model (R-factor).
 * @param {number} latencyMs - Average one-way latency in milliseconds.
 * @param {number} jitterMs - Average jitter in milliseconds.
 * @param {number} packetLossPct - Total packet loss percentage (0-100).
 * @returns {number} The calculated MOS score (1.0 to 4.5/5.0).
 */
function calculateMosScore(latencyMs, jitterMs, packetLossPct) {
    if (packetLossPct === undefined || isNaN(packetLossPct)) packetLossPct = 0;
    
    // Id: Impairment due to delay (simplified formula)
    let delayMs = latencyMs + jitterMs; 
    let Id = 0;
    if (delayMs > 100) {
        Id = (delayMs - 100) * 0.1;
    }
    if (delayMs > 200) {
        Id = (delayMs - 200) * 0.2;
    }

    // Il: Impairment due to packet loss (simplified exponential model)
    let Il = 0;
    if (packetLossPct > 0) {
        Il = BPL_FACTOR * packetLossPct + (packetLossPct > 5 ? (packetLossPct - 5) * 5 : 0);
    }
    
    // R: R-Factor 
    let R = R_NOT - Id - Il;
    R = Math.max(0, R);

    // Convert R-Factor to MOS Score (Standard ITU-T P.800 curve approximation)
    let MOS = 0;
    if (R >= 100) {
        MOS = 4.5;
    } else if (R >= 60) {
        MOS = 1 + 0.035 * R + 0.000007 * R * (R - 60) * (100 - R);
    } else {
        MOS = 1.5;
    }
    
    return Math.min(4.5, MOS); 
}

/**
 * Extracts and aggregates statistics from RTCPeerConnection.getStats().
 */
async function collectWebRTCStats(pc) {
    const stats = await pc.getStats();
    let metrics = {
        rtt: [], 
        jitter: [],
        packetsSent: 0,
        packetsLost: 0,
        totalBytesSent: 0
    };

    stats.forEach(report => {
        if (report.type === 'outbound-rtp' && report.mediaType === 'audio') {
            metrics.packetsSent = report.packetsSent || 0;
            metrics.totalBytesSent = report.bytesSent || 0;
        }

        if (report.type === 'remote-inbound-rtp' && report.mediaType === 'audio') {
            if (report.roundTripTime) metrics.rtt.push(report.roundTripTime * 1000); 
            if (report.jitter) metrics.jitter.push(report.jitter * 1000); 
            metrics.packetsLost = report.packetsLost || 0;
        }
    });

    return metrics;
}

/**
 * Main WebRTC Test Function: Runs the VoIP simulation.
 * Exposed in the global webrtcTest namespace.
 */
webrtcTest.runTest = function() {
    return new Promise(async (resolve) => {
        const duration = WEBRTC_DURATION_MS;
        const configuration = { iceServers: [{ urls: STUN_SERVER }] };
        let pc1, pc2; 
        let stream; 
        let statsInterval;
        
        let allLatency = [];
        let allJitter = [];
        let totalPacketsSent = 0;
        let totalPacketsLost = 0;
        let finalMetrics = {};
        let failureReason = null;

        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            
            pc1 = new RTCPeerConnection(configuration);
            pc2 = new RTCPeerConnection(configuration);

            pc1.onicecandidate = e => pc2.addIceCandidate(e.candidate).catch(() => {});
            pc2.onicecandidate = e => pc1.addIceCandidate(e.candidate).catch(() => {});
            
            pc2.ontrack = e => {
                console.log("WebRTC: Remote track received. Connection established.");
            };

            stream.getTracks().forEach(track => {
                pc1.addTrack(track, stream);
            });

            const offer = await pc1.createOffer();
            await pc1.setLocalDescription(offer);
            await pc2.setRemoteDescription(pc1.localDescription);

            const answer = await pc2.createAnswer();
            await pc2.setLocalDescription(answer);
            await pc1.setRemoteDescription(pc2.localDescription);

            console.log("WebRTC: SDP exchange complete. Testing started.");

            statsInterval = setInterval(async () => {
                const stats = await collectWebRTCStats(pc1);
                
                if (stats.rtt.length > 0) allLatency.push(...stats.rtt);
                if (stats.jitter.length > 0) allJitter.push(...stats.jitter);

                if (stats.packetsSent > 0) {
                    totalPacketsSent = stats.packetsSent;
                    totalPacketsLost = stats.packetsLost;
                }
            }, 2000);

            setTimeout(() => {
                clearInterval(statsInterval);
                
                if (allLatency.length === 0 || totalPacketsSent === 0) {
                    failureReason = "No media traffic (packets or stats) received. Check STUN server/network.";
                } else {
                    const avgLatency = allLatency.reduce((a, b) => a + b, 0) / allLatency.length;
                    const avgJitter = allJitter.reduce((a, b) => a + b, 0) / allJitter.length;
                    const packetLossPct = totalPacketsSent > 0 ? (totalPacketsLost / totalPacketsSent) * 100 : 0;
                    
                    const mosScore = calculateMosScore(avgLatency, avgJitter, packetLossPct);

                    finalMetrics = {
                        durationMs: duration,
                        avgLatency: avgLatency,
                        avgJitter: avgJitter,
                        packetLoss: packetLossPct,
                        mosScore: mosScore,
                        error: false
                    };
                }

                stream.getTracks().forEach(track => track.stop());
                pc1.close();
                pc2.close();

                if (failureReason) {
                    resolve({ metrics: { name: "WebRTC VoIP Test", error: true, errorMessage: failureReason } });
                } else {
                    resolve({ metrics: finalMetrics });
                }

            }, duration);

        } catch (e) {
            clearInterval(statsInterval);
            if (pc1) pc1.close();
            if (pc2) pc2.close();
            if (stream) stream.getTracks().forEach(track => track.stop());

            failureReason = `Setup failed (Permission/API): ${e.name || e.message}. Ensure camera/mic access is allowed.`;
            resolve({ metrics: { name: "WebRTC VoIP Test", error: true, errorMessage: failureReason } });
        }
    });
};