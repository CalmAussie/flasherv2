import React, { Component } from 'react';
import Authereum from "authereum";
import Web3 from "web3";
import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import DSA from "dsa-sdk";
import { Button, Select, InputNumber, Row, Col, Form } from 'antd';
import tokens from "./consts/token";
import CoinGecko from "coingecko-api";
import './App.css';

const { Option } = Select;

const providerOptions = {
  authereum: {
    package: Authereum // required
  },
  walletconnect: {
    package: WalletConnectProvider, // required
    options: {
      infuraId: "b6393fd1a6a44d2d81e8fee974727a72" // required
    }
  }
};

const layout = {
  labelCol: { span: 8 },
  wrapperCol: { span: 16 },
};
const tailLayout = {
  wrapperCol: { offset: 8, span: 16 },
};

class App extends Component {
  constructor(props) {
    super(props);
    this.connectWallet = this.connectWallet.bind(this);
    this.getInstaPoolLiquidity = this.getInstaPoolLiquidity.bind(this);
    this.findArbOpps = this.findArbOpps.bind(this);
    this.executeTransaction = this.executeTransaction.bind(this);
    this.changeAsset = this.changeAsset.bind(this);
    this.changeAmount = this.changeAmount.bind(this);
    this.createDSA = this.createDSA.bind(this);
    this.onFinish = this.onFinish.bind(this);
    this.calculatePrice = this.calculatePrice.bind(this);

    this.state = {
      dsa: false,
      availableLiquidity: {},
      arbOpps: [],
      flashloan: {
        asset: "bat",
        amount: 1
      },
      createAccount: false,
      web3: false,
      prices : {}
    }
  }

  async calculatePrice(){
    const CoinGeckoClient = new CoinGecko();
    let data = await CoinGeckoClient.coins.markets({"ids" : ["aave","basic-attention-token","binance-usd","dai","enjincoin","ethereum","kyber-network","ethlend","maker","decentraland","republic-protocol","havven","true-usd","nusd","uniswap","usd-coin","tether","wrapped-bitcoin","yearn-finance","0x"]});
    console.log(data);
    let currencyRates = {};
    data.data.forEach(cur => {currencyRates[cur.symbol] = cur.current_price});
    console.log(currencyRates);
    return currencyRates;
  }

  componentDidUpdate(prevProps, prevState) {
    console.log("New DSA State", this.state.dsa);
    console.log("New Liquidity State", this.state.availableLiquidity);
  }

  async connectWallet() {
    const web3Modal = new Web3Modal({
      network: "mainnet", // optional
      cacheProvider: false, // optional
      providerOptions // required
    });
    const provider = await web3Modal.connect();

    const web3 = new Web3(provider);

    const accounts = await web3.eth.getAccounts()

    const address = accounts[0];

    const dsa = new DSA(web3);

    let dsaId = NaN;

    try {
      const dsaAccounts = await dsa.getAccounts(address);
      if (Array.isArray(dsaAccounts) && dsaAccounts.length) {
        dsaId = dsaAccounts[0].id;
        console.log(dsaId, dsaAccounts);
      } else {
        this.setState({
          createAccount: true,
          web3
        });
        console.log("No DSA", dsaAccounts);
      }
    } catch (error) {
      console.log("Error fetching DSA Accounts", error);
    }

    console.log("DSA ID", dsaId);

    if (dsaId) {
      dsa.setInstance(dsaId); // DSA ID
      this.setState({
        dsa,
        web3,
        createAccount: false
      });
    }

    this.getInstaPoolLiquidity();
    const prices = await this.calculatePrice();
    this.setState({
      prices
    });
  }

  async createDSA() {
    const web3 = this.state.web3;

    const accounts = await web3.eth.getAccounts()

    const address = accounts[0];

    const dsa = new DSA(web3);

    const hash = await dsa.build();

    console.log(hash, address);
  }

  async getInstaPoolLiquidity() {
    if (this.state.dsa) {
      const liquidity = await this.state.dsa.instapool.getLiquidity();
      console.log(liquidity);
      this.setState({
        availableLiquidity: liquidity
      })
    }
  }

