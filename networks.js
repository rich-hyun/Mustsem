/* =========================================================
   MUSTSEM 공통 네트워크 / 엔드포인트 설정
   네트워크(RPC, chainId)나 도메인이 바뀌면 이 파일만 수정합니다.
   참조 페이지: nft / sbt / rwa / staking / bridge / dashboard
   ========================================================= */
window.MST_CONFIG = {
  networks: [
    { name: "Mustsem",    rpc: "https://block.mustree.kr", chain: 7601, symbol: "MST" },
    { name: "JKK-TMZ",    rpc: "https://jkk.mst2.site",    chain: 7707, symbol: "TMZ" },
    { name: "KukminBank", rpc: "https://rpc.mstblock.com", chain: 1213, symbol: "KBB" },
    { name: "NABIZAM",    rpc: "https://nbmst.mst2.site",  chain: 7602, symbol: "NBZ" },
    { name: "MDPCD",      rpc: "https://mdpcd.mst2.site",  chain: 7603, symbol: "MDP" }
  ],

  // REST API 서버 (대시보드 잔액 조회, RWA 업로드)
  api: "https://api.mustree.kr",

  // IPFS 게이트웨이 (RWA 원본 파일 다운로드)
  ipfsGateway: "https://rwa-gw.mustree.kr/ipfs"
};

// 이름으로 네트워크 조회
window.MST_NET = (name) => window.MST_CONFIG.networks.find(n => n.name === name);

// chainId → MetaMask용 16진수 문자열
window.MST_CHAIN_HEX = (chain) => "0x" + chain.toString(16);

// MetaMask를 해당 네트워크로 전환. 지갑에 없는 체인이면 등록 후 다시 전환.
// 성공하면 null, 실패하면 사용자에게 보여줄 안내 문구를 반환합니다.
window.MST_SWITCH_CHAIN = async (net) => {
  if (!window.ethereum) return "MetaMask가 설치되어 있지 않습니다.";
  const chainId = window.MST_CHAIN_HEX(net.chain);
  const request = (method, params) => window.ethereum.request({ method, params });
  try {
    await request("wallet_switchEthereumChain", [{ chainId }]);
    return null;
  } catch (err) {
    if (err && err.code === 4001) return "네트워크 전환이 취소되었습니다.";
    // 4902(미등록 체인) 포함, 전환 실패 시 체인 등록을 시도한 뒤 재전환
    try {
      await request("wallet_addEthereumChain", [{
        chainId,
        chainName: net.name,
        rpcUrls: [net.rpc],
        nativeCurrency: { name: net.symbol, symbol: net.symbol, decimals: 18 }
      }]);
      await request("wallet_switchEthereumChain", [{ chainId }]);
      return null;
    } catch (addErr) {
      if (addErr && addErr.code === 4001) return "네트워크 전환이 취소되었습니다.";
      return "네트워크 전환에 실패했습니다. MetaMask 상태를 확인해주세요.";
    }
  }
};
