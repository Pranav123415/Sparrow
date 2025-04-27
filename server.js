const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Helper function to read and write quotes file
const quotesFilePath = path.join(__dirname, 'quotes.json');
const readQuotesFile = () => {
    try {
        const data = fs.readFileSync(quotesFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading quotes file:', error);
        return [];
    }
};

const writeQuotesFile = (quotes) => {
    try {
        fs.writeFileSync(quotesFilePath, JSON.stringify(quotes, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing quotes file:', error);
        return false;
    }
};

// Route to handle adding a new quote
app.post('/api/quotes', (req, res) => {
    try {
        const newQuote = req.body;
        
        // Read the current quotes file
        const quotes = readQuotesFile();
        
        // Add the new quote
        quotes.push(newQuote);
        
        // Write the updated quotes back to the file
        if (writeQuotesFile(quotes)) {
            res.status(200).json({ success: true, message: 'Quote added successfully' });
        } else {
            throw new Error('Failed to write quotes file');
        }
    } catch (error) {
        console.error('Error adding quote:', error);
        res.status(500).json({ success: false, message: 'Failed to add quote', error: error.message });
    }
});

// Route to handle deleting a quote
app.delete('/api/quotes/:quoteId', (req, res) => {
    try {
        const quoteId = req.params.quoteId;
        
        // Read the current quotes file
        let quotes = readQuotesFile();
        let quoteFound = false;
        
        // Find and remove the quote with the matching statement ID
        for (let i = 0; i < quotes.length; i++) {
            const quote = quotes[i];
            const statementIndex = quote.statements.findIndex(stmt => stmt.id === quoteId);
            
            if (statementIndex !== -1) {
                // Remove just this statement
                quote.statements.splice(statementIndex, 1);
                quoteFound = true;
                
                // If no statements left, remove the entire quote
                if (quote.statements.length === 0) {
                    quotes.splice(i, 1);
                }
                break;
            }
        }
        
        if (!quoteFound) {
            return res.status(404).json({ success: false, message: 'Quote not found' });
        }
        
        // Write the updated quotes back to the file
        if (writeQuotesFile(quotes)) {
            res.status(200).json({ success: true, message: 'Quote deleted successfully' });
        } else {
            throw new Error('Failed to write quotes file');
        }
    } catch (error) {
        console.error('Error deleting quote:', error);
        res.status(500).json({ success: false, message: 'Failed to delete quote', error: error.message });
    }
});

// Route to handle updating all quotes
app.post('/api/quotes/update', (req, res) => {
    try {
        const updatedQuotes = req.body;
        
        // Validate that we received an array
        if (!Array.isArray(updatedQuotes)) {
            return res.status(400).json({ success: false, message: 'Invalid data format. Expected an array of quotes.' });
        }
        
        // Write the updated quotes to the file
        if (writeQuotesFile(updatedQuotes)) {
            res.status(200).json({ success: true, message: 'Quotes updated successfully' });
        } else {
            throw new Error('Failed to write quotes file');
        }
    } catch (error) {
        console.error('Error updating quotes:', error);
        res.status(500).json({ success: false, message: 'Failed to update quotes', error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Quotes file location: ${quotesFilePath}`);
});