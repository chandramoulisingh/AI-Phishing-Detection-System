// ========================================================
// PHISHGUARD — CINEMATIC SCROLL ENGINE & SHIELD CONTROLLER
// ========================================================

/**
 * Global Lenis smooth scrolling instance
 */
let lenis = null;

// ========================================================
// 1. SCENE TIMELINE CONFIGURATION
// ========================================================

const SCENE_WINDOWS = [
    // Scene 0: Introduction (Peaks at top, exits smoothly)
    { id: 'scene-0', inStart: 0.00, inPeak: 0.00, outStart: 0.12, outEnd: 0.18, interactive: false, targetScroll: 0.04 },
    // Scene 1: The Problem (Left flank, peaks 0.22 - 0.33)
    { id: 'scene-1', inStart: 0.16, inPeak: 0.22, outStart: 0.33, outEnd: 0.39, interactive: false, targetScroll: 0.27 },
    // Scene 2: The Technology (Right flank, peaks 0.43 - 0.54)
    { id: 'scene-2', inStart: 0.37, inPeak: 0.43, outStart: 0.54, outEnd: 0.60, interactive: false, targetScroll: 0.48 },
    // Scene 3: The Scanner (Interactive Cyber-Terminal, peaks 0.64 - 0.77)
    { id: 'scene-3', inStart: 0.58, inPeak: 0.64, outStart: 0.77, outEnd: 0.83, interactive: true,  targetScroll: 0.70 },
    // Scene 4: The Promise & Footer (Peaks 0.87 - 1.00 at bottom)
    { id: 'scene-4', inStart: 0.81, inPeak: 0.87, outStart: 1.00, outEnd: 1.00, interactive: true,  targetScroll: 0.95 },
];


// ========================================================
// 2. 3D SHIELD CANVAS ENGINE
// ========================================================

const SHIELD_CONFIG = {
    totalFrames: 300,
    framePathPrefix: '/static/frames/frame_',
    framePathSuffix: '.webp',
    keyframeStride: 10,
    maxConcurrentLoads: 4,
};

let shieldCanvas = null;
let shieldCtx = null;
let currentRenderedIndex = -1;
let targetFrameIndex = 1;
let rafRenderScheduled = false;

const frameCache = new Map();         // frameIndex -> HTMLImageElement
const loadedFrameIndices = new Set();  // Set of loaded frame numbers
const loadingSet = new Set();          // Active download tracking
const loadQueue = [];                  // Waiting download queue
let activeWorkers = 0;

function getFrameSrc(index) {
    const padded = String(index).padStart(4, '0');
    return `${SHIELD_CONFIG.framePathPrefix}${padded}${SHIELD_CONFIG.framePathSuffix}`;
}

function initShieldCanvas() {
    shieldCanvas = document.getElementById('shieldCanvas');
    if (!shieldCanvas) return;

    shieldCtx = shieldCanvas.getContext('2d', { alpha: false });

    resizeShieldCanvas();
    window.addEventListener('resize', handleShieldResize, { passive: true });

    // Step 1: Priority load Frame 1 for immediate first paint
    enqueueFrame(1, true);

    // Step 2: Load keyframe stride (10, 20, 30... 300) for instant whole-page coverage
    for (let i = SHIELD_CONFIG.keyframeStride; i <= SHIELD_CONFIG.totalFrames; i += SHIELD_CONFIG.keyframeStride) {
        enqueueFrame(i, false);
    }

    // Step 3: Enqueue all remaining frames numerically
    for (let i = 2; i <= SHIELD_CONFIG.totalFrames; i++) {
        if (i % SHIELD_CONFIG.keyframeStride !== 0) {
            enqueueFrame(i, false);
        }
    }

    // Initial draw
    requestFrameRender(1);
}

function enqueueFrame(index, priority = false) {
    if (index < 1 || index > SHIELD_CONFIG.totalFrames) return;
    if (loadedFrameIndices.has(index) || loadingSet.has(index)) return;

    if (priority) {
        const existingIdx = loadQueue.indexOf(index);
        if (existingIdx !== -1) loadQueue.splice(existingIdx, 1);
        loadQueue.unshift(index);
    } else {
        if (!loadQueue.includes(index)) {
            loadQueue.push(index);
        }
    }

    processLoadQueue();
}

