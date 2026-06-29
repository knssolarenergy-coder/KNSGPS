// Minimal stub for shell-quote (used by react-devtools-core)
// Only needs to satisfy the import; not used at runtime in this env.

function quote(xs) {
  return xs.map(function (s) {
    if (s && typeof s === 'object') {
      return s.op.replace(/(.)/g, '\\$1');
    }
    if (/["\s\\$`!#&*;|<>(){}]/.test(s) || s.length === 0) {
      return "'" + s.replace(/'/g, "'\\''") + "'";
    }
    return s;
  }).join(' ');
}

function parse(s, env, opts) {
  var chunker = /(['"])((?:\\\1|(?!\1)[\s\S])*)\1|(\\.)|(\S+)/g;
  var match;
  var args = [];
  var arg;
  while ((match = chunker.exec(s)) !== null) {
    if (match[1]) {
      arg = (arg || '') + match[2].replace(/\\(['"])/g, '$1');
    } else if (match[3]) {
      arg = (arg || '') + match[3].slice(1);
    } else {
      arg = (arg || '') + match[4];
    }
    if (chunker.lastIndex >= s.length || /\s/.test(s[chunker.lastIndex])) {
      if (arg !== undefined) args.push(arg);
      arg = undefined;
    }
  }
  return args;
}

exports.quote = quote;
exports.parse = parse;
module.exports = { quote: quote, parse: parse };
