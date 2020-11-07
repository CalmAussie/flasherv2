const buyResultOneInch = await this.state.dsa.oneInch.getBuyAmount(key, token, amount, 0);
const buyResultKyber = await this.state.dsa.kyber.getBuyAmount(key, token, amount, 0);
const buyResultUniswap = await this.state.dsa.uniswap.getBuyAmount(key, token, amount, 0);
if (buyResultOneInch.buyAmt > buyResultKyber.buyAmt) {
  console.log("1inch", amount, token, "->", key, buyResultOneInch);
  buyFinal = {"amt": 0.999*buyResultOneInch.buyAmt, "dex": "1inch", "unitAmt": buyResultOneInch.unitAmt};
} else if (buyResultOneInch.buyAmt > buyResultUniswap.buyAmt) {
    console.log("1inch", amount, token, "->", key, buyResultOneInch);
    buyFinal = {"amt": 0.999*buyResultOneInch.buyAmt, "dex": "1inch", "unitAmt": buyResultOneInch.unitAmt};
} else if {
  console.log("Kyber", amount, token, "->", key, buyResultKyber);
  buyFinal = {"amt": 0.999*buyResultKyber.buyAmt, "dex": "Kyber", "unitAmt": buyResultKyber.unitAmt};
} else if {
    console.log("Uniswap", amount, token, "->", key, buyResultUniswap);
    buyFinal = {"amt": 0.999*buyResultUniswap.buyAmt, "dex": "Uniswap", "unitAmt": buyResultUniswap.unitAmt};
}








const sellResultOneInch = await this.state.dsa.oneInch.getBuyAmount(token, key, buyFinal.amt, 0);
const sellResultKyber = await this.state.dsa.kyber.getBuyAmount(token, key, buyFinal.amt, 0);
const sellResultUniswap = await this.state.dsa.uniswap.getSellAmount(token, key, buyFinal.amt, 0);
if (sellResultOneInch.buyAmt > sellResultKyber.buyAmt) {
  console.log("1inch", amount, key, "->", token, sellResultOneInch);
  sellFinal = {"amt": sellResultOneInch.buyAmt, "dex": "1inch", "unitAmt": sellResultOneInch.unitAmt};
} else {
  console.log("Kyber", amount, key, "->", token, sellResultKyber);
  sellFinal = {"amt": sellResultKyber.buyAmt, "dex": "Kyber",  "unitAmt": sellResultKyber.unitAmt};