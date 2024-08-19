import { ContractCallContext, Multicall } from "ethereum-multicall";
import { BigNumber, ethers } from "ethers";
import { TokenBalance, TokenData } from "types";
import {
  MULTICALL_ADDRESS,
  NATIVE_EVM_TOKEN_ADDRESS,
  multicallAbi
} from "../constants";

type ContractAddress = `0x${string}`;

const CHAINS_WITHOUT_MULTICALL = [
  314, // Filecoin
  3141, // Filecoin testnet
  2222 // Kava
];

const getTokensBalanceSupportingMultiCall = async (
  tokens: TokenData[],
  chainRpcUrl: string,
  userAddress?: ContractAddress
): Promise<TokenBalance[]> => {
  if (!userAddress) return [];

  const provider = new ethers.providers.JsonRpcProvider(chainRpcUrl);

  const contractCallContext: ContractCallContext[] = tokens.map(token => {
    const isNativeToken =
      token.address.toLowerCase() === NATIVE_EVM_TOKEN_ADDRESS.toLowerCase();

    return {
      abi: isNativeToken
        ? multicallAbi
        : [
            {
              name: "balanceOf",
              type: "function",
              inputs: [{ name: "_owner", type: "address" }],
              outputs: [{ name: "balance", type: "uint256" }],
              stateMutability: "view"
            }
          ],
      contractAddress: isNativeToken ? MULTICALL_ADDRESS : token.address,
      reference: token.symbol,
      calls: [
        {
          reference: isNativeToken ? "getEthBalance" : "balanceOf",
          methodName: isNativeToken ? "getEthBalance" : "balanceOf",
          methodParameters: [userAddress]
        }
      ]
    };
  });

  const multicallInstance = new Multicall({
    ethersProvider: provider,
    tryAggregate: true,
    multicallCustomContractAddress: MULTICALL_ADDRESS
  });

  try {
    const { results } = (await multicallInstance.call(contractCallContext)) ?? {
      results: {}
    };
    const tokenBalances: TokenBalance[] = [];

    for (const symbol in results) {
      const data = results[symbol].callsReturnContext[0] ?? {};

      const token = tokens.find(t => t.symbol === symbol);

      if (!token) continue;

      const { decimals, address } = token;

      const mappedBalance: TokenBalance = {
        symbol,
        address,
        decimals,
        balance: BigNumber.from(data.returnValues?.[0] ?? 0).toString(),
        chainId: token.chainId
      };

      tokenBalances.push(mappedBalance);
    }

    return tokenBalances;
  } catch (error) {
    return tokens.map(t => ({
      ...t,
      balance: "0"
    }));
  }
};

const getTokensBalanceWithoutMultiCall = async (
  tokens: TokenData[],
  userAddress: ContractAddress,
  rpcUrlsPerChain: {
    [chainId: string]: string;
  }
): Promise<TokenBalance[]> => {
  const balances: (TokenBalance | null)[] = await Promise.all(
    tokens.map(async t => {
      try {
        return await fetchBalance({
          token: t,
          userAddress,
          rpcUrl: rpcUrlsPerChain[t.chainId]
        });
      } catch (error) {
        return null;
      }
    })
  );

  // filter out null values
  return balances.filter(Boolean) as TokenBalance[];
};

export const getAllEvmTokensBalance = async (
  evmTokens: TokenData[],
  userAddress: string,
  chainRpcUrls: {
    [chainId: string]: string;
  }
): Promise<TokenBalance[]> => {
  try {
    // Some tokens don't support multicall, so we need to fetch them with Promise.all
    // TODO: Once we support multicall on all chains, we can remove this split
    const splittedTokensByMultiCallSupport = evmTokens.reduce(
      (acc, token) => {
        if (CHAINS_WITHOUT_MULTICALL.includes(Number(token.chainId))) {
          acc[0].push(token);
        } else {
          acc[1].push(token);
        }
        return acc;
      },
      [[], []] as TokenData[][]
    );

    const tokensNotSupportingMulticall = splittedTokensByMultiCallSupport[0];
    const tokensSupportingMulticall = splittedTokensByMultiCallSupport[1];

    const tokensByChainId = tokensSupportingMulticall.reduce(
      (groupedTokens, token) => {
        if (!groupedTokens[token.chainId]) {
          groupedTokens[token.chainId] = [];
        }

        groupedTokens[token.chainId].push(token);

        return groupedTokens;
      },
      {} as Record<string, TokenData[]>
    );

    const tokensMulticall: TokenBalance[] = [];

    for (const chainId in tokensByChainId) {
      const tokens = tokensByChainId[chainId];
      const rpcUrl = chainRpcUrls[chainId];

      if (!rpcUrl) continue;

      const tokensBalances = await getTokensBalanceSupportingMultiCall(
        tokens,
        rpcUrl,
        userAddress as ContractAddress
      );

      tokensMulticall.push(...tokensBalances);
    }
    const tokensNotMultiCall = await getTokensBalanceWithoutMultiCall(
      tokensNotSupportingMulticall,
      userAddress as ContractAddress,
      chainRpcUrls
    );

    return [...tokensMulticall, ...tokensNotMultiCall];
  } catch (error) {
    console.error(error);
    return evmTokens.map(t => ({
      ...t,
      balance: "0"
    }));
  }
};

type FetchBalanceParams = {
  token: TokenData;
  userAddress: ContractAddress;
  rpcUrl: string;
};

async function fetchBalance({
  token,
  userAddress,
  rpcUrl
}: FetchBalanceParams): Promise<TokenBalance | null> {
  if (token.address.toLowerCase() === NATIVE_EVM_TOKEN_ADDRESS.toLowerCase()) {
    return fetchNativeBalance({ token, userAddress, rpcUrl });
  }

  try {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    const tokenAbi = ["function balanceOf(address) view returns (uint256)"];
    const tokenContract = new ethers.Contract(
      token.address ?? "",
      tokenAbi,
      provider
    );

    const balance = (await tokenContract.balanceOf(userAddress)) ?? "0";

    if (!token) return null;

    const { decimals, symbol, address } = token;

    return {
      address,
      // balance in wei
      balance: parseInt(balance, 16).toString(),
      decimals,
      symbol,
      chainId: token.chainId
    };
  } catch (error) {
    console.error("Error fetching token balance:", error);
    return null;
  }
}

async function fetchNativeBalance({
  userAddress,
  rpcUrl,
  token
}: FetchBalanceParams) {
  try {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const balance = await provider.getBalance(userAddress);

    return {
      address: token.address,
      balance: balance.toString(),
      decimals: token.decimals,
      symbol: token.symbol,
      chainId: token.chainId
    };
  } catch (error) {
    console.error("Error fetching native token balance:", error);
    return null;
  }
}
