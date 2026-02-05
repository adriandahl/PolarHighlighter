import { pipeline, env } from './transformers.min.js';

// configure transformers.js to use local model and disable remote loading
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = browser.runtime.getURL('models/');

let classifier = null;
let isReady = false;
let isProcessing = false;

async function setupLocalModel() {
    try {
        console.log("Initializing local ONNX model...");

        classifier = await pipeline('text-classification', 'polar-model', {
            local_files_only: true,
            quantized: true,
        });

        isReady = true;
        console.log("Local Model Ready");
    } catch (err) {
        console.error("Local model initialization failed:", err);
        isReady = false;
    }
}

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "queryStatus") {
        sendResponse({ isReady: isReady, isProcessing: isProcessing, progress: 0 });
        return;
    }

    if (request.action === "classifyBatch") {
        if (!isReady || !classifier) return Promise.resolve([]);

        isProcessing = true;

        return (async () => {
            try {
                const results = await classifier(request.texts);
                isProcessing = false;

                const resultsArray = Array.isArray(results) ? results : [results];

                return resultsArray.map(res => ({
                    polarized: res.label === 'polarized' || res.label === 'LABEL_1',
                    score: res.score
                }));
            } catch (err) {
                isProcessing = false;
                console.error("Batch classification failed:", err);
                return [];
            }
        })();
    }
});

setupLocalModel();