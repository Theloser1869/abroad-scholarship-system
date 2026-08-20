import { ArgumentsHost, ConflictException, HttpException } from '@nestjs/common';
import { ErrorContractFilter } from './error-contract.filter';

function makeHost(req: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status };
  const host = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('ErrorContractFilter', () => {
  const filter = new ErrorContractFilter();

  it('passes through custom fields beyond code/message/details (e.g. candidates)', () => {
    const exception = new ConflictException({
      code: 'DUPLICATE_STUDENT_CANDIDATES',
      message: 'Potential existing Student(s) found.',
      candidates: [{ id: 'student-1' }],
    });
    const { host, status, json } = makeHost({ requestId: 'req-1' });
    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(409);
    const body = json.mock.calls[0][0];
    expect(body.error.code).toBe('DUPLICATE_STUDENT_CANDIDATES');
    expect(body.error.candidates).toEqual([{ id: 'student-1' }]);
  });

  it('passes through a single scalar custom field (e.g. lockedUntil)', () => {
    const lockedUntil = new Date('2026-01-01T00:00:00Z');
    const exception = new HttpException({ code: 'ACCOUNT_LOCKED', message: 'Locked.', lockedUntil }, 423);
    const { host, json } = makeHost({ requestId: 'req-2' });
    filter.catch(exception, host);
    expect(json.mock.calls[0][0].error.lockedUntil).toBe(lockedUntil);
  });

  it('still separates class-validator field errors into details, not top-level extra', () => {
    const exception = new HttpException({ message: ['field must not be empty'], error: 'Bad Request', statusCode: 400 }, 400);
    const { host, json } = makeHost({ requestId: 'req-3' });
    filter.catch(exception, host);
    const body = json.mock.calls[0][0];
    expect(body.error.details).toEqual(['field must not be empty']);
    expect(body.error.statusCode).toBeUndefined();
  });

  it('keeps the 500/unknown-error path generic (no internal state leaked)', () => {
    const { host, status, json } = makeHost({ requestId: 'req-4' });
    filter.catch(new Error('some internal failure detail'), host);
    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred.');
    expect(Object.keys(body.error)).toEqual(['code', 'message', 'requestId']);
  });

  it('always includes the requestId from the request', () => {
    const { host, json } = makeHost({ requestId: 'req-5' });
    filter.catch(new HttpException({ code: 'NOT_FOUND', message: 'gone' }, 404), host);
    expect(json.mock.calls[0][0].error.requestId).toBe('req-5');
  });
});
