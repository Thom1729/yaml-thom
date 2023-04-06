export interface TypedRegExp<T extends string> extends RegExp {
  exec(string: string): TypedRegExpExecArray<T> | null;
}

export interface TypedRegExpExecArray<T extends string> extends RegExpExecArray {
  groups: {
    [key in T]: string
  }
}
