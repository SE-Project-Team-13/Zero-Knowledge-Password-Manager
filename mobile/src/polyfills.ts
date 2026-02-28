import 'react-native-get-random-values';
import 'text-encoding';
import { Buffer } from 'buffer';

global.Buffer = Buffer;

// Polyfill for setImmediate if not available
if (typeof global.setImmediate === 'undefined') {
  (global as any).setImmediate = (callback: (...args: any[]) => void, ...args: any[]) => {
    return setTimeout(callback, 0, ...args);
  };
}

// Polyfill for process.nextTick which is often needed by crypto libraries
if (typeof process === 'undefined') {
  global.process = require('process');
} else {
  const process = global.process;
  process.nextTick = process.nextTick || setImmediate;
}
