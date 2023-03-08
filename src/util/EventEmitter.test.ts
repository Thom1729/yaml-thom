import { EventEmitter } from './EventEmitter';

describe(EventEmitter, () => {
  test('listeners', () => {
    class MyEmitter extends EventEmitter<{
      foo: { x: number },
    }> {}

    const emitter = new MyEmitter();

    const listener = jest.fn();
    emitter.emit('foo', { x: 0 });
    emitter.addListener('foo', listener);
    emitter.emit('foo', { x: 1 });
    emitter.emit('foo', { x: 2 });
    emitter.removeListener('foo', listener);
    emitter.emit('foo', { x: 3 });

    expect(listener.mock.calls).toEqual([
      [{ type: 'foo', x: 1 }],
      [{ type: 'foo', x: 2 }],
    ]);
  });

  test('hierarchy', () => {
    class MyEmitter extends EventEmitter<{
      foo: { x: number },
      'foo.bar': { y: 1 },
      'foo.baz': { y: 2 },
    }> {}

    const emitter = new MyEmitter();

    const fooListener = jest.fn();
    const fooBarListener = jest.fn();

    emitter.addListener('foo', fooListener);
    emitter.addListener('foo.bar', fooBarListener);

    emitter.emit('foo', { x: 1 });
    emitter.emit('foo.bar', { x: 2, y: 1 });

    expect(fooListener.mock.calls).toEqual([
      [{ type: 'foo', x: 1 }],
      [{ type: 'foo.bar', x: 2, y: 1 }],
    ]);

    expect(fooBarListener.mock.calls).toEqual([
      [{ type: 'foo.bar', x: 2, y: 1 }],
    ]);
  });
});
