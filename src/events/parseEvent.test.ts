import { parseEvent } from './parseEvent';

import { CollectionStyle, NonSpecificTag, ScalarStyle } from '@/nodes';

describe(parseEvent, () => {
  test('+STR', () => {
    expect(parseEvent('+STR')).toStrictEqual({ type: '+STR' });
  });
  test('-STR', () => {
    expect(parseEvent('-STR')).toStrictEqual({ type: '-STR' });
  });

  test('+DOC', () => {
    expect(parseEvent('+DOC')).toStrictEqual({ type: '+DOC' });
    expect(parseEvent('+DOC ---')).toStrictEqual({ type: '+DOC' });
  });
  test('-DOC', () => {
    expect(parseEvent('-DOC')).toStrictEqual({ type: '-DOC' });
    expect(parseEvent('-DOC ...')).toStrictEqual({ type: '-DOC' });
  });

  test('=ALI', () => {
    expect(parseEvent('=ALI :foo')).toStrictEqual({ type: '=ALI', value: 'foo' });
  });

  test('=VAL', () => {
    expect(parseEvent('=VAL :foo')).toStrictEqual({
      type: '=VAL',
      anchor: undefined,
      tag: NonSpecificTag.question,
      style: ScalarStyle.plain,
      value: 'foo',
    });
    expect(parseEvent('=VAL &bar <baz> "foo')).toStrictEqual({
      type: '=VAL',
      anchor: 'bar',
      tag: 'baz',
      style: ScalarStyle.double,
      value: 'foo',
    });
    expect(parseEvent('=VAL "foo\\nbar')).toStrictEqual({
      type: '=VAL',
      anchor: undefined,
      tag: NonSpecificTag.exclamation,
      style: ScalarStyle.double,
      value: 'foo\nbar',
    });
  });

  test('+SEQ', () => {
    expect(parseEvent('+SEQ')).toStrictEqual({
      type: '+SEQ',
      anchor: undefined,
      tag: NonSpecificTag.question,
      style: CollectionStyle.block,
    });
    expect(parseEvent('+SEQ &bar <baz>')).toStrictEqual({
      type: '+SEQ',
      anchor: 'bar',
      tag: 'baz',
      style: CollectionStyle.block,
    });
    expect(parseEvent('+SEQ []')).toStrictEqual({
      type: '+SEQ',
      anchor: undefined,
      tag: NonSpecificTag.question,
      style: CollectionStyle.flow,
    });
  });
  test('-SEQ', () => {
    expect(parseEvent('-SEQ')).toStrictEqual({ type: '-SEQ' });
  });

  test('+MAP', () => {
    expect(parseEvent('+MAP')).toStrictEqual({
      type: '+MAP',
      anchor: undefined,
      tag: NonSpecificTag.question,
      style: CollectionStyle.block,
    });
    expect(parseEvent('+MAP &bar <baz>')).toStrictEqual({
      type: '+MAP',
      anchor: 'bar',
      tag: 'baz',
      style: CollectionStyle.block,
    });
    expect(parseEvent('+MAP {}')).toStrictEqual({
      type: '+MAP',
      anchor: undefined,
      tag: NonSpecificTag.question,
      style: CollectionStyle.flow,
    });
  });
  test('-MAP', () => {
    expect(parseEvent('-MAP')).toStrictEqual({ type: '-MAP' });
  });
});
