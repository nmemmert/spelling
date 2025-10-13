// Bible Typing Practice Module
// ESV Bible verses for typing practice

// Bible verses organized by sections from Truth & Training "Agents of Grace" and popular verses
const bibleVerseSections = {
    "Popular Verses": [
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
            reference: "John 11:36",
            text: "Jesus wept."
        }
    ],
    "T&T Agents of Grace - Section A: God's Character": [
        {
            reference: "Exodus 34:6-7",
            text: "The Lord passed before him and proclaimed, \"The Lord, the Lord, a God merciful and gracious, slow to anger, and abounding in steadfast love and faithfulness, keeping steadfast love for thousands, forgiving iniquity and transgression and sin, but who will by no means clear the guilty, visiting the iniquity of the fathers on the children and the children's children, to the third and the fourth generation.\""
        },
        {
            reference: "Psalm 86:15",
            text: "But you, O Lord, are a God merciful and gracious, slow to anger and abounding in steadfast love and faithfulness."
        },
        {
            reference: "1 John 4:8",
            text: "Anyone who does not love does not know God, because God is love."
        },
        {
            reference: "Isaiah 6:3",
            text: "And one called to another and said: \"Holy, holy, holy is the Lord of hosts; the whole earth is full of his glory!\""
        },
        {
            reference: "Psalm 139:1-4",
            text: "O Lord, you have searched me and known me! You know when I sit down and when I rise up; you discern my thoughts from afar. You search out my path and my lying down and are acquainted with all my ways. Even before a word is on my tongue, behold, O Lord, you know it altogether."
        }
    ],
    "T&T Agents of Grace - Section B: Man's Need": [
        {
            reference: "Romans 3:23",
            text: "For all have sinned and fall short of the glory of God."
        },
        {
            reference: "Romans 6:23",
            text: "For the wages of sin is death, but the free gift of God is eternal life in Christ Jesus our Lord."
        },
        {
            reference: "Isaiah 59:2",
            text: "But your iniquities have made a separation between you and your God, and your sins have hidden his face from you so that he does not hear."
        },
        {
            reference: "Jeremiah 17:9",
            text: "The heart is deceitful above all things, and desperately sick; who can understand it?"
        },
        {
            reference: "Ephesians 2:1",
            text: "And you were dead in the trespasses and sins."
        }
    ],
    "T&T Agents of Grace - Section C: Christ's Provision": [
        {
            reference: "John 14:6",
            text: "Jesus said to him, \"I am the way, and the truth, and the life. No one comes to the Father except through me.\""
        },
        {
            reference: "1 Timothy 2:5",
            text: "For there is one God, and there is one mediator between God and men, the man Christ Jesus."
        },
        {
            reference: "John 1:29",
            text: "The next day he saw Jesus coming toward him, and said, \"Behold, the Lamb of God, who takes away the sin of the world!\""
        },
        {
            reference: "Romans 5:8",
            text: "But God shows his love for us in that while we were still sinners, Christ died for us."
        },
        {
            reference: "1 Peter 3:18",
            text: "For Christ also suffered once for sins, the righteous for the unrighteous, that he might bring us to God, being put to death in the flesh but made alive in the spirit."
        }
    ],
    "T&T Agents of Grace - Section D: Man's Response": [
        {
            reference: "John 1:12",
            text: "But to all who did receive him, who believed in his name, he gave the right to become children of God."
        },
        {
            reference: "Acts 16:31",
            text: "And they said, \"Believe in the Lord Jesus, and you will be saved, you and your household.\""
        },
        {
            reference: "Romans 10:9",
            text: "Because, if you confess with your mouth that Jesus is Lord and believe in your heart that God raised him from the dead, you will be saved."
        },
        {
            reference: "Ephesians 2:8-9",
            text: "For by grace you have been saved through faith. And this is not your own doing; it is the gift of God, not a result of works, so that no one may boast."
        },
        {
            reference: "Romans 10:13",
            text: "For \"everyone who calls on the name of the Lord will be saved.\""
        }
    ],
    "T&T Agents of Grace - Section E: Assurance": [
        {
            reference: "John 5:24",
            text: "Truly, truly, I say to you, whoever hears my word and believes him who sent me has eternal life. He does not come into judgment, but has passed from death to life."
        },
        {
            reference: "1 John 5:13",
            text: "I write these things to you who believe in the name of the Son of God, that you may know that you have eternal life."
        },
        {
            reference: "John 10:28",
            text: "I give them eternal life, and they will never perish, and no one will snatch them out of my hand."
        },
        {
            reference: "Romans 8:38-39",
            text: "For I am sure that neither death nor life, nor angels nor rulers, nor things present nor things to come, nor powers, nor height nor depth, nor anything else in all creation, will be able to separate us from the love of God in Christ Jesus our Lord."
        },
        {
            reference: "Hebrews 13:5",
            text: "Keep your life free from love of money, and be content with what you have, for he has said, \"I will never leave you nor forsake you.\""
        }
    ]
};

