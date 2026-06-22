import { app } from './app';
import { env } from './config/env';
import { prisma } from './db/prisma';

const server = app.listen(env.port, () => {
  console.log(`home-maintain-backend listening on port ${env.port}`);
});

const shutdown = (signal: NodeJS.Signals) => {
  console.log(`${signal} received; shutting down`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
