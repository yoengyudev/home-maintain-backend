import cors from 'cors';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.clientOrigins, credentials: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json());

app.get('/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'home-maintain-backend',
  });
});

const notFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json({
    error: 'Not Found',
    path: request.originalUrl,
  });
};

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'Internal Server Error' });
};

app.use(notFoundHandler);
app.use(errorHandler);
