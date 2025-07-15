// Bible Typing Practice Module
// ESV Bible verses for typing practice

// Popular Bible verses for typing practice
const bibleVerses = [
    {
        reference: "John 3:16",
        text: "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life."
    },
    {
        reference: "Philippians 4:13",
        text: "I can do all things through him who strengthens me."
    },
    {
        reference: "Romans 8:28",
        text: "And we know that for those who love God all things work together for good, for those who are called according to his purpose."
    },
    {
        reference: "Jeremiah 29:11",
        text: "For I know the plans I have for you, declares the Lord, plans for welfare and not for evil, to give you a future and a hope."
    },
    {
        reference: "Proverbs 3:5-6",
        text: "Trust in the Lord with all your heart, and do not lean on your own understanding. In all your ways acknowledge him, and he will make straight your paths."
    },
    {
        reference: "Psalm 23:1",
        text: "The Lord is my shepherd; I shall not want."
    },
    {
        reference: "Isaiah 40:31",
        text: "But they who wait for the Lord shall renew their strength; they shall mount up with wings like eagles; they shall run and not be weary; they shall walk and not faint."
    },
    {
        reference: "Matthew 28:19-20",
        text: "Go therefore and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit, teaching them to observe all that I have commanded you. And behold, I am with you always, to the end of the age."
    },
    {
        reference: "1 Corinthians 13:4-5",
        text: "Love is patient and kind; love does not envy or boast; it is not arrogant or rude. It does not insist on its own way; it is not irritable or resentful."
    },
    {
        reference: "Ephesians 2:8-9",
        text: "For by grace you have been saved through faith. And this is not your own doing; it is the gift of God, not a result of works, so that no one may boast."
    },
    {
        reference: "Psalm 119:105",
        text: "Your word is a lamp to my feet and a light to my path."
    },
    {
        reference: "Romans 12:2",
        text: "Do not be conformed to this world, but be transformed by the renewal of your mind, that by testing you may discern what is the will of God, what is good and acceptable and perfect."
    },
    {
        reference: "2 Timothy 3:16",
        text: "All Scripture is breathed out by God and profitable for teaching, for reproof, for correction, and for training in righteousness."
    },
    {
        reference: "Psalm 46:10",
        text: "Be still, and know that I am God. I will be exalted among the nations, I will be exalted in the earth!"
    },
    {
        reference: "Matthew 6:33",
        text: "But seek first the kingdom of God and his righteousness, and all these things will be added to you."
    }
];

// Global state for Bible typing
let currentVerse = null;
let typingStartTime = null;

// Initialize Bible typing
window.startBibleTyping = function() {
    console.log('📖 Starting Bible typing practice');
    
    const user = JSON.parse(localStorage.getItem('loggedInUser'));
    if (!user) {
        alert('Please log in first');
        return;
    }

    // Hide other sections
    document.getElementById('studentPanel').style.display = 'none';
    document.getElementById('gameSection').style.display = 'none';
    document.getElementById('typingSection').style.display = 'none';
    
    // Show Bible section
    document.getElementById('bibleSection').classList.remove('hidden');
    document.getElementById('bibleSection').style.display = 'block';
    
    // Populate verse dropdown
    populateVerseDropdown();
    
    // Reset the interface
    resetBibleInterface();
}

// Populate the verse selection dropdown
function populateVerseDropdown() {
    const select = document.getElementById('verseSelect');
    select.innerHTML = '<option value="">-- Choose a verse --</option>';
    
    bibleVerses.forEach((verse, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = verse.reference;
        select.appendChild(option);
    });
}

// Load selected verse
window.loadSelectedVerse = function() {
    const select = document.getElementById('verseSelect');
    const index = parseInt(select.value);
    
    if (isNaN(index) || index < 0 || index >= bibleVerses.length) {
        resetBibleInterface();
        return;
    }
    
    currentVerse = bibleVerses[index];
    displayVerse();
}

// Get random verse
window.getRandomVerse = function() {
    const randomIndex = Math.floor(Math.random() * bibleVerses.length);
    currentVerse = bibleVerses[randomIndex];
    
    // Update dropdown
    document.getElementById('verseSelect').value = randomIndex;
    
    displayVerse();
}

// Display the selected verse
function displayVerse() {
    if (!currentVerse) return;
    
    const display = document.getElementById('bibleVerseDisplay');
    display.innerHTML = `
        <div>
            <div style="font-weight: bold; color: var(--primary); margin-bottom: 1rem; font-size: 1.3rem;">
                ${currentVerse.reference}
            </div>
            <div style="font-style: italic;">
                "${currentVerse.text}"
            </div>
        </div>
    `;
    
    // Clear input and reset stats
    document.getElementById('bibleInput').value = '';
    document.getElementById('bibleFeedback').innerHTML = '';
    resetStats();
}