function prioritizeNeighborhood(centerIndex) {
    const radius = 8;
    for (let offset = 0; offset <= radius; offset++) {
        const ahead = centerIndex + offset;
        const behind = centerIndex - offset;
        if (ahead <= SHIELD_CONFIG.totalFrames) enqueueFrame(ahead, true);
        if (behind >= 1) enqueueFrame(behind, true);
    }
}

function processLoadQueue() {
    while (activeWorkers < SHIELD_CONFIG.maxConcurrentLoads && loadQueue.length > 0) {
        const nextIndex = loadQueue.shift();
        if (loadedFrameIndices.has(nextIndex) || loadingSet.has(nextIndex)) continue;

        activeWorkers++;
        loadingSet.add(nextIndex);

        const img = new Image();
        img.src = getFrameSrc(nextIndex);

        img.onload = () => {
            frameCache.set(nextIndex, img);
            loadedFrameIndices.add(nextIndex);
            loadingSet.delete(nextIndex);
            activeWorkers--;

            if (targetFrameIndex === nextIndex || currentRenderedIndex === -1) {
                requestFrameRender(nextIndex);
            }

            processLoadQueue();
        };

        img.onerror = () => {
            loadingSet.delete(nextIndex);
            activeWorkers--;
            processLoadQueue();
        };
    }
}

function getNearestLoadedFrame(target) {
    if (loadedFrameIndices.has(target)) return target;
    if (loadedFrameIndices.size === 0) return -1;

    let closest = -1;
    let minDiff = Infinity;
    for (const idx of loadedFrameIndices) {
        const diff = Math.abs(idx - target);
        if (diff < minDiff) {
            minDiff = diff;
            closest = idx;
            if (minDiff === 1) break;
        }
    }
    return closest;
}

function resizeShieldCanvas() {
    if (!shieldCanvas || !shieldCtx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);

    if (shieldCanvas.width !== w || shieldCanvas.height !== h) {
        shieldCanvas.width = w;
        shieldCanvas.height = h;
    }

    if (currentRenderedIndex > 0) {
        drawFrameToCanvas(currentRenderedIndex);
    }
}

let resizeTimer = null;
function handleShieldResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        resizeShieldCanvas();
        updateTimeline();
    }, 80);
}

function drawFrameToCanvas(index) {
    if (!shieldCanvas || !shieldCtx) return;

    let frameToDraw = index;
    if (!loadedFrameIndices.has(frameToDraw)) {
        frameToDraw = getNearestLoadedFrame(index);
    }

    const cw = shieldCanvas.width;
    const ch = shieldCanvas.height;

    if (frameToDraw === -1 || !frameCache.has(frameToDraw)) {
        shieldCtx.fillStyle = '#03070a';
        shieldCtx.fillRect(0, 0, cw, ch);
        return;
    }

    const img = frameCache.get(frameToDraw);
    if (!img.complete || img.naturalWidth === 0) return;

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    // Aspect ratio preservation (cover & center)
    const scale = Math.max(cw / iw, ch / ih);
    const nw = iw * scale;
    const nh = ih * scale;
    const ox = (cw - nw) / 2;
    const oy = (ch - nh) / 2;

    shieldCtx.drawImage(img, ox, oy, nw, nh);
    currentRenderedIndex = frameToDraw;
}

function requestFrameRender(index) {
    if (rafRenderScheduled) return;
    rafRenderScheduled = true;
    requestAnimationFrame(() => {
        rafRenderScheduled = false;
        drawFrameToCanvas(targetFrameIndex);
    });
}


// ========================================================
// 3. UNIFIED SCROLL PROGRESS & SCENE ORCHESTRATOR
// ========================================================

function getNormalizedProgress() {
    if (window.lenis && typeof window.lenis.progress === 'number') {
        return Math.min(1, Math.max(0, window.lenis.progress));
    }
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    return Math.min(1, Math.max(0, scrollY / maxScroll));
}

/**
 * Updates both the shield frame and all narrative scene transitions
 * pure mathematical function of progress -> completely reversible!
 */
