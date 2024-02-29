import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { base58 } from "@scure/base";
import { Wallet } from "@coral-xyz/anchor";
import { IGNORE_CACHE, ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, WhirlpoolContext, buildWhirlpoolClient, swapQuoteByInputToken } from "@orca-so/whirlpools-sdk";
import { Decimal } from "decimal.js";
import { DecimalUtil, Percentage } from "@orca-so/common-sdk";

type SwapParams = {
  amount?: number;
  amountDecimal?: number;
  secretKey?: string;
  tokenOwnerAccountA?: string;
  tokenOwnerAccountB?: string;
  aToB?: boolean
}

export default async ({ secretKey }: SwapParams) => {
  const connection = new Connection(
    process.env.PROVIDER_URL
  );
  const wallet = new Wallet(
    Keypair.fromSecretKey(base58.decode(secretKey)),
  );

  console.log("Connecting to:", wallet.publicKey.toString())

  const ctx = WhirlpoolContext.from(
    connection,
    wallet,
    ORCA_WHIRLPOOL_PROGRAM_ID,
  );

  const devSOL = {mint: new PublicKey("So11111111111111111111111111111111111111112"), decimals: 9};
  const devUSDC = {mint: new PublicKey("BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k"), decimals: 6};
  //const devSAMO = {mint: new PublicKey("Jd4M8bfJG3sAkd82RsGWyEXoaBXQP7njFzBwEaCTuDa"), decimals: 9};

  const whirlpoolClient = buildWhirlpoolClient(ctx);
  const tick_spacing = 64;
  const DEVNET_WHIRLPOOLS_CONFIG = new PublicKey("FcrweFY1G9HJAHG5inkGB6pKg1HZ6x9UC2WioAfWrGkR");
  const whirlpool_pubkey = PDAUtil.getWhirlpool(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      DEVNET_WHIRLPOOLS_CONFIG,
      devSOL.mint, devUSDC.mint, tick_spacing).publicKey;
  const whirlpool = await whirlpoolClient.getPool(whirlpool_pubkey);

  const amountIn = new Decimal("1" /* devUSDC */);

  const quote = await swapQuoteByInputToken(
    whirlpool,
    // Input token and amount
    devSOL.mint,
    DecimalUtil.toBN(amountIn, devSOL.decimals),
    // Acceptable slippage (10/1000 = 1%)
    Percentage.fromFraction(10, 1000),
    ctx.program.programId,
    ctx.fetcher,
    IGNORE_CACHE,
  );

  console.log("estimatedAmountIn:", DecimalUtil.fromBN(quote.estimatedAmountIn, devSOL.decimals).toString(), "devSOL");
  console.log("estimatedAmountOut:", DecimalUtil.fromBN(quote.estimatedAmountOut, devUSDC.decimals).toString(), "devUSDC");
  console.log("otherAmountThreshold:", DecimalUtil.fromBN(quote.otherAmountThreshold, devUSDC.decimals).toString(), "devUSDC");

  // Send the transaction
  const tx = await whirlpool.swap(quote);
  const signature = await tx.buildAndExecute();
  console.log("signature:", signature);

  // Wait for the transaction to complete
  const latest_blockhash = await ctx.connection.getLatestBlockhash();
  const txId = await ctx.connection.confirmTransaction({signature, ...latest_blockhash}, "confirmed");

  return {
    txId,
  };
}
