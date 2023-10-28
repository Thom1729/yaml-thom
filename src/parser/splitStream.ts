enum LineClass {
  empty,
  directive,
  startMarker,
  endMarker,
  other,
}

enum State {
  start,
  directives,
  body,
}

function classifyLine(line: string) {
  if (line.startsWith('%')) {
    return LineClass.directive;
  } else if (line.match(/^\s*(#|$)/)) {
    return LineClass.empty;
  } else if (line.match(/^---(\s|$)/)) {
    return LineClass.startMarker;
  } else if (line.match(/^\.\.\.(\s|$)/)) {
    return LineClass.endMarker;
  } else {
    return LineClass.other;
  }
}

export interface SplitStreamResult {
  start: number;
  end: number;
}

const STATES = {
  [State.start]: {
    [LineClass.empty      ]: [State.start     , null],
    [LineClass.directive  ]: [State.directives, null],
    [LineClass.startMarker]: [State.body      , null],
    [LineClass.endMarker  ]: [State.start     , true],
    [LineClass.other      ]: [State.body      , null],
  },
  [State.directives]: {
    [LineClass.empty      ]: [State.directives, null],
    [LineClass.directive  ]: [State.directives, null],
    [LineClass.startMarker]: [State.body      , null],
    [LineClass.endMarker  ]: [State.start     , true],
    [LineClass.other      ]: [State.directives, null],
  },
  [State.body]: {
    [LineClass.empty      ]: [State.body      , null],
    [LineClass.directive  ]: [State.body      , null],
    [LineClass.startMarker]: [State.start     , false],
    [LineClass.endMarker  ]: [State.start     , true],
    [LineClass.other      ]: [State.body      , null],
  },
} as const;

export function *splitStream(lines: Iterator<string>): Generator<SplitStreamResult> {
  let state = State.start;

  let emittedAtLeastOne = false;
  let documentStart = 0;
  let currentLine = 0;

  let it = lines.next();
  while (!it.done) {
    const [nextState, includeCurrentLine] = STATES[state][classifyLine(it.value)];
    state = nextState as State;

    if (includeCurrentLine !== null) {
      const start = documentStart;
      const end = includeCurrentLine ? currentLine + 1 : currentLine;
      emittedAtLeastOne = true;
      documentStart = end;
      yield { start, end };
    }

    it = lines.next();
    currentLine++;
  }

  if (!emittedAtLeastOne) {
    yield { start: documentStart, end: currentLine };
  }
}
