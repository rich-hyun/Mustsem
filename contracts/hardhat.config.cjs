// 컨트랙트 컴파일·테스트 설정 (사이트 빌드와 무관, contracts/README.md 참고)
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // PUSH0를 쓰지 않는다: 하드포크 설정이 오래된 전용 체인에도 배포할 수 있다
      evmVersion: 'london',
    },
  },
  paths: { sources: './src', tests: './test', cache: './cache', artifacts: './build' },
}
