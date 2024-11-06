import {
  ParsedInstruction,
  PartiallyDecodedInstruction,
  Connection,
} from "@solana/web3.js";

import { Raydium_AMM_ADDRESS, MAINNET_RPC } from "../constants";
import { Swap } from "../types";
import { fromDecimals } from "../utils";

const solConnection = new Connection(MAINNET_RPC);

export const getRaydiumSwapParseData = async (
  signature: string
): Promise<Swap> => {
  const txData = await solConnection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  });

  if (!txData) throw `Not found transaction from signature`;

  // Skipping handling failed transactions.
  if (txData.meta?.err) throw `Failed transaction: ${txData.meta.err}`;

  const timestamp = txData.blockTime;
  if (!timestamp) throw `Transaction is not processed`;

  // signer
  const accKeys = txData.transaction.message.accountKeys.map((val) =>
    val.pubkey.toBase58()
  );

  const swapIxIndex = txData.transaction.message.instructions.findIndex(
    (ix) => ix.programId.toBase58() === Raydium_AMM_ADDRESS
  );

  if (swapIxIndex === -1) throw `Not found raydium instruction in transaction`;

  if (!txData.meta?.innerInstructions) throw `Transaction not confirmed yet`;

  const swapInnerIxs = txData.meta.innerInstructions.reduce((acc, innerIx) => {
    if (innerIx.index === swapIxIndex) return acc.concat(innerIx.instructions);
    else return acc;
  }, [] as (ParsedInstruction | PartiallyDecodedInstruction)[]);

  const swapIx = txData.transaction.message.instructions[
    swapIxIndex
  ] as PartiallyDecodedInstruction;

  // Amm Market Id
  const poolId = swapIx.accounts[1].toBase58();

  // Parse pair tokens info
  const token1Acc = swapIx.accounts[15].toBase58(); // Sending token
  const token2Acc = swapIx.accounts[16].toBase58(); // Receiving token

  const token1AccInfo = txData.meta.preTokenBalances!.find(
    (data) => data.accountIndex === accKeys.indexOf(token1Acc)
  );
  const token2AccInfo = txData.meta.preTokenBalances!.find(
    (data) => data.accountIndex === accKeys.indexOf(token2Acc)
  );
  const token1Amount = Number(
    (swapInnerIxs[0] as ParsedInstruction).parsed.info.amount
  );
  const token2Amount = Number(
    (swapInnerIxs[1] as ParsedInstruction).parsed.info.amount
  );

  if (!token1AccInfo) {
    return {
      signature,
      timestamp,
      tokenMint: token2AccInfo!.mint,
      tokenDecimals: token2AccInfo!.uiTokenAmount.decimals,
      type: "BUY",
      amountIn: fromDecimals(token1Amount),
      amountOut: fromDecimals(
        token2Amount,
        token2AccInfo!.uiTokenAmount.decimals
      ),
      poolId,
      signer: accKeys[0],
    };
  } else if (!token2AccInfo) {
    return {
      signature,
      timestamp,
      tokenMint: token1AccInfo!.mint,
      tokenDecimals: token1AccInfo!.uiTokenAmount.decimals,
      type: "SELL",
      amountIn: fromDecimals(
        token1Amount,
        token1AccInfo!.uiTokenAmount.decimals
      ),
      amountOut: fromDecimals(token2Amount),
      poolId,
      signer: accKeys[0],
    };
  } else {
    throw `Couldn't parse pair token without SOL in one side`;
  }
};
