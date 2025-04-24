const state = {
    quotes: [],
    flatQuotes: [],
    commonWords: {},
    filters: {
        topics: ["superman", "lila-amrita", "sb", "cc", "bgatis"],
        activeFilters: new Set()
    },
    currentResults: [], // Store current results for filter operations
    auth: {
        isAuthenticated: false,
        validUsername: 'MohanaKrishnaDasa',
        validPassword: 'AGTSP'
    },
    deletedQuotes: [], // Store deleted quotes for undo functionality
    isProcessing: false // Flag to prevent duplicate processing
};

const elements = {
    searchInput: document.getElementById('search'),
    loading: document.getElementById('loading'),
    results: document.getElementById('results'),
    suggestions: document.getElementById('suggestions'),
    filtersContainer: document.getElementById('filters'),
    toast: document.getElementById('toast'),
    refreshBtn: document.getElementById('refreshBtn'),
    // Quote management elements
    addQuoteBtn: document.getElementById('addQuoteBtn'),
    quoteModal: document.getElementById('quoteModal'),
    quoteForm: document.getElementById('quoteForm'),
    closeModal: document.querySelector('.close-modal'),
    // Authentication elements
    loginSection: document.getElementById('loginSection'),
    loginBtn: document.getElementById('loginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    username: document.getElementById('username'),
    password: document.getElementById('password'),
    // Undo functionality
    undoBtn: document.getElementById('undoBtn')
};

// Function to show toast messages
function showToast(message, type = '') {
    const toast = elements.toast;
    toast.textContent = message;
    toast.className = 'toast';
    
    if (type === 'error') {
        toast.classList.add('error');
    }
    
    toast.style.opacity = '1';
    
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    loadQuotes();
    elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
    elements.refreshBtn.addEventListener('click', refreshQuotes);
    renderFilters();
    
    // Add quote modal functionality
    elements.addQuoteBtn.addEventListener('click', openQuoteModal);
    elements.closeModal.addEventListener('click', closeQuoteModal);
    elements.quoteForm.addEventListener('submit', handleQuoteSubmission);
    
    // Authentication event listeners
    elements.loginBtn.addEventListener('click', handleLogin);
    elements.logoutBtn.addEventListener('click', handleLogout);
    
    // Undo functionality
    if (elements.undoBtn) {
        elements.undoBtn.addEventListener('click', handleUndo);
        // Initially hide the undo button
        elements.undoBtn.style.display = 'none';
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === elements.quoteModal) {
            closeQuoteModal();
        }
    });
    
    // Add click event listeners to suggestion words
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-word')) {
            const word = e.target.textContent.trim();
            elements.searchInput.value = word;
            handleSearch();
            elements.suggestions.style.display = 'none';
        }
    });
    
    // Check if user is already authenticated (from session storage)
    checkAuthStatus();
});

// Add these functions for the quote modal
function openQuoteModal() {
    // Make sure the modal is visible
    elements.quoteModal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent scrolling
    
    // Show appropriate section based on authentication status
    if (state.auth.isAuthenticated) {
        elements.loginSection.style.display = 'none';
        elements.quoteForm.style.display = 'block';
    } else {
        elements.loginSection.style.display = 'block';
        elements.quoteForm.style.display = 'none';
    }
    
    // Reset form fields if authenticated
    if (state.auth.isAuthenticated) {
        elements.quoteForm.reset();
    }
}

function closeQuoteModal() {
    elements.quoteModal.style.display = 'none';
    document.body.style.overflow = 'auto'; // Re-enable scrolling
    elements.quoteForm.reset(); // Clear the form
    elements.username.value = '';
    elements.password.value = '';
}

// Authentication functions
function handleLogin(e) {
    e.preventDefault();
    
    const username = elements.username.value.trim();
    const password = elements.password.value.trim();
    
    if (username === state.auth.validUsername && password === state.auth.validPassword) {
        state.auth.isAuthenticated = true;
        sessionStorage.setItem('isAuthenticated', 'true');
        
        // Show quote form, hide login section
        elements.loginSection.style.display = 'none';
        elements.quoteForm.style.display = 'block';
        
        showToast('Login successful!');
    } else {
        showToast('Invalid username or password!');
    }
}

