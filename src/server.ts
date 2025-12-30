import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

import authRouter from './routes/auth';

dotenv.config();

const app = express();
app.use(
  cors({
    origin: [
      'https://visitor-ten.vercel.app',
      'https://visitor-landing-five.vercel.app',
      'http://localhost:5173',
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

app.use('/api/auth', authRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
