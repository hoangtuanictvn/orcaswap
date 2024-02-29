//import { AnchorProvider } from "@project-serum/anchor";
import dotenv from "dotenv";
import swap from "./swap.js";

dotenv.config()

async function main() {
  swap({
    secretKey: process.env.WALLET
  })
}

main()