function handleLogout() {
    state.auth.isAuthenticated = false;
    sessionStorage.removeItem('isAuthenticated');
    
    // Show login section, hide quote form
    elements.loginSection.style.display = 'block';
    elements.quoteForm.style.display = 'none';
    
    showToast('Logged out successfully!');
}

function checkAuthStatus() {
    const isAuthenticated = sessionStorage.getItem('isAuthenticated');
    if (isAuthenticated === 'true') {
        state.auth.isAuthenticated = true;
    }
}

function handleQuoteSubmission(e) {
    e.preventDefault();
    
    // Check if user is authenticated
    if (!state.auth.isAuthenticated) {
        showToast('You must be logged in to add quotes!', 'error');
        return;
    }
    
    // Get form values
    const statement = document.getElementById('quoteStatement').value.trim();
    const reference = document.getElementById('quoteReference').value.trim();
    const speaker = document.getElementById('quoteSpeaker').value.trim();
    const category = document.getElementById('quoteCategory').value;
    const keywords = document.getElementById('quoteKeywords').value.trim()
        .split(',')
        .map(keyword => keyword.trim())
        .filter(keyword => keyword.length > 0);
    
    // Validate required fields
    if (!statement) {
        showToast('Please enter a quote statement', 'error');
        return;
    }
    
    if (!reference) {
        showToast('Please enter a reference', 'error');
        return;
    }
    
    // Create tags based on category
    const tags = [];
    if (category !== 'general') {
        tags.push(`quotecard:${category}`);
    }
    
    // Add keywords as tags
    keywords.forEach(keyword => {
        if (!tags.includes(keyword)) {
            tags.push(keyword);
        }
    });
    
    // Create the new quote object
    const newQuote = {
        ref: reference,
        speaker: speaker,
        date: extractDateFromReference(reference),
        location: extractLocationFromReference(reference),
        lecture: extractLectureFromReference(reference),
        statements: [
            {
                statement: statement,
                tags: tags,
                keywords: keywords,
                id: generateUniqueId()
            }
        ]
    };
    
    // Add to local state and save to quotes.json
    addQuoteToLocalState(newQuote);
    saveQuoteToFile(newQuote);
    
    // Close the modal and show success message
    closeQuoteModal();
    // Note: Success toast is now shown in saveQuoteToFile function
}

// Helper functions for quote submission
function extractDateFromReference(ref) {
    const dateMatch = ref.match(/\b(19|20)\d{2}\b/);
    return dateMatch ? dateMatch[0] : "";
}

function extractLocationFromReference(ref) {
    const commonLocations = ["New York", "London", "Mayapur", "Vrindavan", "Bombay", "Los Angeles", "Tokyo"];
    for (const location of commonLocations) {
        if (ref.includes(location)) {
            return location;
        }
    }
    return "";
}

function extractLectureFromReference(ref) {
    const lectureMatch = ref.match(/lecture on (.+?)(?=\s+in\s+|$)/i);
    return lectureMatch ? lectureMatch[0] : "";
}

function generateUniqueId() {
    return 'quote_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function addQuoteToLocalState(newQuote) {
    // Prevent duplicate processing
    if (state.isProcessing) return;
    state.isProcessing = true;
    
    try {
        // Add to state.quotes
        state.quotes.push(newQuote);
        
        // Process the quote to add to flatQuotes
        const scriptureInfo = extractScriptureInfo(newQuote.ref);
        
        newQuote.statements.forEach((item, index) => {
            const topics = [];
            
            if (item.tags && Array.isArray(item.tags)) {
                item.tags.forEach(tag => {
                    let normalizedTag = tag;
                    if (tag.includes("superman")) normalizedTag = "superman";
                    if (tag.includes("lila-amrita")) normalizedTag = "lila-amrita";
                    if (tag.toLowerCase().includes("sb")) normalizedTag = "sb";
                    if (tag.toLowerCase().includes("cc")) normalizedTag = "cc";
                    if (tag.toLowerCase().includes("bgatis")) normalizedTag = "bgatis";
                    
                    topics.push(normalizedTag);
                    addWordToMap(normalizedTag, state.commonWords);
                });
            }
            
            if (item.keywords && Array.isArray(item.keywords)) {
                item.keywords.forEach(keyword => {
                    topics.push(keyword);
                    addWordToMap(keyword, state.commonWords);
                });
            }
            
            // Add to flatQuotes
            state.flatQuotes.push({
                ...item,
                ref: newQuote.ref,
                topics: topics,
                scriptureCode: scriptureInfo.scriptureCode,
                chapter: scriptureInfo.chapter,
                verse: scriptureInfo.verse,
                speaker: newQuote.speaker || "",
                lecture: newQuote.lecture || ""
            });
            
            // Add words to commonWords
            const words = item.statement.toLowerCase().split(/\W+/).filter(w => w.length > 3);
            words.forEach(word => addWordToMap(word, state.commonWords));
        });
        
        // Update current results and render
        state.currentResults = state.flatQuotes;
        renderResults(state.flatQuotes);
        
        // Save to localStorage for persistence
        saveQuotesToLocalStorage();
    } finally {
        state.isProcessing = false;
    }
}

