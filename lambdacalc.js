export const defineMode = function(CodeMirror) {
CodeMirror.defineMode("lambdacalc", function(_config, modeConfig) {
  // Modes for different types of symbols
  const DEFNAME = "variable-2";
  const EQUALS = "text";
  const BRACKETS = "bracket";
  const LAMBDA = "keyword";
  const DOT = LAMBDA;
  const PREDEF = "text";
  const BOUND = "text";
  const ARGS = "def";
  const HOLE = "atom";
  const NUMBER = "number";
  const EMPTY = "text";
  const UNDEF = "error";
  const REDEF = "variable-3";
  const SUPPRESS = "text";
  const FAIL = "error";

  const defName = /[a-zA-Z][a-zA-Z0-9_\-']*/
  const assign = /=/
  const brack = /\(|\)/
  const lamArg = /[a-zA-Z_][a-zA-Z0-9_\-']*|\./
  const numconst = /\d+/

  function expectDefOrTerm(stream, state) {
    if (stream.match(/.*=/, false)) return expectDef(stream, state);
    else return expectTerm(stream, state);
  }

  function expectDef(stream, state) {
    const name = (stream.match(defName)||[])[0];
    state.f = expectAssign;
    if (!name || !(stream.match(/\s*=/, false))) return null;
    const res = [];
    if (state.defined.includes(name)) res.push(REDEF);
    state.defined.push(name);
    res.push(DEFNAME);
    return res.join(" ");
  }

  function expectAssign(stream, state) {
    if (!stream.match(assign)) return null;
    state.f = expectTerm;
    return EQUALS;
  }

  function expectTerm(stream, state) {
    return brackets(stream, state)
     || lambda(stream, state)
     || namedTerm(stream, state)
     || number(stream, state);
  }

  function brackets(stream, state) {
    const v = stream.eat(brack);
    if (!v) return null;
    if (v == '(' && stream.peek() == ')') {
      stream.next();
      return EMPTY;
    }
    if (v == '(') {
      state.depth.push(stream.column() + stream.indentation());
      state.bound.push([]);
    }
    else {
      state.depth.pop();
      state.bound.pop();
    }
    state.f = expectTerm;
    return BRACKETS;
  }

  function lambda(stream, state) {
    if (!stream.eat("\\")) return null;
    state.f = expectArg;
    return LAMBDA;
  }

  function namedTerm(stream, state) {
    const res = (stream.match(defName)||[])[0];
    if (!res) return null;
    if (state.bound.some(v=>v.includes(res))) return BOUND;
    if (state.defined.includes(res)) return PREDEF;
    return UNDEF;
  }

  function number(stream, state) {
    const num = (stream.match(numconst)||[])[0];
    return num && (/\s|\)/.test(stream.peek()) || stream.eol()) ? NUMBER : null;
  }

  function expectArg(stream, state) {
    const arg = (stream.match(lamArg)||[])[0];
    if (!arg) return null;
    if (arg === '.') {
      state.f = expectTerm;
      return DOT;
    }
    if (arg[0] === '_') return HOLE;
    state.bound[state.bound.length-1].push(arg);
    return ARGS;
  }

  function onFail(stream, state) {
    stream.match(/[^\s#]*/);
    return FAIL ;
  }

  return {
    startState: function ()  { return {
      f: expectDef,
      depth: [],
      defined: [],
      bound: [[]],
      debug: false
    }; },
    copyState:  function (s) { return {
      f: s.f,
      depth: [...s.depth],
      defined: [...s.defined],
      bound: s.bound.map(v=>[...v]),
      debug: s.debug
    }; },

    token: function(stream, state) {
      if (stream.eat(/\t/)) return FAIL;
      if (/[ \n]/.test(stream.peek())) {
        stream.eatWhile(/[ \n]/);
        return;
      }
      if (stream.peek() === '#') {
        if (stream.match(/^#debug/))
          state.debug = !state.debug;
        stream.skipToEnd();
        return "comment"
      }
      if (stream.sol() && state.depth.length === 0) {
        state.bound = [[]];
        state.f = expectDef;
      }
      const res = state.f(stream, state)
        || (state.debug ? null : expectDefOrTerm(stream, state))
        || onFail(stream, state);
      return !state.debug && res == FAIL ? SUPPRESS : res ;
    },

    indent: function(state, textAfter) {
      if (!state.depth.length) return 0;
      return state.depth[state.depth.length-1] + 2;
    },
    lineComment: "#",
  };

});

CodeMirror.defineMIME("text/x-lambdacalc", "lambdacalc");
};
