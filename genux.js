/*
 * Genux.js
 * An advanced library for AI-powered generative UI features on any website.
 * Version: 3.2.0
 * License: MIT
 * Performance improvements: Debouncing, lazy-loading, caching, batched DOM updates
 */

(function() {
    // --- Configuration ---
    const CONFIG = {
        apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        apiKey: 'AIzaSyA2SJMO6ZL7Yr9qwHeGNYntxbdsWODYkgM', // Replace with your Gemini API key
        proxyEndpoint: null, // Optional: Set to your proxy server (e.g., 'http://localhost:3000/proxy-api')
        storageBackend: 'local', // 'local' or 'cloud' (Firebase for cloud)
        firebaseConfig: null, // Set via initializeGenux({ firebaseConfig })
        targetContainer: null, // Target DOM element selector (e.g., '#app')
        disableDefaultStyles: false, // Disable default CSS
        customFAB: null, // Custom FAB HTML
        customFABSelector: null, // Custom FAB selector
        apiAdapter: null, // Custom API handler
        storageAdapter: null, // Custom storage handler
        defaultTheme: {
            primary: '#4545C4',
            cardBg: '#1f1f21',
            lightText: '#e3e3e3',
            midText: '#9aa0a6',
            border: '#373739',
            hoverBg: 'rgba(255, 255, 255, 0.04)'
        },
        dependencies: {
            fontAwesome: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
            domPurify: 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/2.4.0/purify.min.js'
        },
        debounceDelay: 300, // Debounce delay for prompt input (ms)
        cache: { features: null } // In-memory feature cache
    };

    let firebaseApp = null;

    /**
     * Initializes the Genux functionality on the page.
     * @param {Object} options - Configuration options
     */
    function initializeGenux(options = {}) {
        console.log("Genux Initializing...");
        Object.assign(CONFIG, options);
        if (CONFIG.storageBackend === 'cloud' && CONFIG.firebaseConfig && !CONFIG.storageAdapter) {
            loadFirebase().then(() => {
                firebaseApp = firebase.initializeApp(CONFIG.firebaseConfig);
            });
        }
        createFloatingButton();
        loadAndApplySavedFeatures();
    }

    /**
     * Loads external dependencies (lazy-loaded).
     */
    async function loadDependencies() {
        const promises = [];
        if (!window.Purify) {
            promises.push(loadScript(CONFIG.dependencies.domPurify));
        }
        if (!document.querySelector('link[href*="font-awesome"]')) {
            promises.push(loadStylesheet(CONFIG.dependencies.fontAwesome));
        }
        return Promise.all(promises);
    }

    /**
     * Loads Firebase SDK dynamically for cloud storage.
     */
    async function loadFirebase() {
        if (typeof firebase === 'undefined') {
            await loadScript('https://www.gstatic.com/firebasejs/9.6.0/firebase-app-compat.js');
            await loadScript('https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore-compat.js');
        }
    }

    /**
     * Dynamically loads a script.
     * @param {string} src - Script URL
     */
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Dynamically loads a stylesheet.
     * @param {string} href - Stylesheet URL
     */
    function loadStylesheet(href) {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
        });
    }

    /**
     * Injects global CSS styles with customizable theme.
     */
    function injectGlobalStyles() {
        if (CONFIG.disableDefaultStyles || document.getElementById('genux-styles')) return;
        const styleSheet = document.createElement('style');
        styleSheet.id = 'genux-styles';
        styleSheet.type = 'text/css';
        styleSheet.innerText = `
            :root {
                --genux-primary: ${CONFIG.defaultTheme.primary};
                --genux-primary-light: ${CONFIG.defaultTheme.primary}33;
                --genux-card-bg: ${CONFIG.defaultTheme.cardBg};
                --genux-light-text: ${CONFIG.defaultTheme.lightText};
                --genux-mid-text: ${CONFIG.defaultTheme.midText};
                --genux-border: ${CONFIG.defaultTheme.border};
                --genux-hover-bg: ${CONFIG.defaultTheme.hoverBg};
            }
            @keyframes genux-glow-pulse { ... }
            @keyframes genux-fade-in { ... }
            @keyframes genux-fade-out { ... }
            @keyframes genux-typing-dots { ... }
            #genux-fab { ... }
            #genux-fab:hover { ... }
            #genux-fab:active { ... }
            .genux-modal-overlay { ... }
            #genux-modal { ... }
            #genux-modal-main { ... }
            #genux-modal-header { ... }
            #genux-modal-header .genux-logo { ... }
            #genux-modal-header h2 { ... }
            .genux-subtitle { ... }
            #genux-prompt-container { ... }
            #genux-output-type { ... }
            #genux-prompt { ... }
            #genux-prompt:focus { ... }
            #genux-generate-btn { ... }
            #genux-generate-btn:hover { ... }
            #genux-modal-actions { ... }
            .genux-action-buttons { ... }
            .genux-action-buttons button { ... }
            .genux-action-buttons button:hover { ... }
            #genux-clear-btn:hover { ... }
            #genux-features-list { ... }
            .genux-feature-item { ... }
            .genux-feature-item p { ... }
            .genux-feature-item button { ... }
            .genux-feature-item button:hover { ... }
            .genux-empty-state { ... }
            #genux-loader { ... }
            @media (max-width: 768px) { ... }
        `;
        document.head.appendChild(styleSheet);
    }

    /**
     * Creates the floating action button.
     */
    function createFloatingButton() {
        if (CONFIG.customFAB && CONFIG.customFABSelector) {
            document.body.insertAdjacentHTML('beforeend', CONFIG.customFAB);
            const fab = document.querySelector(CONFIG.customFABSelector);
            if (fab) fab.addEventListener('click', openPromptModal);
            return;
        }
        const button = document.createElement('button');
        button.id = 'genux-fab';
        button.title = 'Open Genux';
        button.setAttribute('aria-label', 'Open Genux interface');
        button.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>';
        button.addEventListener('click', openPromptModal);
        document.body.appendChild(button);
    }

    /**
     * Opens the prompt modal.
     */
    function openPromptModal() {
        if (document.getElementById('genux-modal-overlay')) return;
        loadDependencies().then(() => {
            injectGlobalStyles();
            const modalOverlay = document.createElement('div');
            modalOverlay.id = 'genux-modal-overlay';
            modalOverlay.className = 'genux-modal-overlay';
            modalOverlay.setAttribute('aria-modal', 'true');
            modalOverlay.innerHTML = `
                <div id="genux-modal" role="dialog" aria-labelledby="genux-modal-title">
                    <div id="genux-modal-main">
                        <div id="genux-modal-header">
                            <span class="genux-logo"><i class="fas fa-wand-magic-sparkles"></i></span>
                            <h2 id="genux-modal-title">Genux</h2>
                        </div>
                        <p class="genux-subtitle">
                            Describe your UI feature or select an output type and watch it come to life.
                        </p>
                        <div id="genux-prompt-container">
                            <select id="genux-output-type">
                                <option value="javascript">JavaScript</option>
                                <option value="html">HTML</option>
                                <option value="css">CSS</option>
                            </select>
                            <textarea id="genux-prompt" placeholder="Add a dark mode toggle to the header..." aria-label="Feature description"></textarea>
                            <div id="genux-modal-actions">
                                <button id="genux-generate-btn" aria-label="Generate feature">Generate</button>
                                <div class="genux-action-buttons">
                                    <button id="genux-clear-btn" aria-label="Clear all features">Clear All</button>
                                    <button id="genux-cancel-btn" aria-label="Close modal">Cancel</button>
                                </div>
                            </div>
                        </div>
                        <div id="genux-features-list-container">
                            <h3>Active Features</h3>
                            <ul id="genux-features-list" aria-label="List of active features"></ul>
                        </div>
                        <div id="genux-loader">
                            <div class="genux-typing-indicator">
                                <div class="genux-typing-dot"></div>
                                <div class="genux-typing-dot"></div>
                                <div class="genux-typing-dot"></div>
                            </div>
                            <p>Generating your feature...</p>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modalOverlay);
            renderFeaturesList();

            // Event listeners with debouncing
            const promptTextarea = document.getElementById('genux-prompt');
            const generateBtn = document.getElementById('genux-generate-btn');
            const cancelBtn = document.getElementById('genux-cancel-btn');
            const clearBtn = document.getElementById('genux-clear-btn');

            const debouncedGenerate = debounce(handleGenerateClick, CONFIG.debounceDelay);
            generateBtn.addEventListener('click', debouncedGenerate);
            cancelBtn.addEventListener('click', closeModal);
            clearBtn.addEventListener('click', () => clearSavedFeatures(true));
            promptTextarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    debouncedGenerate();
                }
            });
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) closeModal();
            });
            document.addEventListener('keydown', handleEscapeKey);
            setTimeout(() => promptTextarea.focus(), 100);
        });
    }

    /**
     * Debounces a function.
     * @param {Function} func - Function to debounce
     * @param {number} delay - Debounce delay in ms
     */
    function debounce(func, delay) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    /**
     * Closes the modal.
     */
    function closeModal() {
        const modalOverlay = document.getElementById('genux-modal-overlay');
        if (modalOverlay) {
            modalOverlay.style.animation = 'genux-fade-out 0.3s cubic-bezier(0.55, 0.055, 0.675, 0.19)';
            document.removeEventListener('keydown', handleEscapeKey);
            setTimeout(() => modalOverlay.remove(), 300);
        }
    }

    /**
     * Handles ESC key to close modal.
     */
    function handleEscapeKey(e) {
        if (e.key === 'Escape') closeModal();
    }

    /**
     * Renders the list of active features.
     */
    async function renderFeaturesList() {
        const features = await getSavedFeatures();
        const listEl = document.getElementById('genux-features-list');
        if (!listEl) return;

        listEl.innerHTML = '';
        if (features.length === 0) {
            listEl.innerHTML = `
                <div class="genux-empty-state">
                    <i class="fas fa-magic"></i>
                    <div>No features created yet. Start by describing what you'd like to build!</div>
                </div>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        features.forEach((feature, index) => {
            const itemEl = document.createElement('li');
            itemEl.className = 'genux-feature-item';
            itemEl.style.animationDelay = `${index * 0.1}s`;
            itemEl.innerHTML = `
                <p title="${feature.prompt}">${feature.prompt}</p>
                <div>
                    <button data-id="${feature.id}" data-action="edit" title="Edit feature"><i class="fas fa-edit"></i></button>
                    <button data-id="${feature.id}" data-action="remove" title="Remove feature"><i class="fas fa-trash-can"></i></button>
                </div>`;
            fragment.appendChild(itemEl);
        });
        listEl.appendChild(fragment);

        listEl.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                const featureId = e.currentTarget.getAttribute('data-id');
                const action = e.currentTarget.getAttribute('data-action');
                if (action === 'edit') {
                    handleEditFeature(featureId);
                } else {
                    handleRemoveFeature(featureId);
                }
            });
        });
    }

    /**
     * Handles feature generation.
     */
    async function handleGenerateClick() {
        const promptText = document.getElementById('genux-prompt')?.value.trim();
        const outputType = document.getElementById('genux-output-type')?.value;
        if (!promptText) {
            showNotification('Please describe what you want to create.', 'error');
            return;
        }

        const loader = document.getElementById('genux-loader');
        const promptContainer = document.getElementById('genux-prompt-container');
        loader.style.display = 'block';
        promptContainer.style.opacity = '0.5';
        promptContainer.style.pointerEvents = 'none';

        try {
            const domStructure = getPageStructure(CONFIG.targetContainer);
            const siteCode = CONFIG.targetContainer
                ? document.querySelector(CONFIG.targetContainer)?.innerHTML || ''
                : document.body.innerHTML;
            const fullPrompt = `
                You are an expert web developer. Generate ${outputType.toUpperCase()} code for a webpage feature based on the user's request.
                Rules:
                1. Output only clean ${outputType.toUpperCase()} code, no markdown or explanations.
                2. Ensure code is self-contained and idempotent.
                3. For JavaScript, avoid global scope pollution.
                4. For HTML/CSS, ensure WCAG 2.1 accessibility compliance.
                5. Use modern standards (ES6+ for JS, CSS3 for CSS).
                DOM Structure: ${domStructure}
                User Request: ${promptText}
                Site Code: ${siteCode}
            `;

            let result;
            if (CONFIG.apiAdapter) {
                result = await CONFIG.apiAdapter({ prompt: fullPrompt, outputType });
            } else if (CONFIG.proxyEndpoint) {
                const response = await fetchWithRetry(CONFIG.proxyEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: fullPrompt, outputType })
                });
                result = await response.json();
            } else {
                const response = await fetchWithRetry(`${CONFIG.apiEndpoint}?key=${CONFIG.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: fullPrompt }] }],
                        fields: 'candidates.content.parts.text' // Request only necessary fields[](https://developers.google.com/api-client-library/dotnet/guide/performance)
                    })
                });
                const data = await response.json();
                result = { code: data.candidates[0].content.parts[0].text };
            }

            let generatedCode = result.code || '';
            generatedCode = DOMPurify.sanitize(generatedCode);

            const newFeature = {
                id: Date.now(),
                prompt: promptText,
                code: generatedCode,
                type: outputType
            };

            await addAndSaveFeature(newFeature);
            executeFeature(newFeature);
            document.getElementById('genux-prompt').value = '';
            renderFeaturesList();
            showNotification('✨ Feature created successfully!', 'success');
        } catch (error) {
            console.error('Error generating feature:', error);
            showNotification(`Failed: ${error.message}. Try rephrasing your prompt.`, 'error');
        } finally {
            loader.style.display = 'none';
            promptContainer.style.opacity = '1';
            promptContainer.style.pointerEvents = 'auto';
        }
    }

    /**
     * Executes a feature based on its type.
     */
    function executeFeature(feature) {
        try {
            const target = CONFIG.targetContainer ? document.querySelector(CONFIG.targetContainer) : document.body;
            if (!target && feature.type !== 'javascript') {
                showNotification('Target container not found.', 'error');
                return;
            }

            if (feature.type === 'javascript') {
                const script = document.createElement('script');
                script.textContent = `try { (function() { ${feature.code} })(); } catch (e) { console.error('Genux Error:', e); }`;
                script.dataset.featureId = feature.id;
                document.head.appendChild(script);
            } else if (feature.type === 'html') {
                const div = document.createElement('div');
                div.innerHTML = feature.code;
                div.dataset.featureId = feature.id;
                target.appendChild(div);
            } else if (feature.type === 'css') {
                const style = document.createElement('style');
                style.textContent = feature.code;
                style.dataset.featureId = feature.id;
                document.head.appendChild(style);
            }
        } catch (error) {
            console.error('Error executing feature:', error);
            showNotification('Failed to apply feature.', 'error');
        }
    }

    /**
     * Loads and applies saved features.
     */
    async function loadAndApplySavedFeatures() {
        const features = await getSavedFeatures();
        console.log(`Applying ${features.length} saved features...`);
        const fragment = document.createDocumentFragment();
        features.forEach(feature => {
            const el = executeFeature(feature);
            if (el) fragment.appendChild(el);
        });
        const target = CONFIG.targetContainer ? document.querySelector(CONFIG.targetContainer) : document.body;
        if (target && fragment.children.length) target.appendChild(fragment);
    }

    /**
     * Edits an existing feature.
     */
    async function handleEditFeature(featureId) {
        const features = await getSavedFeatures();
        const feature = features.find(f => f.id === parseInt(featureId));
        if (!feature) return;

        const modalOverlay = document.getElementById('genux-modal-overlay');
        const promptTextarea = document.getElementById('genux-prompt');
        const outputTypeSelect = document.getElementById('genux-output-type');

        promptTextarea.value = feature.prompt;
        outputTypeSelect.value = feature.type;
        promptTextarea.focus();

        const generateBtn = document.getElementById('genux-generate-btn');
        const originalText = generateBtn.textContent;
        generateBtn.textContent = 'Update';
        generateBtn.onclick = async () => {
            await handleRemoveFeature(featureId, false);
            await handleGenerateClick();
            generateBtn.textContent = originalText;
            generateBtn.onclick = debounce(handleGenerateClick, CONFIG.debounceDelay);
        };
    }

    /**
     * Removes a feature.
     */
    async function handleRemoveFeature(featureId, confirm = true) {
        const remove = async () => {
            const features = await getSavedFeatures();
            const updatedFeatures = features.filter(f => f.id !== parseInt(featureId));
            await saveFeatures(updatedFeatures);
            document.querySelectorAll(`[data-feature-id="${featureId}"]`).forEach(el => el.remove());
            renderFeaturesList();
            showNotification('Feature removed.', 'info');
        };

        if (confirm) {
            showConfirmation('Remove this feature?', remove);
        } else {
            await remove();
        }
    }

    /**
     * Fetch with retry and exponential backoff.
     */
    async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                if (response.ok) return response;
                throw new Error(`HTTP ${response.status}`);
            } catch (error) {
                if (i === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
            }
        }
    }

    /**
     * Clears all saved features.
     */
    async function clearSavedFeatures(confirm = true) {
        const clear = async () => {
            await saveFeatures([]);
            document.querySelectorAll('[data-feature-id]').forEach(el => el.remove());
            renderFeaturesList();
            showNotification('All features cleared.', 'info');
        };

        if (confirm) {
            showConfirmation('Clear all features?', clear);
        } else {
            await clear();
        }
    }

    /**
     * Retrieves saved features with caching.
     */
    async function getSavedFeatures() {
        if (CONFIG.cache.features) return CONFIG.cache.features;
        let features = [];
        if (CONFIG.storageAdapter) {
            features = await CONFIG.storageAdapter.get();
        } else if (CONFIG.storageBackend === 'cloud' && firebaseApp) {
            const db = firebase.firestore();
            const snapshot = await db.collection('features').get();
            features = snapshot.docs.map(doc => doc.data());
        } else {
            features = JSON.parse(localStorage.getItem('Genux-Features') || '[]');
        }
        CONFIG.cache.features = features;
        return features;
    }

    /**
     * Saves features to storage.
     */
    async function saveFeatures(features) {
        CONFIG.cache.features = features;
        if (CONFIG.storageAdapter) {
            await CONFIG.storageAdapter.save(features);
        } else if (CONFIG.storageBackend === 'cloud' && firebaseApp) {
            const db = firebase.firestore();
            const batch = db.batch();
            features.forEach(feature => {
                const ref = db.collection('features').doc(feature.id.toString());
                batch.set(ref, feature);
            });
            await batch.commit();
        } else {
            localStorage.setItem('Genux-Features', JSON.stringify(features));
        }
    }

    /**
     * Adds and saves a new feature.
     */
    async function addAndSaveFeature(feature) {
        const features = await getSavedFeatures();
        features.push(feature);
        await saveFeatures(features);
    }

    /**
     * Shows a notification.
     */
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'genux-notification';
        notification.setAttribute('role', 'alert');
        Object.assign(notification.style, {
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '16px 24px',
            borderRadius: '12px',
            color: 'white',
            zIndex: '10001',
            background: 'rgba(31, 31, 33, 0.95)',
            backdropFilter: 'blur(20px)',
            fontSize: '14px',
            maxWidth: '400px',
            textAlign: 'center'
        });

        const styles = {
            success: { borderLeft: '4px solid #4caf50', icon: '✓' },
            error: { borderLeft: '4px solid #f44336', icon: '⚠' },
            info: { borderLeft: '4px solid #2196f3', icon: 'ℹ' }
        };
        const { borderLeft, icon } = styles[type] || styles.info;
        notification.style.borderLeft = borderLeft;
        notification.innerHTML = `<span style="margin-right: 8px;">${icon}</span>${message}`;

        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.animation = 'genux-fade-out 0.4s';
            setTimeout(() => notification.remove(), 400);
        }, 3500);
    }

    /**
     * Shows a confirmation dialog.
     */
    function showConfirmation(message, onConfirm) {
        const confirmOverlay = document.createElement('div');
        confirmOverlay.id = 'genux-confirm-overlay';
        confirmOverlay.className = 'genux-modal-overlay';
        confirmOverlay.innerHTML = `
            <div role="dialog" aria-labelledby="genux-confirm-title">
                <div style="background: var(--genux-card-bg); padding: 24px; border-radius: 16px; text-align: center;">
                    <h3 id="genux-confirm-title" style="font-size: 24px; margin-bottom: 16px; color: #f44336;">⚠</h3>
                    <p style="margin: 0 0 24px 0; font-size: 16px; color: var(--genux-light-text);">${message}</p>
                    <div style="display: flex; justify-content: center; gap: 16px;">
                        <button id="genux-confirm-yes-btn">Confirm</button>
                        <button id="genux-confirm-no-btn">Cancel</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(confirmOverlay);

        const closeConfirm = () => {
            confirmOverlay.style.animation = 'genux-fade-out 0.3s';
            setTimeout(() => confirmOverlay.remove(), 300);
        };

        document.getElementById('genux-confirm-yes-btn').addEventListener('click', () => {
            onConfirm();
            closeConfirm();
        });
        document.getElementById('genux-confirm-no-btn').addEventListener('click', closeConfirm);
    }

    /**
     * Generates detailed DOM structure.
     */
    function getPageStructure(targetContainer = null) {
        let structure = 'Page DOM Structure:\n';
        const root = targetContainer ? document.querySelector(targetContainer) : document.body;
        if (!root) return structure;
        const traverseDOM = (node, depth = 0) => {
            if (node.nodeType !== 1 || node.id?.startsWith('genux')) return;
            const indent = '  '.repeat(depth);
            let entry = `${indent}- <${node.tagName.toLowerCase()}`;
            if (node.id) entry += ` id="${node.id}"`;
            if (node.className) entry += ` class="${node.className}"`;
            entry += '>\n';
            structure += entry;
            Array.from(node.children).forEach(child => traverseDOM(child, depth + 1));
        };
        traverseDOM(root);
        return structure;
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initializeGenux());
    } else {
        initializeGenux();
    }

    // Expose public API
    window.Genux = {
        initialize: initializeGenux,
        addFeature: addAndSaveFeature,
        removeFeature: handleRemoveFeature,
        clearFeatures: clearSavedFeatures,
        openModal: openPromptModal,
        generateFeature: handleGenerateClick,
        getFeatures: getSavedFeatures
    };
})();
