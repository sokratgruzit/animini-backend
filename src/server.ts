import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

import authRouter from './routes/auth';
import walletRouter from './routes/wallet';
import { initTransactionWorker } from './workers/transaction-worker';

dotenv.config();

const app = express();
app.use(
  cors({
    origin: ['http://localhost:5173'],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/wallet', walletRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  initTransactionWorker();

  console.log(`Server started on http://localhost:${PORT}`);
  console.log('Transaction background worker initialized');
});
