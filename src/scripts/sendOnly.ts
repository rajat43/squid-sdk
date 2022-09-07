import { getSignerForChain, getSendOnly } from "./utils";
import { ChainName } from "../types";
import { Squid } from "../index";
import { ethers } from "ethers";
import chalk from "chalk";

const executeSendOnly = async (
  squid: Squid,
  signer: ethers.Wallet,
  fromNetwork: ChainName,
  toNetwork: ChainName,
  amount: string
) => {
  const params = getSendOnly(squid, fromNetwork, toNetwork, amount);
  console.log("\n");
  console.log(
    `> sendOnly: from ${fromNetwork}=>${toNetwork} from ${chalk.green(
      "Token"
    )} ${params.sourceTokenAddress} to ${chalk.green("Token")} ${
      params.destinationTokenAddress
    }`
  );
  const { route } = await squid.getRoute(params);
  console.log("> route: ", route);
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

export const sendOnly = async (
  squid: Squid,
  src: ChainName,
  dests: ChainName[],
  amount: string
) => {
  const signer = getSignerForChain(src);
  for (const dest of dests) {
    await executeSendOnly(squid, signer, src, dest, amount);
    await executeSendOnly(squid, signer, src, dest, amount);
  }
};