// Add this function to save quotes to localStorage
function saveQuotesToLocalStorage() {
    try {
        localStorage.setItem('prabhupada_quotes', JSON.stringify(state.quotes));
    } catch (error) {
        console.error("Error saving quotes to localStorage:", error);
    }
}

// Load quotes from localStorage or server
async function loadQuotes() {
    try {
        elements.loading.style.display = 'block';
        
        // Clear existing data to prevent duplicates
        state.quotes = [];
        state.flatQuotes = [];
        state.commonWords = {};
        
        // Try to load from localStorage first
        const savedQuotes = localStorage.getItem('prabhupada_quotes');
        if (savedQuotes) {
            state.quotes = JSON.parse(savedQuotes);
            processQuotes();
            elements.loading.style.display = 'none';
            return;
        }
        
        // If no localStorage data, fetch from file
        const response = await fetch("quotes.json?v=" + new Date().getTime());
        if (!response.ok) throw new Error(`Failed to load quotes: ${response.status}`);
        state.quotes = await response.json();
        processQuotes();
        
        // Save to localStorage for future use
        saveQuotesToLocalStorage();
        
        elements.loading.style.display = 'none';
    } catch (error) {
        console.error("Error loading quotes:", error);
        elements.loading.style.display = 'none';
        elements.results.innerHTML = `<div class="error">Error loading quotes: ${error.message}</div>`;
    }
}

// Function to save quote to quotes.json file
async function saveQuoteToFile(newQuote) {
    try {
        elements.loading.style.display = 'block';
        
        try {
            // Try to send the new quote to our server endpoint to update quotes.json
            const response = await fetch('/api/quotes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newQuote),
                // Add a timeout to prevent long waiting times if server is not available
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save quote');
            }
            
            console.log('Quote saved successfully to server!');
        } catch (serverError) {
            console.warn("Could not save to server, using local storage fallback:", serverError);
            // Server-side saving failed, but we'll continue with local storage
        }
        
        // Always update local state regardless of server response
        state.quotes.push(newQuote);
        saveQuotesToLocalStorage();
        
        // Refresh the quotes display
        processQuotes();
        
        elements.loading.style.display = 'none';
        showToast("Quote added successfully!");
    } catch (error) {
        console.error("Error saving quote:", error);
        elements.loading.style.display = 'none';
        showToast("Error saving quote. Please try again.", "error");
    }
}

function processQuotes() {
    state.flatQuotes = [];
    const topicSet = new Set(["superman", "lila-amrita", "sb", "cc", "bgatis"]);
    const wordMap = {};

    state.quotes.forEach(entry => {
        const scriptureInfo = extractScriptureInfo(entry.ref);

        entry.statements.forEach((item, index) => {
            if (!item.id) item.id = entry.ref.replace(/\s+/g, '') + "-" + index;

            const topics = [];
            if (item.tags && Array.isArray(item.tags)) {
                item.tags.forEach(tag => {
                    // Normalize tag names to remove emojis and spaces
                    let normalizedTag = tag;
                    if (tag.includes("Superman")) normalizedTag = "superman";
                    if (tag.includes("Lila-Amrita")) normalizedTag = "lila-amrita";
                    if (tag.toLowerCase().includes("sb")) normalizedTag = "sb";
                    if (tag.toLowerCase().includes("cc")) normalizedTag = "cc";
                    if (tag.toLowerCase().includes("bgatis")) normalizedTag = "bgatis";

                    topics.push(normalizedTag);
                    topicSet.add(normalizedTag);
                    addWordToMap(normalizedTag, wordMap);
                });
            }
            if (item.keywords && Array.isArray(item.keywords)) {
                item.keywords.forEach(keyword => {
                    topics.push(keyword);
                    topicSet.add(keyword);
                    addWordToMap(keyword, wordMap);
                });
            }

            // Automatically tag quotes based on scriptureCode
            if (scriptureInfo.scriptureCode === "SB") {
                topics.push("sb");
                topicSet.add("sb");
            } else if (scriptureInfo.scriptureCode === "CC") {
                topics.push("cc");
                topicSet.add("cc");
            } else if (scriptureInfo.scriptureCode === "BG") {
                topics.push("bgatis");
                topicSet.add("bgatis");
            }

            state.flatQuotes.push({
                ...item,
                ref: entry.ref,
                topics: topics,
                scriptureCode: scriptureInfo.scriptureCode,
                chapter: scriptureInfo.chapter,
                verse: scriptureInfo.verse,
                speaker: entry.speaker || "",
                lecture: entry.lecture || ""
            });

            const words = item.statement.toLowerCase().split(/\W+/).filter(w => w.length > 3);
            words.forEach(word => addWordToMap(word, wordMap));
        });
    });

    state.filters.topics = Array.from(topicSet).sort();
    state.commonWords = wordMap;
    renderFilters();
    state.currentResults = state.flatQuotes; // Store initial results
    renderResults(state.flatQuotes);
}

