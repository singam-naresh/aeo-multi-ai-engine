import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import analyzeRouter   from './routes/analyze.js';
import analyticsRouter from './routes/analytics.js';
import authRouter      from './routes/auth.js';

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('Server is running'));

app.use('/api', authRouter);
app.use('/api', analyzeRouter);
app.use('/api', analyticsRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