  async findArbOpps() {
    const token = this.state.flashloan.asset;
    const amount = this.state.flashloan.amount;
    if (this.state.dsa) {
      const arbOpps = [];
      this.setState({ arbOpps });
      let index = 0;
      for (let [key, val] of Object.entries(tokens)) {
        if (key !== token && val.type === "token") {
          let buyFinal = {};
          let sellFinal = {};

          //////////////////////////////////// Buy 1inch or Kyber or Uniswap ////////////////////////////////////////////////////

          try {
            const buyResultOneInch = await this.state.dsa.oneInch.getBuyAmount(key, token, amount, 0);
            const buyResultKyber = await this.state.dsa.kyber.getBuyAmount(key, token, amount, 0);
            const buyResultUniswap = await this.state.dsa.uniswap.getBuyAmount(key, token, amount, 0);
            if (buyResultOneInch.buyAmt > buyResultKyber.buyAmt && buyResultOneInch.buyAmt > buyResultUniswap.buyAmt) {
              console.log("1inch", amount, token, "->", key, buyResultOneInch);
              buyFinal = {"amt": 0.999*buyResultOneInch.buyAmt, "dex": "1inch", "unitAmt": buyResultOneInch.unitAmt};
            } else if (buyResultUniswap.buyAmt > buyResultOneInch.buyAmt && buyResultUniswap.buyAmt > buyResultKyber.buyAmt) {
              console.log("Uniswap", amount, token, "->", key, buyResultUniswap);
              buyFinal = {"amt": 0.999*buyResultUniswap.buyAmt, "dex": "Uniswap", "unitAmt": buyResultUniswap.unitAmt};
            } else {
              console.log("Kyber", amount, token, "->", key, buyResultKyber);
              buyFinal = {"amt": 0.999*buyResultKyber.buyAmt, "dex": "Kyber", "unitAmt": buyResultKyber.unitAmt};              
            }

          //////////////////////////////////// Sell 1inch or Kyber or Uniswap ////////////////////////////////////////////////////


            const sellResultOneInch = await this.state.dsa.oneInch.getBuyAmount(token, key, buyFinal.amt, 0);
            const sellResultKyber = await this.state.dsa.kyber.getBuyAmount(token, key, buyFinal.amt, 0);
            const sellResultUniswap = await this.state.dsa.uniswap.getBuyAmount(token, key, buyFinal.amt, 0);
            if (sellResultOneInch.buyAmt > sellResultKyber.buyAmt && sellResultOneInch.buyAmt > sellResultUniswap.buyAmt) {
              console.log("1inch", amount, key, "->", token, sellResultOneInch);
              sellFinal = {"amt": sellResultOneInch.buyAmt, "dex": "1inch", "unitAmt": sellResultOneInch.unitAmt};
            } else if (sellResultUniswap.buyAmt > sellResultOneInch.buyAmt && sellResultUniswap.buyAmt > sellResultKyber.buyAmt) {
              console.log("Uniswap", amount, key, "->", token, sellResultUniswap);
              sellFinal = {"amt": sellResultUniswap.buyAmt, "dex": "Uniswap",  "unitAmt": sellResultUniswap.unitAmt};
            } else {
              console.log("Kyber", amount, key, "->", token, sellResultKyber);
              sellFinal = {"amt": sellResultKyber.buyAmt, "dex": "Kyber",  "unitAmt": sellResultKyber.unitAmt};
            }
          } catch (e) {
            console.log(e);
          }
          

          if (sellFinal.amt > amount * 1.001) {
            arbOpps.push({
              "index": index,
              "from": buyFinal.dex,
              "to": sellFinal.dex,
              "amount": amount,
              "fromAmt": buyFinal.amt,
              "toAmt": sellFinal.amt,
              "borrowToken": token,
              "buyToken": key,
              "buyUnitAmt": buyFinal.unitAmt,
              "sellUnitAmt": sellFinal.unitAmt,
              "diff": sellFinal.amt - amount,
              "diffUsd": (sellFinal.amt - amount) * this.state.prices[token]
            });
            this.setState({ arbOpps });
            index++;
          }
        }
      }
    }
  }

