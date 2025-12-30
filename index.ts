import { TextPrompt, isCancel } from '@clack/core';

const p = new TextPrompt({
  render() {
    return `What's your name?\n${this.valueWithCursor}`;
  },
});

const name = await p.prompt();
if (isCancel(name)) {
  process.exit(0);
}
else {
  console.log(`Hello, ${name}!`);
}
