// backend/__tests__/helpers/http.ts
import { jest } from '@jest/globals';

export function mockReqRes(body: any = {}, params: any = {}, query: any = {}) {
  const req: any = {
    body,
    params,
    query,
    method: 'POST',
    originalUrl: '/test',
    headers: {},
    ip: '127.0.0.1',
  };

  const res: any = {
    status: jest.fn(function (this: any, _code: number) {
      return this; // chaining
    }),
    json: jest.fn((payload: any) => payload), // captura el payload
    setHeader: jest.fn(),
  };

  const next = jest.fn();
  return { req, res, next };
}
