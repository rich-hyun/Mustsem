// 터미널에서 물어보고 답을 받는다. hidden이면 입력한 글자를 화면에 쓰지 않는다 (개인키 입력용).
const readline = require('node:readline')

// 입력 창구는 하나만 둔다 (질문마다 새로 만들면 붙여 넣은 다음 줄을 놓칠 수 있다)
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) })
const lines = rl[Symbol.asyncIterator]()
let muted = false
const write = rl._writeToOutput.bind(rl)
rl._writeToOutput = (text) => {
  if (!muted) write(text)
}

async function ask(question, hidden = false) {
  process.stdout.write(question)
  muted = hidden
  const { value } = await lines.next()
  muted = false
  if (hidden) process.stdout.write('\n')
  return (value ?? '').trim()
}

/** 개인키를 보이지 않게 입력받는다. 형식이 틀리면 null */
async function askPrivateKey() {
  const key = (await ask('개인키를 붙여 넣고 Enter (화면에는 보이지 않습니다): ', true)).replace(/^0x/i, '')
  return /^[0-9a-fA-F]{64}$/.test(key) ? `0x${key}` : null
}

module.exports = { ask, askPrivateKey }