function addWordToMap(word, map) {
    word = word.toLowerCase().trim();
    if (word.length > 2) {
        map[word] = (map[word] || 0) + 1;
    }
}

function extractScriptureInfo(ref) {
    const info = { scriptureCode: "", chapter: "", verse: "" };

    const scripturePatterns = [
        { pattern: /\bBG\b|Bhagavad-gītā|Bhagavad-gita/i, code: "BG" },
        { pattern: /\bSB\b|Śrīmad-Bhāgavatam|Srimad-Bhagavatam/i, code: "SB" },
        { pattern: /\bCC\b|Caitanya-caritāmṛta|Caitanya-caritamrta/i, code: "CC" },
        { pattern: /\bNOD\b|Nectar of Devotion/i, code: "NOD" },
        { pattern: /\bISO\b|Īśopaniṣad|Isopanisad/i, code: "ISO" }
    ];

    for (const pattern of scripturePatterns) {
        if (pattern.pattern.test(ref)) {
            info.scriptureCode = pattern.code;
            break;
        }
    }

    const chapterVersePattern = /(\d+)\.(\d+)/;
    const chapterVerseMatch = ref.match(chapterVersePattern);

    if (chapterVerseMatch) {
        info.chapter = chapterVerseMatch[1];
        info.verse = chapterVerseMatch[2];
    } else {
        const chapterPattern = /chapter (\d+)|lecture on .* (\d+)/i;
        const chapterMatch = ref.match(chapterPattern);
        if (chapterMatch) info.chapter = chapterMatch[1] || chapterMatch[2];
    }

    return info;
}

function renderFilters() {
    elements.filtersContainer.innerHTML = '';

    // Text labels for display with new filter names
    const filterLabels = {
        "superman": "Superman 🦸‍♂️", 
        "lila-amrita": "🔥 The Empowered Ācārya 🔥", 
        "sb": "Śrīmad Bhāgavatam",
        "cc": "Śrī Caitanya-caritāmṛta",
        "bgatis": "Bhagavad-gītā As It Is"
    };

    // Primary filters in preferred order
    const primaryFilters = ["lila-amrita", "sb", "cc", "bgatis", "superman"];

    primaryFilters.forEach(topic => {
        const chip = document.createElement('div');
        chip.className = 'filter-chip';
        chip.textContent = filterLabels[topic] || topic;
        chip.dataset.topic = topic;

        if (state.filters.activeFilters.has(topic)) chip.classList.add('active');

        chip.addEventListener('click', () => {
            if (state.filters.activeFilters.has(topic)) {
                state.filters.activeFilters.delete(topic);
                chip.classList.remove('active');
            } else {
                state.filters.activeFilters.add(topic);
                chip.classList.add('active');
            }
            
            // When a filter is clicked, we need to filter quotes by both:
            // 1. The topic (for search functionality)
            // 2. The corresponding card class (for visual styling)
            filterQuotesByClassAndTopic();
        });

        elements.filtersContainer.appendChild(chip);
    });
}