  async executeTransaction(index) {
    if (this.state.dsa) {
      if (Array.isArray(this.state.arbOpps) && this.state.arbOpps.length > index) {
        const trxDetails = this.state.arbOpps[index];
        console.log("Executing ", trxDetails);
        let spells = this.state.dsa.Spell();

        let bAmountInWei = this.state.dsa.tokens.fromDecimal(trxDetails.amount, trxDetails.borrowToken);

        spells.add({
          connector: "instapool",
          method: "flashBorrow",
          args: [
            tokens[trxDetails.borrowToken].address,
            bAmountInWei,
            0,
            0
          ]
        });

        if (trxDetails.from === "1inch") {

          spells.add({
            connector: "oneInch",
            method: "sell",
            args: [
              tokens[trxDetails.buyToken].address,
              tokens[trxDetails.borrowToken].address,
              bAmountInWei,
              trxDetails.buyUnitAmt,
              0,
              0
            ]
          });
        } else if (trxDetails.from === "Kyber") {
          spells.add({
            connector: "kyber",
            method: "sell",
            args: [
              tokens[trxDetails.buyToken].address,
              tokens[trxDetails.borrowToken].address,
              bAmountInWei,
              trxDetails.buyUnitAmt,
              0,
              0
            ]
          });
        } else if (trxDetails.from === "Uniswap") {
          spells.add({
            connector: "uniswap",
            method: "buy",
            args: [
              tokens[trxDetails.buyToken].address,
              tokens[trxDetails.borrowToken].address,
              bAmountInWei,
              trxDetails.buyUnitAmt,
              0,
              0
            ]
          });
        } else {
          return 0;
        }

        bAmountInWei = this.state.dsa.tokens.fromDecimal(trxDetails.fromAmt, trxDetails.buyToken);

        if (trxDetails.to === "1inch") {
          spells.add({
            connector: "oneInch",
            method: "sell",
            args: [
              tokens[trxDetails.borrowToken].address,
              tokens[trxDetails.buyToken].address,
              bAmountInWei,
              trxDetails.sellUnitAmt,
              0,
              0
            ]
          });
        } else if (trxDetails.to === "Kyber") {
          spells.add({
            connector: "kyber",
            method: "sell",
            args: [
              tokens[trxDetails.borrowToken].address,
              tokens[trxDetails.buyToken].address,
              bAmountInWei,
              trxDetails.sellUnitAmt,
              0,
              0
            ]
          });
        } else if (trxDetails.to === "Uniswap") {
          spells.add({
            connector: "uniswap",
            method: "sell",
            args: [
              tokens[trxDetails.borrowToken].address,
              tokens[trxDetails.buyToken].address,
              bAmountInWei,
              trxDetails.sellUnitAmt,
              0,
              0
            ]
          });  
        } else {
          return 0;
        }

        spells.add({
          connector: "instapool",
          method: "flashPayback",
          args: [
            tokens[trxDetails.borrowToken].address,
            0,
            0
          ]
        });

        console.log(spells);

        try {
          const trxHash = await this.state.dsa.cast(spells);
          console.log("Transaction went through", trxHash)          
        } catch (error) {
          console.log("Failed Transaction", error);
        }
      }
    }
  }

  changeAsset(value) {
    console.log(`Selected ${value}`);
    const flashloan = {...this.state.flashloan}
    // flashloan.asset = event.target.value;
    flashloan.asset = value;
    this.setState({
      flashloan
    });
  }

  changeAmount(value) {
    const flashloan = {...this.state.flashloan}
    flashloan.amount = Number.parseFloat(value);
    this.setState({
      flashloan
    });
  }

  async onFinish(values) {
    const flashloan = {
      asset: values.asset,
      amount: values.amount
    }
    this.setState({
      flashloan
    }, () => {
      this.findArbOpps();
    });
  }

