import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import analyzeRouter   from './routes/analyze.js';
import analyticsRouter from './routes/analytics.js';

const app  = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.send('Server is running');
});

app.use('/api', analyzeRouter);
app.use('/api', analyticsRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