// New function to filter quotes by both class and topic
function filterQuotesByClassAndTopic() {
    const searchTerm = elements.searchInput.value.trim();
    let results = [];
    
    if (state.filters.activeFilters.size === 0) {
        // If no filters active, show all quotes or search results
        results = searchTerm ? enhancedSearch(searchTerm) : state.flatQuotes;
    } else {
        // Filter quotes based on active filters
        let filteredQuotes = state.flatQuotes;
        
        // If there's a search term, start with those results instead
        if (searchTerm) {
            filteredQuotes = enhancedSearch(searchTerm);
        }
        
        // Then filter by the active filter topics
        results = filteredQuotes.filter(quote => {
            // Check if quote has tags that match any active filter
            if (quote.tags && Array.isArray(quote.tags)) {
                // Map filters to their corresponding card classes
                const filterToClass = {
                    "superman": "superman",
                    "lila-amrita": "lila-amrita",
                    "sb": "sb",
                    "cc": "cc",
                    "bgatis": "bgatis"
                };
                
                // Check if any active filter matches this quote's tags
                return Array.from(state.filters.activeFilters).some(filter => {
                    const classToCheck = filterToClass[filter];
                    
                    // Check for both quotecard:class and quote-card:class formats
                    return quote.tags.some(tag => 
                        tag.toLowerCase().includes(`quotecard:${classToCheck}`) || 
                        tag.toLowerCase().includes(`quote-card:${classToCheck}`) ||
                        (filter === "superman" && tag.toLowerCase().includes("superman"))
                    );
                });
            }
            return false;
        });
    }
    
    state.currentResults = results;
    renderResults(results);
}

// Function to handle quote deletion
function deleteQuote(quoteId) {
    // Check if user is authenticated
    if (!state.auth.isAuthenticated) {
        showToast('You must be logged in to delete quotes!', 'error');
        return;
    }
    
    // Find the quote in flatQuotes
    const quoteIndex = state.flatQuotes.findIndex(quote => quote.id === quoteId);
    if (quoteIndex === -1) {
        showToast('Quote not found!', 'error');
        return;
    }
    
    // Store the deleted quote for undo functionality
    const deletedQuote = state.flatQuotes[quoteIndex];
    state.deletedQuotes.push({
        quote: deletedQuote,
        timestamp: Date.now()
    });
    
    // Remove from flatQuotes
    state.flatQuotes.splice(quoteIndex, 1);
    
    // Find and remove from quotes array
    const quoteRef = deletedQuote.ref;
    const statementId = deletedQuote.id;
    
    for (let i = 0; i < state.quotes.length; i++) {
        const quote = state.quotes[i];
        if (quote.ref === quoteRef) {
            // Find the statement within this quote
            const statementIndex = quote.statements.findIndex(stmt => stmt.id === statementId);
            if (statementIndex !== -1) {
                // Remove just this statement
                quote.statements.splice(statementIndex, 1);
                
                // If no statements left, remove the entire quote
                if (quote.statements.length === 0) {
                    state.quotes.splice(i, 1);
                }
                break;
            }
        }
    }
    
    // Update current results and render
    state.currentResults = state.flatQuotes;
    renderResults(state.flatQuotes);
    
    // Save to localStorage
    saveQuotesToLocalStorage();
    
    // Save to server
    saveQuotesToServer();
    
    // Show undo button
    if (elements.undoBtn) {
        elements.undoBtn.style.display = 'block';
        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (state.deletedQuotes.length > 0) {
                const oldestDeletion = state.deletedQuotes[0].timestamp;
                const now = Date.now();
                if (now - oldestDeletion > 10000) {
                    state.deletedQuotes.shift(); // Remove oldest deletion
                }
                if (state.deletedQuotes.length === 0) {
                    elements.undoBtn.style.display = 'none';
                }
            }
        }, 10000);
    }
    
    showToast('Quote deleted successfully!');
}

