let isEnabled = false;

browser.runtime.onMessage.addListener((request) => {
    if (request.action === "getStatus") return Promise.resolve({ enabled: isEnabled });
    if (request.action === "enable") { isEnabled = true; runHighlighting(); }
    if (request.action === "disable") { isEnabled = false; location.reload(); }
});

async function runHighlighting() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let allMarkNodes = [];
    let textNodes = [];
    let node;

    // Collect text nodes
    while (node = walker.nextNode()) {
        const parent = node.parentNode.tagName;
        if (!['SCRIPT', 'STYLE', 'MARK', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes(parent)) {
            if (node.textContent.trim().length > 10) {
                textNodes.push(node);
            }
        }
    }

    // Split into sentences and group into ~128 token chunks (approx 500 chars)
    const MAX_CHARS = 500;

    for (const textNode of textNodes) {
        // Split sentences
        const sentences = textNode.textContent.match(/[^.!?]+[.!?]+|\s*\n\s*|[^.!?]+$/g) || [textNode.textContent];
        const fragment = document.createDocumentFragment();
        let currentChunkText = "";
        let currentMarks = [];

        sentences.forEach((sentence) => {
            const mark = document.createElement('mark');
            mark.className = "queued-highlight";
            mark.textContent = sentence;
            fragment.appendChild(mark);

            // If adding this sentence exceeds the limit, we treat what we have as a block
            if ((currentChunkText + sentence).length > MAX_CHARS && currentMarks.length > 0) {
                allMarkNodes.push({ text: currentChunkText, elements: currentMarks });
                currentChunkText = "";
                currentMarks = [];
            }

            currentChunkText += sentence;
            currentMarks.push(mark);
        });

        // Push final remaining sentences from this node
        if (currentMarks.length > 0) {
            allMarkNodes.push({ text: currentChunkText, elements: currentMarks });
        }

        if (textNode.parentNode) {
            textNode.parentNode.replaceChild(fragment, textNode);
        }
    }

    // Process Chunks (for slower visual)
    const BATCH_SIZE = 1;
    const FIXED_DELAY = 500;
    const { coolMode } = await browser.storage.local.get('coolMode');

    for (let i = 0; i < allMarkNodes.length; i += BATCH_SIZE) {
        if (!isEnabled) break;

        const batch = allMarkNodes.slice(i, i + BATCH_SIZE);

        // Flash all marks in this chunk
        batch.forEach(chunk => chunk.elements.forEach(m => m.className = "thinking-highlight"));

        try {
            const resultsPromise = browser.runtime.sendMessage({
                action: "classifyBatch",
                texts: batch.map(chunk => chunk.text)
            });

            if (coolMode) {
                const [results] = await Promise.all([
                    resultsPromise,
                    new Promise(resolve => setTimeout(resolve, FIXED_DELAY))
                ]);
                applyResults(batch, results);
            } else {
                const results = await resultsPromise;
                applyResults(batch, results);
            }
        } catch (err) {
            console.error("Batch failed", err);
        }
    }
}

function applyResults(batch, results) {
    batch.forEach((chunk, index) => {
        const res = results[index];
        const finalClass = (res && res.polarized && res.score > 0.5) ? "polar-highlight" : "neutral-highlight";
        chunk.elements.forEach(mark => mark.className = finalClass);
    });
}