  render() {
    return (
      <div className="App">
        <Row className="flashRow">
        <Col span={24}>
        <Row className="flashRow">
        <Col span={6}>  
        <Button type="primary" onClick={this.connectWallet}>
          Connect Wallet
        </Button>
        </Col>
        </Row>
        <Row className="flashRow">
        <Col span={6}>
        { this.state.createAccount ? 
          <div>
            <p>You need to create a InstaDaap DSA Account</p><br />
            <Button type="primary" onClick={this.createDSA}>Created DSA Account</Button>
          </div>
        : null }
        </Col>
        </Row>
        { this.state.dsa ? 
        <div>
        <h2>Available Liquidity</h2>
        <Row className="flashRow">
        <Col span={6}>
        <ul>
          <li>BAT -{" "}{this.state.availableLiquidity.bat ? this.state.availableLiquidity.bat.toFixed(3) : 0}</li>
          <li>BUSD -{" "}{this.state.availableLiquidity.busd ? this.state.availableLiquidity.busd.toFixed(3) : 0}</li>
          <li>DAI -{" "}{this.state.availableLiquidity.dai ? this.state.availableLiquidity.dai.toFixed(3) : 0}</li>
          <li>ENJ -{" "}{this.state.availableLiquidity.enj ? this.state.availableLiquidity.enj.toFixed(3) : 0}</li>
          <li>ETH -{" "}{this.state.availableLiquidity.eth ? this.state.availableLiquidity.eth.toFixed(3) : 0}</li>
          <li>KNC -{" "}{this.state.availableLiquidity.knc ? this.state.availableLiquidity.knc.toFixed(3) : 0}</li>
          <li>LEND -{" "}{this.state.availableLiquidity.lend ? this.state.availableLiquidity.lend.toFixed(3) : 0}</li>
          <li>MANA -{" "}{this.state.availableLiquidity.mana ? this.state.availableLiquidity.mana.toFixed(3) : 0}</li>
          <li>MKR -{" "}{this.state.availableLiquidity.mkr ? this.state.availableLiquidity.mkr.toFixed(3) : 0}</li>
          <li>REN -{" "}{this.state.availableLiquidity.ren ? this.state.availableLiquidity.ren.toFixed(3) : 0}</li>
          <li>SNX -{" "}{this.state.availableLiquidity.snx ? this.state.availableLiquidity.snx.toFixed(3) : 0}</li>
          <li>sUSD -{" "}{this.state.availableLiquidity.susd ? this.state.availableLiquidity.susd.toFixed(3) : 0}</li>
          <li>TUSD -{" "}{this.state.availableLiquidity.tusd ? this.state.availableLiquidity.tusd.toFixed(3) : 0}</li>
          <li>UNI -{" "}{this.state.availableLiquidity.uni ? this.state.availableLiquidity.uni.toFixed(3) : 0}</li>
          <li>USDC -{" "}{this.state.availableLiquidity.usdc ? this.state.availableLiquidity.usdc.toFixed(3) : 0}</li>
          <li>USDT -{" "}{this.state.availableLiquidity.usdt ? this.state.availableLiquidity.usdt.toFixed(3) : 0}</li>
          <li>wBTC -{" "}{this.state.availableLiquidity.wbtc ? this.state.availableLiquidity.wbtc.toFixed(3) : 0}</li>
          <li>YFI -{" "}{this.state.availableLiquidity.yfi ? this.state.availableLiquidity.yfi.toFixed(3) : 0}</li>
          <li>ZRX -{" "}{this.state.availableLiquidity.zrx ? this.state.availableLiquidity.zrx.toFixed(3) : 0}</li>
        </ul>
        </Col>
        </Row>
        <Row className="flashRow">
        <Col span={6}>
          <Form
            {...layout}
            initialValues={{ remember: true }}
            onFinish={this.onFinish}
            onFinishFailed={this.onFinishFailed}
          >
            <Form.Item
              label="Asset"
              name="asset"
              rules={[{ required: true, message: 'Please select the asset!' }]}
              initialValue={this.state.flashloan.asset}
            >
              <Select>
                <Option value="bat">BAT</Option>
                <Option value="busd">BUSD</Option>
                <Option value="dai">DAI</Option>
                <Option value="enj">ENJ</Option>
                <Option value="eth">ETH</Option>
                <Option value="knc">KNC</Option>
                <Option value="lend">LEND</Option>
                <Option value="mana">MANA</Option>
                <Option value="mkr">MKR</Option>
                <Option value="ren">REN</Option>
                <Option value="susd">sUSD</Option>
                <Option value="snx">SNX</Option>
                <Option value="tusd">TUSD</Option>
                <Option value="uni">UNI</Option>
                <Option value="usdc">USDC</Option>
                <Option value="usdt">USDT</Option>
                <Option value="wbtc">wBTC</Option>
                <Option value="yfi">YFI</Option>              
                <Option value="zrx">ZRX</Option>
              </Select>
            </Form.Item>
            <Form.Item
              label="Amount"
              name="amount"
              rules={[{ required: true, message: 'Please enter the amount!' }]}
              initialValue={this.state.flashloan.amount}
            >
              <InputNumber step="0.001" min={0.001} />
            </Form.Item>

            <Form.Item {...tailLayout}>
              <Button type="primary" htmlType="submit">
                Find Arbitrage Opportunities
              </Button>
            </Form.Item>
          </Form>
        </Col>
        </Row>
        { this.state.arbOpps.length > 0 ?
        <div>
        <h2>Available Opportunities</h2>
        <ul>
          {this.state.arbOpps.map(item => (
            <li key={item.index} className="flashRow2">
              Flashloan {item.amount} <b>{item.borrowToken.toUpperCase()}</b> → Buy {item.fromAmt.toFixed(3)} <b>{item.buyToken.toUpperCase()}</b> from <b>{item.from}</b> → Sell <b>{item.buyToken.toUpperCase()}</b> for {item.toAmt.toFixed(3)} <b>{item.borrowToken.toUpperCase()}</b> from <b>{item.to}</b> = Profit <b>{item.diff.toFixed(3)}</b> {item.borrowToken.toUpperCase()} (<b>USD${item.diffUsd.toFixed(3)}</b>) {" "}
              <Button onClick={() => this.executeTransaction(item.index)} type="danger">
                Execute
              </Button>
            </li>
          ))}
        </ul>
        </div>
        :<div> 
          <h3>No Available Opportunities. </h3> 
          <p> Click the button above to avail of known oppurtunities.</p>
        </div>}
        </div>
        : null }
        </Col>
        </Row>
      </div>
    );
  }
}



export default App;
