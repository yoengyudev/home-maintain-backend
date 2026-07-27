import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import customerRoutes from '../src/routes/customer.routes';

test('customer service categories endpoint is registered', async () => {
  const app = express();
  app.use('/customer', customerRoutes);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to allocate test server port');
  }

  const port = address.port;

  try {
    const response = await fetch(`http://127.0.0.1:${port}/customer/service-categories?page=1&limit=2`);
    assert.equal(response.status, 200);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
