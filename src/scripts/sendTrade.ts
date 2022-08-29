import { getSignerForChain, getSendTrade } from "./utils";
import { nativeTokenConstant } from "../constants";
import { ChainName } from "../types";
import { Squid } from "../index";
import { ethers } from "ethers";
import chalk from "chalk";

const excecuteSendTrade = async (
  squid: Squid,
  signer: ethers.Wallet,
  fromNetwork: ChainName,
  toNetwork: ChainName,
  amount: string,
  isDestNative = false
) => {
  const param = getSendTrade(squid, fromNetwork, toNetwork, amount);
  console.log("\n");
  console.log(
    `> sendTrade: from ${fromNetwork}=>${toNetwork} from ${chalk.green(
      "Token"
    )} ${param.sourceTokenAddress} to ${
      isDestNative ? chalk.red("Native") : chalk.green("Token")
    } ${isDestNative ? nativeTokenConstant : param.destinationTokenAddress}`
  );
  const { route } = await squid.getRoute(param);
  const tx = await squid.executeRoute({
    signer,
    route
  });
  const txReceipt = await tx.wait();
  console.log(
    `> txReceipt: , ${
      txReceipt.transactionHash
    }, gasUsed: ${txReceipt.gasUsed.toNumber()} `
  );
};

export const sendTrade = async (
  squid: Squid,
  src: ChainName,
  dests: ChainName[],
  amount: string
) => {
  const signer = getSignerForChain(src);
  for (const dest of dests) {
    await excecuteSendTrade(squid, signer, src, dest, amount);
    await excecuteSendTrade(squid, signer, src, dest, amount, true);
  }
};