// Check typed verse against original
window.checkBibleVerse = function() {
    if (!currentVerse) {
        alert('Please select a verse first');
        return;
    }
    
    const typedText = document.getElementById('bibleInput').value.trim();
    if (!typedText) {
        alert('Please type something first');
        return;
    }
    
    const originalText = currentVerse.text;
    const feedback = document.getElementById('bibleFeedback');
    
    // Calculate accuracy
    const { accuracy, correctWords, totalWords, errors } = calculateAccuracy(originalText, typedText);
    
    // Update stats
    updateStats(accuracy, correctWords, errors);
    
    // Show feedback
    if (accuracy === 100) {
        feedback.innerHTML = `
            <div style="color: var(--success); font-size: 1.2rem; font-weight: bold;">
                🎉 Perfect! You typed the verse correctly!
            </div>
            <div style="margin-top: 1rem;">
                <button onclick="getRandomVerse()" class="btn-primary">📖 Try Another Verse</button>
            </div>
        `;
    } else {
        feedback.innerHTML = `
            <div style="color: var(--warning); font-size: 1.1rem; font-weight: bold;">
                📝 ${accuracy.toFixed(1)}% Accuracy - Keep practicing!
            </div>
            <div style="margin-top: 1rem; color: var(--text-secondary);">
                <div>Correct words: ${correctWords} / ${totalWords}</div>
                <div>Errors: ${errors}</div>
            </div>
            <div style="margin-top: 1rem;">
                <button onclick="clearBibleInput()" class="btn-secondary">🔄 Try Again</button>
                <button onclick="showDifferences()" class="btn-primary">👀 Show Differences</button>
            </div>
        `;
    }
}

// Calculate typing accuracy
function calculateAccuracy(original, typed) {
    const originalWords = original.toLowerCase().split(/\s+/);
    const typedWords = typed.toLowerCase().split(/\s+/);
    
    let correctWords = 0;
    let errors = 0;
    const maxLength = Math.max(originalWords.length, typedWords.length);
    
    for (let i = 0; i < maxLength; i++) {
        const originalWord = originalWords[i] || '';
        const typedWord = typedWords[i] || '';
        
        if (originalWord === typedWord) {
            correctWords++;
        } else {
            errors++;
        }
    }
    
    const accuracy = originalWords.length > 0 ? (correctWords / originalWords.length) * 100 : 0;
    
    return {
        accuracy,
        correctWords,
        totalWords: originalWords.length,
        errors
    };
}

// Update statistics display
function updateStats(accuracy, correctWords, errors) {
    document.getElementById('accuracyPercent').textContent = accuracy.toFixed(1) + '%';
    document.getElementById('correctWords').textContent = correctWords;
    document.getElementById('incorrectWords').textContent = errors;
}

// Reset statistics
function resetStats() {
    document.getElementById('accuracyPercent').textContent = '0%';
    document.getElementById('correctWords').textContent = '0';
    document.getElementById('incorrectWords').textContent = '0';
}

// Show word-by-word differences
window.showDifferences = function() {
    if (!currentVerse) return;
    
    const typedText = document.getElementById('bibleInput').value.trim();
    const originalWords = currentVerse.text.split(/\s+/);
    const typedWords = typedText.split(/\s+/);
    
    let comparisonHTML = '<div style="text-align: left; margin-top: 1rem; padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius);">';
    comparisonHTML += '<h4>Word-by-word comparison:</h4><div style="line-height: 2;">';
    
    const maxLength = Math.max(originalWords.length, typedWords.length);
    
    for (let i = 0; i < maxLength; i++) {
        const originalWord = originalWords[i] || '';
        const typedWord = typedWords[i] || '';
        
        if (originalWord.toLowerCase() === typedWord.toLowerCase()) {
            comparisonHTML += `<span style="background: var(--success); color: white; padding: 2px 6px; margin: 2px; border-radius: 4px;">${originalWord}</span> `;
        } else if (typedWord === '') {
            comparisonHTML += `<span style="background: var(--error); color: white; padding: 2px 6px; margin: 2px; border-radius: 4px; text-decoration: line-through;">${originalWord}</span> `;
        } else {
            comparisonHTML += `<span style="background: var(--warning); color: white; padding: 2px 6px; margin: 2px; border-radius: 4px;">${originalWord} (typed: ${typedWord})</span> `;
        }
    }
    
    comparisonHTML += '</div></div>';
    
    document.getElementById('bibleFeedback').innerHTML += comparisonHTML;
}

// Clear Bible input
window.clearBibleInput = function() {
    document.getElementById('bibleInput').value = '';
    document.getElementById('bibleFeedback').innerHTML = '';
    resetStats();
}

// Reset Bible interface
function resetBibleInterface() {
    currentVerse = null;
    document.getElementById('verseSelect').value = '';
    document.getElementById('bibleVerseDisplay').innerHTML = 'Select a verse to begin typing practice';
    document.getElementById('bibleInput').value = '';
    document.getElementById('bibleFeedback').innerHTML = '';
    resetStats();
}

// Export reset function for use by main dashboard
window.resetBibleInterface = resetBibleInterface;