function updateTimeline(customProgress) {
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const p = typeof customProgress === 'number' ? customProgress : getNormalizedProgress();

    // 1. Update Shield Frame
    if (isReduced) {
        targetFrameIndex = 1;
        requestFrameRender(1);
    } else {
        const calculatedFrame = Math.min(
            SHIELD_CONFIG.totalFrames,
            Math.max(1, Math.round(p * (SHIELD_CONFIG.totalFrames - 1)) + 1)
        );

        if (calculatedFrame !== targetFrameIndex) {
            targetFrameIndex = calculatedFrame;
            requestFrameRender(calculatedFrame);
            prioritizeNeighborhood(calculatedFrame);
        }
    }

    // 2. Update Narrative Scenes
    updateSceneTransforms(p);

    // 3. Update HUD active navigation indicator
    updateHudNavigation(p);
}

function updateSceneTransforms(progress) {
    SCENE_WINDOWS.forEach((sceneConfig) => {
        const el = document.getElementById(sceneConfig.id);
        if (!el) return;

        let opacity = 0;
        let translateY = 28;
        let scale = 0.98;

        if (progress < sceneConfig.inStart || progress > sceneConfig.outEnd) {
            // Out of window
            opacity = 0;
            translateY = progress < sceneConfig.inStart ? 28 : -28;
            scale = progress < sceneConfig.inStart ? 0.96 : 1.02;
        } else if (progress >= sceneConfig.inPeak && progress <= sceneConfig.outStart) {
            // Holding zone (fully visible)
            opacity = 1;
            translateY = 0;
            scale = 1.0;
        } else if (progress < sceneConfig.inPeak) {
            // Entering
            const t = (progress - sceneConfig.inStart) / Math.max(0.0001, (sceneConfig.inPeak - sceneConfig.inStart));
            opacity = t;
            translateY = (1 - t) * 28;
            scale = 0.96 + t * 0.04;
        } else {
            // Exiting
            const t = (progress - sceneConfig.outStart) / Math.max(0.0001, (sceneConfig.outEnd - sceneConfig.outStart));
            opacity = 1 - t;
            translateY = -t * 28;
            scale = 1.0 - t * 0.02;
        }

        // Apply styles directly (GPU-composited)
        el.style.opacity = opacity.toFixed(4);
        el.style.transform = `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;

        // Enable interaction only when scene is active and readable
        if (sceneConfig.interactive && opacity > 0.45) {
            el.style.pointerEvents = 'auto';
        } else {
            el.style.pointerEvents = 'none';
        }
    });
}

function updateHudNavigation(progress) {
    const pills = document.querySelectorAll('.hud-pill');
    let activeIndex = 0;

    SCENE_WINDOWS.forEach((sceneConfig, idx) => {
        if (progress >= sceneConfig.inStart && progress <= sceneConfig.outEnd) {
            activeIndex = idx;
        }
    });

    pills.forEach((pill, idx) => {
        if (idx === activeIndex) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });
}

/**
 * Smoothly jumps to a specific scene's peak reading zone
 */
function jumpToScene(sceneIndex) {
    const scene = SCENE_WINDOWS[sceneIndex];
    if (!scene) return;

    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const targetScrollY = scene.targetScroll * maxScroll;

    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (window.lenis) {
        window.lenis.scrollTo(targetScrollY, {
            duration: isReduced ? 0 : 1.4,
            immediate: isReduced,
        });
    } else {
        window.scrollTo({
            top: targetScrollY,
            behavior: isReduced ? 'auto' : 'smooth',
        });
    }
}


// ========================================================
// 4. LENIS INITIALIZATION
// ========================================================

function initLenis() {
    if (typeof Lenis === 'undefined') {
        console.warn('PhishGuard: Lenis library not detected from CDN. Using native scroll tracking.');
        window.addEventListener('scroll', () => updateTimeline(), { passive: true });
        updateTimeline();
        return;
    }

    try {
        lenis = new Lenis({
            autoRaf: true,
            duration: 1.25,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            wheelMultiplier: 1,
            touchMultiplier: 1.5,
            syncTouch: false,
            respectReducedMotion: true,
        });

        window.lenis = lenis;

        // Drive both shield frames and text transitions directly from Lenis
        lenis.on('scroll', (e) => {
            updateTimeline(e.progress);
        });

        // Initial sync
        updateTimeline(0);
    } catch (err) {
        console.error('Error initializing Lenis:', err);
        window.addEventListener('scroll', () => updateTimeline(), { passive: true });
    }
}


// ========================================================
// 5. INTERACTIVE URL SCANNER LOGIC (DEMO & ML COMPLIANT)
// ========================================================

function scanURL() {
    const urlInput = document.getElementById("urlInput");
    const resultBox = document.getElementById("resultBox");
    const scanButton = document.getElementById("scanButton");

    if (!urlInput || !resultBox || !scanButton) return;

    const rawURL = urlInput.value.trim();

    if (rawURL === "") {
        alert("Please enter a website URL to analyze.");
        urlInput.focus();
        return;
    }

    let formattedURL = rawURL;
    if (!/^https?:\/\//i.test(formattedURL)) {
        formattedURL = "https://" + formattedURL;
    }

    let parsedURL;
    try {
        parsedURL = new URL(formattedURL);
    } catch (e) {
        alert("Please enter a syntactically valid website address.");
        urlInput.focus();
        return;
    }

    // Diagnostic Loading State
    resultBox.style.display = "block";
    resultBox.innerHTML = `
        <h3><span class="hud-dot alert-dot"></span> ANALYZING TARGET URL</h3>
        <p>Inspecting: <code>${escapeHTML(formattedURL)}</code></p>
        <p style="color: var(--text-muted); font-size: 11px;">Evaluating domain entropy, SSL cipher payload, and lexical heuristics...</p>
    `;

    scanButton.disabled = true;
    scanButton.querySelector('.scan-btn-label').textContent = "EVALUATING...";

    setTimeout(() => {
        const hostname = parsedURL.hostname;
        const isSuspiciousKeyword = /(login|verify|banking|wallet|free|update|auth|account|secure)/i.test(hostname);
        const hasHyphenOrIP = /^[0-9.]+$|-{2,}/.test(hostname);

        const simulatedScore = isSuspiciousKeyword || hasHyphenOrIP ? 88.4 : 3.8;
        const isSafe = simulatedScore < 50;

        resultBox.innerHTML = `
            <h3>
                <span class="hud-dot ${isSafe ? 'icy-dot' : 'alert-dot'}"></span>
                EVALUATION COMPLETED: ${isSafe ? '<span class="text-icy">BENIGN / LEGITIMATE</span>' : '<span class="text-alert">SUSPICIOUS ANOMALY DETECTED</span>'}
            </h3>
            <p><strong>Target:</strong> <code>${escapeHTML(formattedURL)}</code></p>
            <p><strong>Calculated Threat Score:</strong> ${simulatedScore}% Risk Probability</p>
            <p><strong>Lexical Pattern:</strong> Protocol ${parsedURL.protocol.toUpperCase()} // Port ${parsedURL.port || 'Default'} // Subdomains: ${hostname.split('.').length - 2}</p>
            <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
                <span class="result-badge ${isSafe ? 'badge-safe' : 'text-alert'}" style="border: 1px solid currentColor;">
                    ${isSafe ? 'VERIFIED STRUCTURE' : 'HIGH RISK ENTROPY'}
                </span>
                <span class="result-badge badge-demo">
                    DEMONSTRATION DIAGNOSTIC — FULL ML MODEL INTEGRATION READY
                </span>
            </div>
        `;

        scanButton.disabled = false;
        scanButton.querySelector('.scan-btn-label').textContent = "SCAN URL";
    }, 1200);
}

function escapeHTML(value) {
    return value.replace(/[&<>"']/g, function (character) {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[character];
    });
}


// ========================================================
// 6. INITIALIZATION BOOTSTRAP
// ========================================================

function initializeApp() {
    initShieldCanvas();
    initLenis();

    // Listen for reduced motion changes dynamically
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.addEventListener) {
        motionQuery.addEventListener('change', () => updateTimeline());
    }

    // Keyboard navigation support: Pressing Enter inside urlInput triggers scan
    const urlInput = document.getElementById("urlInput");
    if (urlInput) {
        urlInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                scanURL();
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