// Flatten all verses for backward compatibility
const bibleVerses = Object.values(bibleVerseSections).flat();

// Global state for Bible typing
let currentVerse = null;
let currentSection = null;
let typingStartTime = null;

// Get section name for a verse index
function getSectionForIndex(index) {
    let currentIndex = 0;
    for (const [sectionName, verses] of Object.entries(bibleVerseSections)) {
        if (index >= currentIndex && index < currentIndex + verses.length) {
            return sectionName;
        }
        currentIndex += verses.length;
    }
    return "Unknown Section";
}

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

// Populate the verse selection dropdown with sections
function populateVerseDropdown() {
    const select = document.getElementById('verseSelect');
    select.innerHTML = '<option value="">-- Choose a verse --</option>';
    
    let globalIndex = 0;
    
    // Add verses organized by sections
    Object.entries(bibleVerseSections).forEach(([sectionName, verses]) => {
        // Create optgroup for section
        const optgroup = document.createElement('optgroup');
        optgroup.label = sectionName;
        
        verses.forEach(verse => {
            const option = document.createElement('option');
            option.value = globalIndex;
            option.textContent = verse.reference;
            optgroup.appendChild(option);
            globalIndex++;
        });
        
        select.appendChild(optgroup);
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
    currentSection = getSectionForIndex(index);
    displayVerse();
}

// Get random verse
window.getRandomVerse = function() {
    const randomIndex = Math.floor(Math.random() * bibleVerses.length);
    currentVerse = bibleVerses[randomIndex];
    currentSection = getSectionForIndex(randomIndex);
    
    // Update dropdown
    document.getElementById('verseSelect').value = randomIndex;
    
    displayVerse();
}

// Display the selected verse
function displayVerse() {
    if (!currentVerse) return;
    
    const display = document.getElementById('bibleVerseDisplay');
    const sectionDisplay = currentSection && !currentSection.includes("Popular") 
        ? `<div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem; font-weight: 500;">📖 ${currentSection}</div>`
        : '';
    
    display.innerHTML = `
        <div>
            ${sectionDisplay}
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

// Get random verse from a specific section
window.getRandomVerseFromSection = function(sectionName) {
    if (!bibleVerseSections[sectionName] || bibleVerseSections[sectionName].length === 0) {
        alert('Section not found or empty');
        return;
    }
    
    const sectionVerses = bibleVerseSections[sectionName];
    const randomIndex = Math.floor(Math.random() * sectionVerses.length);
    const verse = sectionVerses[randomIndex];
    
    // Find global index for dropdown
    let globalIndex = 0;
    for (const [sName, verses] of Object.entries(bibleVerseSections)) {
        if (sName === sectionName) {
            globalIndex += randomIndex;
            break;
        }
        globalIndex += verses.length;
    }
    
    currentVerse = verse;
    currentSection = sectionName;
    
    // Update dropdown
    document.getElementById('verseSelect').value = globalIndex;
    
    displayVerse();
}

// Reset Bible interface
function resetBibleInterface() {
    currentVerse = null;
    currentSection = null;
    document.getElementById('verseSelect').value = '';
    document.getElementById('bibleVerseDisplay').innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
            <div style="margin-bottom: 1rem;">📖 Select a verse to begin typing practice</div>
            <div style="font-size: 0.9rem;">
                Verses are organized by Truth & Training "Agents of Grace" sections<br>
                or choose from popular Bible verses
            </div>
        </div>
    `;
    document.getElementById('bibleInput').value = '';
    document.getElementById('bibleFeedback').innerHTML = '';
    resetStats();
}

// Export reset function for use by main dashboard
window.resetBibleInterface = resetBibleInterface;
