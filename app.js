const state = {
    quotes: [],
    flatQuotes: [],
    commonWords: {},
    filters: {
        topics: ["superman", "lila-amrita", "sb", "cc", "bgatis"],
        activeFilters: new Set()
    },
    currentResults: [] // Added to store current results for filter operations
};

const elements = {
    searchInput: document.getElementById('search'),
    loading: document.getElementById('loading'),
    results: document.getElementById('results'),
    suggestions: document.getElementById('suggestions'),
    filtersContainer: document.getElementById('filters'),
    toast: document.getElementById('toast'),
    refreshBtn: document.getElementById('refreshBtn')
};

document.addEventListener('DOMContentLoaded', () => {
    loadQuotes();
    elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
    elements.refreshBtn.addEventListener('click', refreshQuotes);
    renderFilters();
});

function refreshQuotes() {
    loadQuotes();
    showToast("Quotes refreshed successfully");
}

async function loadQuotes() {
    try {
        elements.loading.style.display = 'block';
        const response = await fetch("quotes.json?v=" + new Date().getTime());
        if (!response.ok) throw new Error(`Failed to load quotes: ${response.status}`);
        state.quotes = await response.json();
        processQuotes();
        elements.loading.style.display = 'none';
    } catch (error) {
        console.error("Error loading quotes:", error);
        elements.loading.style.display = 'none';
        elements.results.innerHTML = `<div class="error">Error loading quotes: ${error.message}</div>`;
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

        card.innerHTML = `
            <div class="statement">"${item.statement}"</div>
            <div class="ref">— ${item.ref}</div>
            <button class="copy-btn" title="Copy quote"><i class="fas fa-copy"></i></button>
        `;

        card.querySelector('.copy-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard(`"${item.statement}" — ${item.ref}`);
        });

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

function showToast(message) {
    elements.toast.textContent = message;
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
                    });
                    suggestionsList.appendChild(wordEl);
                });
                
                elements.suggestions.appendChild(suggestionsList);
                
                // Display suggestions in center of screen
                elements.suggestions.style.display = 'block';
                
                // Add click outside to close suggestions
                document.addEventListener('click', closeSuggestionsOnClickOutside);
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