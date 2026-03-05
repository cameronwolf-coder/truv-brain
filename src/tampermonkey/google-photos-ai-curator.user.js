// ==UserScript==
// @name         Google Photos AI Curator
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Uses OpenAI Vision API to identify and highlight the "best" photos in your Google Photos grid.
// @author       Antigravity
// @match        https://photos.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=photos.google.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      generativelanguage.googleapis.com
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        GEMINI_API_KEY: GM_getValue("GEMINI_API_KEY", ""),
        GEMINI_MODEL: "gemini-1.5-flash", // Fast, multimodal, and currently has a free tier
        REFERENCE_FACE: GM_getValue("REFERENCE_FACE", null), // Base64 string of the user's face
        PROMPT: "You are an expert photography curator. Analyze the following sequence of photos. " +
            "The FIRST photo provided is a reference image of the subject. " +
            "Score the REMAINING photos from 1 to 10 based on: " +
            "1) Does it clearly feature the person in the reference photo? (Score 1 if not) " +
            "2) Good lighting, clear focus, flattering framing, minimal blur, eyes open. " +
            "Return ONLY a JSON array of the integer scores for the REMAINING photos. If it's a great photo of them, give it an 8, 9, or 10. Example format: [8, 4, 9]"
    };

    // --- Configuration Menu ---
    GM_registerMenuCommand("Set Gemini API Key", () => {
        const key = prompt("Enter your free Google Gemini API Key (from aistudio.google.com):", CONFIG.GEMINI_API_KEY);
        if (key !== null) {
            GM_setValue("GEMINI_API_KEY", key.trim());
            CONFIG.GEMINI_API_KEY = key.trim();
            alert("API Key saved successfully!");
            initUI(); // Try to initialize UI if it was waiting on the key
        }
    });

    GM_registerMenuCommand("Upload Reference Face", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/jpeg, image/png, image/webp";
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result;
                // Optional: resize image here if it's too large, but for now just save it
                GM_setValue("REFERENCE_FACE", base64);
                CONFIG.REFERENCE_FACE = base64;
                alert("Reference face saved successfully!");
                updateUIState();
            };
            reader.readAsDataURL(file);
        };
        input.click();
    });

    GM_registerMenuCommand("Clear Reference Face", () => {
        if (confirm("Are you sure you want to clear the reference face?")) {
            GM_setValue("REFERENCE_FACE", null);
            CONFIG.REFERENCE_FACE = null;
            alert("Reference face cleared.");
            updateUIState();
        }
    });

    // --- UI Injection ---
    function initUI() {
        if (!CONFIG.GEMINI_API_KEY) {
            console.log("Google Photos AI Curator: Waiting for Gemini API Key to initialize.");
            return;
        }

        if (document.getElementById("gp-ai-curator-btn")) return;

        const btn = document.createElement("button");
        btn.id = "gp-ai-curator-btn";
        btn.textContent = "✨ Curate Best Photos";
        btn.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 99999;
            background-color: #1a73e8;
            color: white;
            border: none;
            border-radius: 24px;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: all 0.2s ease;
            font-family: 'Google Sans', Roboto, Arial, sans-serif;
            display: flex;
            align-items: center;
            gap: 8px;
        `;

        btn.onmouseover = () => {
            btn.style.backgroundColor = "#1557b0";
            btn.style.transform = "translateY(-1px)";
            btn.style.boxShadow = "0 6px 10px rgba(0,0,0,0.15)";
        };
        btn.onmouseout = () => {
            btn.style.backgroundColor = "#1a73e8";
            btn.style.transform = "none";
            btn.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
        };

        btn.onclick = startCuration;
        document.body.appendChild(btn);

        // Add a small indicator for the reference face
        const faceIndicator = document.createElement("div");
        faceIndicator.id = "gp-ai-face-indicator";
        faceIndicator.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 210px; /* Position to the left of the main button */
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background-color: #f1f3f4;
            background-size: cover;
            background-position: center;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            z-index: 99999;
            display: none;
            cursor: pointer;
            title: "Reference Face"
        `;
        faceIndicator.onclick = () => alert("This is the reference face used to identify you in photos. You can change or clear it in the Tampermonkey menu.");
        document.body.appendChild(faceIndicator);

        updateUIState();
    }

    function updateUIState() {
        const indicator = document.getElementById("gp-ai-face-indicator");
        if (indicator) {
            if (CONFIG.REFERENCE_FACE) {
                indicator.style.backgroundImage = `url(${CONFIG.REFERENCE_FACE})`;
                indicator.style.display = 'block';
            } else {
                indicator.style.display = 'none';
            }
        }
    }

    // --- Main Logic Placeholder ---
    async function startCuration() {
        const btn = document.getElementById("gp-ai-curator-btn");
        if (!btn) return;

        if (!CONFIG.REFERENCE_FACE) {
            alert("Please upload a 'Reference Face' photo first via the Tampermonkey menu so the AI knows who to look for.");
            return;
        }

        btn.textContent = "⏳ Analyzing...";
        btn.disabled = true;
        btn.style.opacity = "0.7";
        btn.style.cursor = "wait";

        try {
            // Find images, convert, rank, and highlight
            await performCurationTask();
        } catch (error) {
            console.error("Curator Error:", error);
            alert("An error occurred during curation. Check the console for details.");
        } finally {
            btn.textContent = "✨ Curate Best Photos";
            btn.disabled = false;
            btn.style.opacity = "1";
            btn.style.cursor = "pointer";
        }
    }

    async function performCurationTask() {
        console.log("Curation task started...");

        // 1. Find all photo elements currently visible in the DOM grid
        // Google Photos uses generic div backgrounds for thumbnails, usually containing lh3.googleusercontent.com strings.
        // The main container for a photo cell often has specific attributes we can try to hook into, like data-date or role=checkbox siblings.

        // A generic approach: find all divs with a background image style containing the Google user content URL.
        const photoElements = Array.from(document.querySelectorAll('div[style*="background-image"]'))
            .filter(el => {
                const bg = el.style.backgroundImage;
                return bg && bg.includes('lh3.googleusercontent.com') && !bg.includes('video'); // Try to exclude UI icons and explicitly marked videos
            });

        if (photoElements.length === 0) {
            alert("No photos detected on screen. Please ensure you are viewing the photo grid.");
            return;
        }

        console.log(`Found ${photoElements.length} potential photo elements.`);

        // Target just a small slice to start, so we don't overwhelm the API
        const batchSize = Math.min(10, photoElements.length);
        const curatingBatch = photoElements.slice(0, batchSize);

        // 2. Extract URLs and Convert to Base64
        const imageDataList = [];
        for (let i = 0; i < curatingBatch.length; i++) {
            const el = curatingBatch[i];
            const bgUrlMatch = el.style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);

            if (bgUrlMatch && bgUrlMatch[1]) {
                let url = bgUrlMatch[1];

                // Google Photos thumbnail URLs often contain size parameters like `=w256-h256`. 
                // We want to request slightly higher quality for the vision model, but not full resolution to save bandwidth.
                // e.g., change =w256... to =w1024
                url = url.replace(/=w\d+-h\d+.*?$/i, '=w1024');

                try {
                    const base64 = await fetchImageAsBase64(url);
                    imageDataList.push({ element: el, base64: base64, url: url });
                } catch (e) {
                    console.error("Failed to fetch image", url, e);
                    // Dim failed elements so user knows
                    el.style.opacity = '0.3';
                }
            }
        }

        console.log(`Successfully converted ${imageDataList.length} images to Base64.`);

        // 3. Send to Gemini Vision API
        if (imageDataList.length > 0) {
            await analyzeAndHighlightImages(imageDataList);
        }
    }

    // Helper to strip data URL prefix for Gemini API
    function getBase64Data(dataUrl) {
        return dataUrl.split(',')[1];
    }
    function getMimeType(dataUrl) {
        return dataUrl.substring(dataUrl.indexOf(':') + 1, dataUrl.indexOf(';'));
    }

    async function analyzeAndHighlightImages(imageDataList) {
        // Construct the payload for Gemini
        const parts = [
            { text: CONFIG.PROMPT }
        ];

        // 1. Add the REFERENCE image first
        if (CONFIG.REFERENCE_FACE) {
            parts.push({
                inlineData: {
                    mimeType: getMimeType(CONFIG.REFERENCE_FACE) || "image/jpeg",
                    data: getBase64Data(CONFIG.REFERENCE_FACE)
                }
            });
        }

        // 2. Add all grid images to the request
        imageDataList.forEach((item, index) => {
            parts.push({
                inlineData: {
                    mimeType: getMimeType(item.base64) || "image/jpeg",
                    data: getBase64Data(item.base64)
                }
            });
        });

        const payload = {
            contents: [{ parts: parts }],
            generationConfig: {
                responseMimeType: "application/json",
            }
        };

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`,
                headers: {
                    "Content-Type": "application/json"
                },
                data: JSON.stringify(payload),
                onload: function (response) {
                    if (response.status >= 200 && response.status < 300) {
                        try {
                            const data = JSON.parse(response.responseText);
                            const textResponse = data.candidates[0].content.parts[0].text;

                            // Gemini returns the JSON array as a string, sometimes wrapped in markdown blocks
                            let cleanJson = textResponse.replace(/^```json/m, '').replace(/^```/m, '').trim();
                            const scores = JSON.parse(cleanJson);

                            console.log("Received AI Scores:", scores);
                            applyHighlights(imageDataList, scores);
                            resolve();
                        } catch (e) {
                            console.error("Failed to parse Gemini response:", e);
                            reject(e);
                        }
                    } else {
                        console.error("Gemini API Error:", response.responseText);
                        reject(new Error(`API Error: ${response.status}`));
                    }
                },
                onerror: function (err) {
                    console.error("Network error during API call:", err);
                    reject(err);
                }
            });
        });
    }

    function applyHighlights(imageDataList, scores) {
        if (!scores || scores.length !== imageDataList.length) {
            console.error("Score count mismatch!", scores, imageDataList.length);
            return;
        }

        imageDataList.forEach((item, index) => {
            const score = scores[index];
            const el = item.element;

            // Clean up old styling if any
            el.style.boxShadow = '';
            el.style.opacity = '1';

            // We need to apply styles somewhere visible. The 'el' is usually a background div.
            // Let's add an explicit border/overlay.
            el.style.position = 'relative'; // Ensure relative positioning for overlays

            // Create a badge for the score
            let badge = el.querySelector('.gp-curator-badge');
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'gp-curator-badge';
                badge.style.cssText = `
                    position: absolute;
                    top: 8px;
                    left: 8px;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-weight: bold;
                    color: white;
                    z-index: 10;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.5);
                    font-family: sans-serif;
                    font-size: 14px;
                `;
                el.appendChild(badge);
            }

            badge.textContent = `⭐ ${score}/10`;

            // Visually highlight based on score tier
            if (score >= 8) {
                // Great photos get a glowing green border and badge
                el.style.boxShadow = 'inset 0 0 0 4px #34a853';
                badge.style.backgroundColor = '#34a853'; // Green
            } else if (score >= 5) {
                // Average
                badge.style.backgroundColor = '#fbbc04'; // Yellow
            } else {
                // Poor photos get dimmed
                el.style.opacity = '0.3';
                badge.style.backgroundColor = '#ea4335'; // Red
            }
        });
    }

    // Helper to fetch an image bridging CORS restrictions and return Base64
    function fetchImageAsBase64(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                responseType: "blob",
                onload: function (response) {
                    if (response.status === 200) {
                        const reader = new FileReader();
                        reader.onloadend = function () {
                            // Returns a data URL string: data:image/jpeg;base64,/9j/4AAQSkZJ...
                            resolve(reader.result);
                        }
                        reader.readAsDataURL(response.response);
                    } else {
                        reject(new Error(`Failed with status: ${response.status}`));
                    }
                },
                onerror: function (err) {
                    reject(err);
                }
            });
        });
    }

    // --- Initialization ---
    // Wait for the page to load sufficiently before injecting
    window.addEventListener('load', () => {
        setTimeout(initUI, 1500); // Small delay to let Google Photos render
    });

})();
