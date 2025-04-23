const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Route to handle adding a new quote
app.post('/api/quotes', (req, res) => {
    try {
        const newQuote = req.body;
        
        // Read the current quotes file
        const quotesFilePath = path.join(__dirname, 'quotes.json');
        const quotesData = fs.readFileSync(quotesFilePath, 'utf8');
        const quotes = JSON.parse(quotesData);
        
        // Add the new quote
        quotes.push(newQuote);
        
        // Write the updated quotes back to the file with proper formatting
        fs.writeFileSync(quotesFilePath, JSON.stringify(quotes, null, 2), 'utf8');
        
        res.status(200).json({ success: true, message: 'Quote added successfully' });
    } catch (error) {
        console.error('Error adding quote:', error);
        res.status(500).json({ success: false, message: 'Failed to add quote', error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});