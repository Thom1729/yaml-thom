const BOOL_CANONICAL_FORM = new Map([
  ['true', 'true'],
  ['True', 'true'],
  ['TRUE', 'true'],
  ['false', 'false'],
  ['False', 'false'],
  ['FALSE', 'false'],
]);

const INT_EXPR = /^(?:[-+]?[0-9]+|0o[0-7]+|0x[0-9a-fA-F]+)$/;

const FLOAT_CANONICAL_FORMS = new Map([
  ['.inf', '.inf'],
  ['.Inf', '.inf'],
  ['.INF', '.inf'],
  ['-.inf', '-.inf'],
  ['-.Inf', '-.inf'],
  ['-.INF', '-.inf'],
  ['.nan', '.nan'],
  ['.NaN', '.nan'],
  ['.NAN', '.nan'],
]);

const FLOAT_EXPR = /^(?<sign>[-+])?(?:0*\.(?<decimalOnly>[0-9]+?)0*|0*(?<intPart>[0-9]+)(\.(?<decimalPart>[0-9]*?)0*)?)([eE](?<exponent>[-+]?[0-9]+))?$/;

export const CORE_TAGS = {
  'tag:yaml.org,2002:str': {
    canonicalForm(content: string) { return content; }
  },
  'tag:yaml.org,2002:null': {
    canonicalForm() { return 'null'; }
  },
  'tag:yaml.org,2002:bool': {
    canonicalForm(content: string) { return BOOL_CANONICAL_FORM.get(content) ?? null; }
  },
  'tag:yaml.org,2002:int': {
    canonicalForm(content: string) {
      if (INT_EXPR.exec(content) !== null) {
        return BigInt(content).toString();
      } else {
        return null;
      }
    }
  },
  'tag:yaml.org,2002:float': {
    // TODO
    canonicalForm(content: string) {
      const specialValue = FLOAT_CANONICAL_FORMS.get(content);
      if (specialValue !== undefined) return specialValue;

      if (!FLOAT_EXPR.test(content)) return null;

      let result = '';

      // let sign = '';
      let exponent = 0n;
      // let firstDigit = '', digits = '';

      let i = 0;

      if (content[i] === '-') {
        result = '-';
        i++;
      } else if (content[i] === '+') {
        i++;
      }

      while (content[i] === '0') i++;

      if (i >= content.length || content[i] === 'e' || content[i] === 'E') {
        return '0';
      }

      if (content[i] === '.') {
        i++;
        exponent--;

        while (content[i] === '0') {
          i++;
          exponent--;
        }

        if (i >= content.length || content[i] === 'e' || content[i] === 'E') {
          return '0';
        }

        result += content[i++];
        const start = i;
        let end = i;

        while (i < content.length && content[i] !== 'e' && content[i] !== 'E') {
          if (content[i] !== '0') end = i+1;
          i++;
        }

        result += content.slice(start, end);
      } else {
        result += content[i++];

        const wholeStart = i;

        while (i < content.length && content[i] !== '.' && content[i] !== 'e' && content[i] !== 'E') {
          i++;
          exponent++;
        }

        result += '.' + content.slice(wholeStart, i);

        if (content[i] === '.') {
          i++;
          const decimalStart = i;
          let decimalEnd = i;

          while (i < content.length && content[i] !== 'e' && content[i] !== 'E') {
            if (content[i] !== '0') decimalEnd = i+1;
            i++;
          }

          result += content.slice(decimalStart, decimalEnd);
        }
      }

      if (content[i] === 'e' || content[i] === 'E') {
        exponent += BigInt(content.slice(i+1));
      }

      if (exponent > 0) {
        result += 'e+' + exponent.toString();
      } else if (exponent < 0) {
        result += 'e' + exponent.toString();
      }

      return result;
    }
  },
};
