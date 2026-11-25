import { http, createConfig } from "wagmi";
import { defineChain } from "viem";

// ─── X Layer chains ───────────────────────────────────────────────────────────

export const xlayerTestnet = defineChain({
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testrpc.xlayer.tech"] },
  },
  blockExplorers: {
    default: { name: "XLayerScan", url: "https://www.okx.com/web3/explorer/xlayer-test" },
  },
  testnet: true,
});

export const xlayerMainnet = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.xlayer.tech"] },
  },
  blockExplorers: {
    default: { name: "XLayerScan", url: "https://www.okx.com/web3/explorer/xlayer" },
  },
});

// ─── Wagmi config ─────────────────────────────────────────────────────────────

export const wagmiConfig = createConfig({
  chains: [xlayerTestnet, xlayerMainnet],
  transports: {
    [xlayerTestnet.id]: http(),
    [xlayerMainnet.id]: http(),
  },
});

// ─── Contract addresses ───────────────────────────────────────────────────────

export const CONTRACTS = {
  [xlayerTestnet.id]: {
    jobRegistry: "0x891166Ac81f4b9cD646e9Cd645c1D6eA5d78E853" as `0x${string}`,
    tapeOutFactory: "" as `0x${string}`, // Not on testnet
  },
  [xlayerMainnet.id]: {
    jobRegistry: "0x891166Ac81f4b9cD646e9Cd645c1D6eA5d78E853" as `0x${string}`,
    tapeOutFactory: "0x1f09DAeFA827f02CBb40967cc91b259763760761" as `0x${string}`,
  },
} as const;

export function getContracts(chainId: number) {
  return CONTRACTS[chainId as keyof typeof CONTRACTS] ?? CONTRACTS[xlayerTestnet.id];
}