// Function to handle undo of quote deletion
function handleUndo() {
    if (state.deletedQuotes.length === 0) {
        showToast('Nothing to undo!', 'error');
        return;
    }
    
    // Get the most recently deleted quote
    const deletedItem = state.deletedQuotes.pop();
    const deletedQuote = deletedItem.quote;
    
    // Find if the quote reference already exists
    let quoteExists = false;
    let existingQuoteIndex = -1;
    
    for (let i = 0; i < state.quotes.length; i++) {
        if (state.quotes[i].ref === deletedQuote.ref) {
            quoteExists = true;
            existingQuoteIndex = i;
            break;
        }
    }
    
    // Create statement object
    const statement = {
        statement: deletedQuote.statement,
        tags: deletedQuote.tags || [],
        keywords: deletedQuote.keywords || [],
        id: deletedQuote.id
    };
    
    if (quoteExists) {
        // Add statement to existing quote
        state.quotes[existingQuoteIndex].statements.push(statement);
    } else {
        // Create new quote object
        const newQuote = {
            ref: deletedQuote.ref,
            speaker: deletedQuote.speaker || "",
            date: deletedQuote.date || "",
            location: deletedQuote.location || "",
            lecture: deletedQuote.lecture || "",
            statements: [statement]
        };
        state.quotes.push(newQuote);
    }
    
    // Add back to flatQuotes
    state.flatQuotes.push(deletedQuote);
    
    // Update current results and render
    state.currentResults = state.flatQuotes;
    renderResults(state.flatQuotes);
    
    // Save to localStorage
    saveQuotesToLocalStorage();
    
    // Save to server
    saveQuotesToServer();
    
    // Hide undo button if no more deleted quotes
    if (state.deletedQuotes.length === 0 && elements.undoBtn) {
        elements.undoBtn.style.display = 'none';
    }
    
    showToast('Quote restored successfully!');
}

// Function to save quotes to server
async function saveQuotesToServer() {
    try {
        elements.loading.style.display = 'block';
        
        // Send the updated quotes to our server endpoint
        const response = await fetch('/api/quotes/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(state.quotes)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to save quotes');
        }
        
        elements.loading.style.display = 'none';
        console.log('Quotes saved successfully to server!');
    } catch (error) {
        console.error("Error saving quotes to server:", error);
        elements.loading.style.display = 'none';
        showToast("Error saving changes to server. Your changes are saved locally.", "error");
    }
}

function renderResults(data) {
    elements.results.innerHTML = "";

    if (data.length === 0) {
        elements.results.innerHTML = "<div class='no-results'>No matching quotes found</div>";
        return;
    }

    data.forEach(item => {
        const card = document.createElement("div");
        card.className = "quote-card";

        // Apply appropriate class based on tags
        if (item.tags && Array.isArray(item.tags)) {
            // Check for specific tags with more flexible matching
            if (item.tags.some(tag => 
                tag.toLowerCase().includes("quotecard:bgatis") || 
                tag.toLowerCase().includes("quote-card:bgatis") ||
                tag.toLowerCase().includes("quotecard:bgats")
            )) {
                card.classList.add("bgatis");
            } else if (item.tags.some(tag => 
                tag.toLowerCase().includes("quotecard:sb") || 
                tag.toLowerCase().includes("quote-card:sb")
            )) {
                card.classList.add("sb");
            } else if (item.tags.some(tag => 
                tag.toLowerCase().includes("quotecard:cc") || 
                tag.toLowerCase().includes("quote-card:cc")
            )) {
                card.classList.add("cc");
            } else if (item.tags.some(tag => 
                tag.toLowerCase().includes("quotecard:lila-amrita") || 
                tag.toLowerCase().includes("quote-card:lila-amrita")
            )) {
                card.classList.add("lila-amrita");
            } else if (item.tags.some(tag => 
                tag.toLowerCase().includes("superman")
            )) {
                card.classList.add("superman");
            }
            // If no specific quotecard tag is found, use default yellow accent
        }

        // Create HTML structure with delete button for authenticated users
        let cardHTML = `
            <div class="statement">"${item.statement}"</div>
            <div class="ref">— ${item.ref}</div>
            <div class="quote-actions">
                <button class="copy-btn" title="Copy quote"><i class="fas fa-copy"></i></button>
        `;
        
        // Add delete button if user is authenticated
        if (state.auth.isAuthenticated) {
            cardHTML += `<button class="delete-btn" title="Delete quote"><i class="fas fa-trash"></i></button>`;
        }
        
        cardHTML += `</div>`;
        card.innerHTML = cardHTML;

        // Add event listener for copy button
        card.querySelector('.copy-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard(`"${item.statement}" — ${item.ref}`);
        });
        
        // Add event listener for delete button if it exists
        const deleteBtn = card.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this quote?')) {
                    deleteQuote(item.id);
                }
            });
        }

        elements.results.appendChild(card);
    });
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => showToast("Quote copied to clipboard"))
        .catch(err => {
            console.error('Failed to copy text: ', err);
            showToast("Failed to copy quote");
        });
}

