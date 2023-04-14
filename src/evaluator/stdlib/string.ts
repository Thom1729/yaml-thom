import { assertNoArgs, type Library } from './util';
import { str, extractStrContent, extractSeqItems } from '../helpers';
import { simpleAnnotation, specs } from '../signature';

export default {
  uppercase: simpleAnnotation(specs.str, [], value => str(value.content.toUpperCase())),
  lowercase: simpleAnnotation(specs.str, [], value => str(value.content.toLowerCase())),

  join(value, args) {
    assertNoArgs(args); // TODO support optional delimiter
    return str(extractSeqItems(value).map(extractStrContent).join(''));
  },
} satisfies Library;
