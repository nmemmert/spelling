/**
 * Unified Write Mode - Keyboard-Only Text Input
 */
class UnifiedWriteMode {
    constructor() {
        this.currentMode = 'keyboard';
        this.textArea = null;
        this.container = null;
        this.init();
    }
    init() {
        this.createInterface();
        this.setupEventListeners();
    }
    createInterface() {
        this.container = document.getElementById('unifiedWriteContainer');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'unifiedWriteContainer';
            this.container.className = 'unified-write-mode';
        }
        this.container.innerHTML = `<div style="margin:1rem 0;text-align:center;"><div style="margin-bottom:0.5rem;font-weight:bold;color:var(--primary);">Type Your Answer</div><textarea class="text-input-area" placeholder="Type your answer here..." spellcheck="false" style="width:90%;max-width:400px;min-height:50px;max-height:100px;padding:0.75rem;font-size:1.1rem;border:2px solid var(--primary);border-radius:8px;display:block;margin:0 auto;resize:vertical;box-sizing:border-box;"></textarea></div><div style="margin-top:1rem;text-align:center;"><button id="clearBtn" style="margin-right:0.5rem;padding:0.5rem 1rem;background:#f0f0f0;border:1px solid #ccc;border-radius:6px;cursor:pointer;">🧹 Clear</button><button id="submitBtn" class="btn-primary" style="padding:0.75rem 1.5rem;background:var(--primary);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:1rem;">✅ Submit Answer</button></div>`;
        this.textArea = this.container.querySelector('.text-input-area');
        // Don't auto-focus on page load
    }
    setupEventListeners() {
        const clearBtn = this.container.querySelector('#clearBtn');
        const submitBtn = this.container.querySelector('#submitBtn');
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearInput());
        if (submitBtn) submitBtn.addEventListener('click', () => this.submitAnswer());
        if (this.textArea) this.textArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.submitAnswer(); }
        });
    }
    clearInput() { if (this.textArea) { this.textArea.value = ''; this.textArea.focus(); } }
    getCurrentText() { return this.textArea ? this.textArea.value.trim() : ''; }
    submitAnswer() {
        const answer = this.getCurrentText();
        if (!answer) { alert('Please enter an answer first!'); return; }
        if (window.submitAnswer) window.submitAnswer(answer);
    }
    setText(text) { if (this.textArea) this.textArea.value = text; }
    getText() { return this.getCurrentText(); }
    setMode(mode) { this.currentMode = 'keyboard'; }
    getMode() { return this.currentMode; }
    focusCanvas() { if (this.textArea) this.textArea.focus(); }
    clearText() { this.clearInput(); }
}
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => { window.unifiedWriteMode = new UnifiedWriteMode(); }, 500);
});
window.UnifiedWriteMode = UnifiedWriteMode;