function showToast(message, type = 'success') {
    elements.toast.textContent = message;
    elements.toast.className = 'toast'; // Reset classes
    if (type === 'error') {
        elements.toast.classList.add('error');
    }
    elements.toast.style.opacity = 1;

    setTimeout(() => {
        elements.toast.style.opacity = 0;
    }, 3000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}


function handleSearch() {
    const searchTerm = elements.searchInput.value.trim();
    elements.suggestions.innerHTML = '';
    elements.suggestions.style.display = 'none'; // Hide suggestions by default

    if (!searchTerm) {
        // If no search term, show filtered results if filters are active, otherwise show all
        if (state.filters.activeFilters.size > 0) {
            filterQuotesByClassAndTopic();
        } else {
            state.currentResults = state.flatQuotes;
            renderResults(state.flatQuotes);
        }
        return;
    }

    // Get search results
    const results = enhancedSearch(searchTerm);
    
    // Show suggestions for similar words if no results found
    if (results.length === 0) {
        const words = searchTerm.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        
        if (words.length > 0) {
            const similarWords = words.flatMap(word => findSimilarWords(word));
            
            if (similarWords.length > 0) {
                // Create suggestions container
                elements.suggestions.innerHTML = '<div class="suggestion-title">Did you mean:</div>';
                const suggestionsList = document.createElement('div');
                suggestionsList.className = 'suggestions-list';
                
                // Add each suggestion word
                similarWords.forEach(word => {
                    const wordEl = document.createElement('span');
                    wordEl.className = 'suggestion-word';
                    wordEl.textContent = word;
                    wordEl.addEventListener('click', () => {
                        elements.searchInput.value = word;
                        handleSearch();
                        // Close suggestions after selection
                        elements.suggestions.style.display = 'none';
                    });
                    suggestionsList.appendChild(wordEl);
                });
                
                elements.suggestions.appendChild(suggestionsList);
                
                // Display suggestions in center of screen
                elements.suggestions.style.display = 'block';
                
                // Add click outside to close suggestions
                document.addEventListener('click', closeSuggestionsOnClickOutside);
                
                // Add touch event for mobile
                document.addEventListener('touchstart', closeSuggestionsOnClickOutside);
            }
        }
    }

    // Add this function after handleSearch
    function closeSuggestionsOnClickOutside(event) {
        if (elements.suggestions.style.display === 'block' && 
            !elements.suggestions.contains(event.target) && 
            event.target !== elements.searchInput) {
            elements.suggestions.style.display = 'none';
            document.removeEventListener('click', closeSuggestionsOnClickOutside);
        }
    }

    // Apply active filters to search results if needed
    if (state.filters.activeFilters.size > 0) {
        const filteredResults = results.filter(quote => {
            if (quote.tags && Array.isArray(quote.tags)) {
                const filterToClass = {
                    "superman": "superman",
                    "lila-amrita": "lila-amrita",
                    "sb": "sb",
                    "cc": "cc",
                    "bgatis": "bgatis"
                };
                
                return Array.from(state.filters.activeFilters).some(filter => {
                    const classToCheck = filterToClass[filter];
                    
                    return quote.tags.some(tag => 
                        tag.toLowerCase().includes(`quotecard:${classToCheck}`) || 
                        tag.toLowerCase().includes(`quote-card:${classToCheck}`) ||
                        (filter === "superman" && tag.toLowerCase().includes("superman"))
                    );
                });
            }
            return false;
        });
        
        state.currentResults = filteredResults;
        renderResults(filteredResults);
    } else {
        state.currentResults = results;
        renderResults(results);
    }
}

function findSimilarWords(word) {
    word = word.toLowerCase();
    if (word.length < 3) return [];

    const allWords = Object.keys(state.commonWords).filter(w => w.length >= 3);
    return allWords
        .map(w => ({
            word: w,
            similarity: calculateSimilarity(word, w),
            frequency: state.commonWords[w]
        }))
        .filter(item => item.similarity > 0.6)
        .sort((a, b) => b.similarity - a.similarity || b.frequency - a.frequency)
        .slice(0, 3)
        .map(item => item.word);
}

function calculateSimilarity(s1, s2) {
    if (s1 === s2) return 1.0;
    if (s1.length < 2 || s2.length < 2) return 0.0;

    if (s1.includes(s2) || s2.includes(s1)) {
        return 0.8;
    }

    let longer = s1, shorter = s2;
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }

    const editDistance = levenshteinDistance(s1, s2);
    return (longer.length - editDistance) / parseFloat(longer.length);
}

function levenshteinDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) costs[j] = j;
            else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(i - 1) !== s2.charAt(j - 1))
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

// Add this function after the levenshteinDistance function

function extractPhrases(query) {
    const phrases = [];
    const phraseRegex = /"([^"]*)"/g;
    let match;

    while ((match = phraseRegex.exec(query)) !== null) {
        phrases.push(match[1].toLowerCase());
    }

    return phrases;
}

// Function to refresh quotes from the server
async function refreshQuotes() {
    try {
        elements.loading.style.display = 'block';
        
        // Clear localStorage to force a fresh fetch
        localStorage.removeItem('prabhupada_quotes');
        
        // Clear existing data to prevent duplicates
        state.quotes = [];
        state.flatQuotes = [];
        state.commonWords = {};
        
        // Fetch from file with cache-busting parameter
        const response = await fetch("quotes.json?v=" + new Date().getTime());
        if (!response.ok) throw new Error(`Failed to load quotes: ${response.status}`);
        
        state.quotes = await response.json();
        processQuotes();
        
        // Save to localStorage for future use
        saveQuotesToLocalStorage();
        
        elements.loading.style.display = 'none';
        showToast('Quotes refreshed successfully!');
    } catch (error) {
        console.error("Error refreshing quotes:", error);
        elements.loading.style.display = 'none';
        showToast("Error refreshing quotes. Please try again.", "error");
    }
}

function enhancedSearch(query) {
    query = query.toLowerCase();
    let keywords = [];
    let phrases = extractPhrases(query);
    
    const remainingQuery = query.replace(/"([^"]*)"/g, '').trim();
    keywords = remainingQuery.split(/\s+/).filter(k => k.length > 0);

    let quotesToSearch = state.flatQuotes;
    if (state.filters.activeFilters.size > 0) {
        quotesToSearch = state.flatQuotes.filter(quote =>
            quote.topics && quote.topics.some(topic =>
                state.filters.activeFilters.has(topic)
            )
        );
    }

    const scriptureReferencePattern = /^(bg|sb|cc|iso)\s*(\d+)(?:\.(\d+))?$/i;
    const scriptureRefMatch = query.match(scriptureReferencePattern);

    if (scriptureRefMatch) {
        const scriptureCode = scriptureRefMatch[1].toUpperCase();
        const chapter = scriptureRefMatch[2];
        const verse = scriptureRefMatch[3] || "";

        return quotesToSearch.filter(quote => {
            if (quote.scriptureCode === scriptureCode) {
                if (verse) return quote.chapter === chapter && quote.verse === verse;
                else return quote.chapter === chapter;
            }
            return false;
        });
    }

    return quotesToSearch
        .map(quote => {
            const statement = quote.statement.toLowerCase();
            const refText = quote.ref.toLowerCase();
            let score = 0;

            if (refText.includes(query)) score += 15;
            if (quote.scriptureCode && query.toUpperCase() === quote.scriptureCode) score += 15;
            
            phrases.forEach(phrase => {
                if (statement.includes(phrase)) score += 10;
            });

            keywords.forEach(keyword => {
                const wordRegex = new RegExp(`\\b${keyword}\\b`, 'i');
                if (wordRegex.test(statement)) score += 3;
                else if (statement.includes(keyword)) score += 1;
                if (refText.includes(keyword)) score += 4;
                if (quote.speaker && quote.speaker.toLowerCase().includes(keyword)) score += 3;
                if (quote.lecture && quote.lecture.toLowerCase().includes(keyword)) score += 3;
            });

            if (statement.includes(remainingQuery)) score += 5;

            if (quote.tags) {
                [...keywords, ...phrases].forEach(term => {
                    if (quote.tags.some(tag => tag.toLowerCase().includes(term))) score += 2;
                });
            }

            if (quote.keywords) {
                [...keywords, ...phrases].forEach(term => {
                    if (quote.keywords.some(k => k.toLowerCase().includes(term))) score += 2;
                });
            }

            return { ...quote, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);
}