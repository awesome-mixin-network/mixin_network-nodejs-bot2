const childProcess     =    require('child_process');
const path             =    require('path');
const fs               =    require('fs');
const inquirer         =    require('inquirer');
const { HttpClient }   =    require('mixin-node-client');
const config           =    require('./config');
const pem              =    require('pem-file');
const csv              =    require("fast-csv");
const { oaepDecrypt }  =    require('./crypto');
const msgpack          =    require('msgpack5')();
const axios            =    require('axios');
const clientBot        =    new HttpClient(config);
const PromptMsg        =    "\nMake your choose(select the uuid for open the \
specified wallet):";
const PromptCmd        =    "\nMake your choose";
const WalletName       =    "./mybitcoin_wallet.csv";

const EXIN_BOT         =    "61103d28-3ac2-44a2-ae34-bd956070dab1";
const OCEANONE_BOT     =    "aaff5bef-42fb-4c9f-90e0-29f69176b7d4";
const BTC_ASSET_ID     =    "c6d0c728-2624-429b-8e0d-d9d19b6592fa";
const EOS_ASSET_ID     =    "6cfe566e-4aad-470b-8c9a-2fd35b49c68d";
const USDT_ASSET_ID    =    "815b0b1a-2764-3736-8faa-42d694fa620a";
const XIN_ASSET_ID     =    "c94ac88f-4671-3976-b60a-09064f1811e8";
const CNB_ASSET_ID     =    "965e5c6e-434c-3fa9-b780-c50f43cd955c";
const ERC20_BENZ       =    "2b9c216c-ef60-398d-a42a-eba1b298581d";
//change to your third exchange/cold  btc wallet address
const BTC_WALLET_ADDR  =    "14T129GTbXXPGXXvZzVaNLRFPeHXD1C25C";
const EOS_WALLET_NAME  =    "huobideposit";
const EOS_WALLET_TAG   =    "1872050";
//change to your mixin messenger account 's uuid
const MASTER_UUID      =    "0b4f49dc-8fb4-4539-9a89-fb3afc613747";

var scriptName         =    path.basename(__filename);

'use strict';

function runScript(scriptPath, args, callback) {

    // keep track of whether callback has been invoked to prevent multiple invocations
     var invoked = false;
     const spawnOptions = {
       // cwd: process.cwd(),
       detached: true,
       stdio: 'inherit',
     };
    var process = childProcess.fork(scriptPath, args, spawnOptions);

    // listen for errors as they may prevent the exit event from firing
    process.on('error', function (err) {
        if (invoked) return;
        invoked = true;
        callback(err);
    });

    // execute the callback once the process has finished running
    process.on('exit', function (code) {
        if (invoked) return;
        invoked = true;
        var err = code === 0 ? null : new Error('exit code ' + code);
        callback(err);
    });
}

// Now we can run a script and invoke a callback when complete, e.g.
if ( process.argv.length == 2 ) {
  let walletList = [];
  walletList.push("Create Wallet");
  if ( fs.existsSync(WalletName) ) {
    var stream = fs.createReadStream(WalletName);
    let firstLine  = '';
    csv
     .fromStream(stream, {headers: false})
     .on("data", function(data){
         walletList.push(data[3]);
         if (firstLine === '') { firstLine = data[3];}
     })
     .on("end", function(){

         const prompts = [
           {
             name: 'type',
             type: 'list',
             default: firstLine,
             message: PromptMsg,
             choices: walletList,
           },
         ];
         (async () => {
           walletList.push("Exit");
           const args = await inquirer.prompt(prompts);
           runScript(scriptName, [args.type], function (err) {
               if (err) throw err;
           });
         })();
     });
   } else {
     const prompts = [
       {
         name: 'type',
         type: 'list',
         pageSize: 15,
         default: "Create Wallet",
         message: PromptMsg,
         choices: walletList,
       },
     ];
     (async () => {
       walletList.push("Exit");
       const args = await inquirer.prompt(prompts);
       runScript(scriptName, [args.type], function (err) {
           if (err) throw err;
       });
     })();
   }
}
if ( process.argv.length == 3 ) {
  console.log(' You select the : ' + (process.argv[2]));
  if ( process.argv[2] === "Exit") { process.exit();}
  if ( process.argv[2] === "Create Wallet") {
    console.log("create wallet ....");
    const { generateKeyPairSync } = require('crypto');
    const { publicKey, privateKey } = generateKeyPairSync('rsa',
    {   modulusLength: 1024,  // the length of your key in bits
        publicKeyEncoding: {
          type: 'spki',       // recommended to be 'spki' by the Node.js docs
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs1',      // recommended to be 'pkcs8' by the Node.js docs
          format: 'pem',
          //cipher: 'aes-256-cbc',   // *optional*
          //passphrase: 'top secret' // *optional*
      }
    });
    publicKey1 = publicKey.replace("-----BEGIN PUBLIC KEY-----","");
    publicKey2 = publicKey1.replace("-----END PUBLIC KEY-----","");
    publicKey3 = publicKey2.replace(/\r?\n|\r/g, "");

    console.log(publicKey);
    console.log(publicKey3);
    (async () => {
      const info = await clientBot.createUser({full_name : "nodejs bitcoin wallet",
                                            session_secret: publicKey3,
                                          });
      let aesKey = '';
      const privateKeyBytes = pem.decode(Buffer.from(privateKey));
      const aesKeyBuffer = await oaepDecrypt(
        Buffer.from(info.pin_token, 'base64'),
        privateKeyBytes,
        'SHA-256',
        Buffer.from(info.session_id)
      );
      aesKey = Buffer.from(aesKeyBuffer).toString('base64');
      console.log(aesKey);

      var csvStream = csv.createWriteStream({headers: false, ignoreEmpty: true}),
          writableStream = fs.createWriteStream(WalletName, {flags: 'a'});

      writableStream.on("finish", function(){
        console.log("Bitcoin wallet DONE!");
      });
      csvStream.pipe(writableStream);
      csvStream.write({a: privateKey, b: info.pin_token,
                       c: info.session_id, d: info.user_id,
                       e: "123456"}
                     );
      csvStream.end();
      fs.appendFile(WalletName, require("os").EOL, function(){});

      const newUserConfig = {clientId: info.user_id, aesKey: aesKey,
                             privateKey: privateKey, sessionId: info.session_id,
                             clientSecret: "do not need", assetPin: "123456"};
      console.log(newUserConfig);
      const newUserClient = new HttpClient(newUserConfig);
      var info2 = await newUserClient.updatePin({oldPin : "",
                                                 newPin: "123456",
                                               });
      console.log(info2);

      const verifyPin = await newUserClient.verifyPin("123456");
      console.log({ verifyPin });
      //run again
      runScript(scriptName, [], function (err) {
          if (err) throw err;
      });
    })();
  } else { //must select a wallet
    console.log("You select the wallet " + process.argv[2]);
    const TYPE_WALLET_ASSETS_INFO        = 'aw: Read Wallet All Asssets Information';
    const TYPE_BOT_ASSETS_INFO           = 'ab: Read Bot All Asssets Information';
    const TYPE_BITCOIN_INFO              = '1: Read Bitcoin Balance & Address';
    const TYPE_USDT_INFO                 = '2: Read USDT Balance & Address';
    const TYPE_EOS_INFO                  = '3: Read EOS Balance & Address';
    const TYPE_TRANS_BTC_TO_WALLET       = '4: Transfer BTC from Bot to Wallet';
    const TYPE_TRANS_EOS_TO_WALLET       = '5: Transfer EOS from Bot to Wallet';
    const TYPE_TRANS_BTC_TO_MASTER       = '6: Transfer BTC from Wallet to Master';
    const TYPE_TRANS_EOS_TO_MASTER       = '7: Transfer EOS from Wallet to Master';
    const TYPE_TRANS_USDT_TO_WALLET      = 'tub: Transfer USDT from Bot to Wallet';
    const TYPE_TRANS_USDT_TO_MASTER      = 'tum: Transfer USDT from Wallet to Master';
    const TYPE_TRANS_CNB_TO_WALLET       = 'tcb: Transfer CNB from Bot to Wallet';
    const TYPE_TRANS_CNB_TO_MASTER       = 'tcm: Transfer CNB from Wallet to Master';
    const TYPE_TRANS_ERC_TO_WALLET       = 'trb: Transfer ERC20 from Bot to Wallet';
    const TYPE_TRANS_ERC_TO_MASTER       = 'trm: Transfer ERC20 from Wallet to Master';
    const TYPE_VERIFY_PIN                = '8: Verify Wallet PIN ';
    const TYPE_BOT_VERIFY_PIN            = '9: Verify Bot PIN ';
    const TYPE_BTC_WITHDRAW              = '10: BTC withdraw';
    const TYPE_EOS_WITHDRAW              = '11: EOS withdraw';
    const TYPE_BTC_WITHDRAW_READ         = '12: Fetch BTC withdrawal info';
    const TYPE_EOS_WITHDRAW_READ         = '13: Fetch EOS withdrawal info';
    const TYPE_FETCH_USDT_MARKETINFO     = '14: Fetch ExinCore Market info by USDT';
    const TYPE_FETCH_BTC_MARKETINFO      = '15: Fetch ExinCore Market info by BTC';
    const TYPE_EXCHANGE_BTC_USDT         = '16: Transfer 0.0001 BTC buy USDT';
    const TYPE_EXCHANGE_USDT_BTC         = '17: Transfer USDT $1 buy BTC';
    const TYPE_READ_SNAPSHOTS            = '18: Read snapshots';
    const TYPE_SEPRATE_LINE              = '--------------OCean.One-------------------------';
    const TYPE_OO_FETCH_BTC_USDT         = '19: Fetch BTC/USDT order book';
    const TYPE_OO_FETCH_XIN_USDT         = '20: Fetch XIN/USDT order book';
    const TYPE_OO_FETCH_ERC_USDT         = '21: Fetch ERC20/USDT order book';
    const TYPE_OO_SELL_BTC_USDT          = '22: Sell BTC/USDT ';
    const TYPE_OO_SELL_XIN_USDT          = '23: Sell XIN/USDT ';
    const TYPE_OO_SELL_ERC_USDT          = '24: Sell ERC20/USDT ';
    const TYPE_OO_BUY_BTC_USDT           = '25: Buy BTC/USDT ';
    const TYPE_OO_BUY_XIN_USDT           = '26: Buy XIN/USDT ';
    const TYPE_OO_BUY_ERC_USDT           = '27: Buy ERC20/USDT ';
    const TYPE_OO_CANCEL_ORDER           = '28: Cancel the order';
    const prompts = [
      {
        name: 'type',
        type: 'list',
        pageSize: 45,
        default: TYPE_WALLET_ASSETS_INFO,
        message: PromptCmd,
        choices: [TYPE_WALLET_ASSETS_INFO, TYPE_BOT_ASSETS_INFO, TYPE_BITCOIN_INFO, TYPE_USDT_INFO,
                  TYPE_EOS_INFO, TYPE_TRANS_BTC_TO_WALLET,TYPE_TRANS_EOS_TO_WALLET, TYPE_TRANS_BTC_TO_MASTER,
                  TYPE_TRANS_EOS_TO_MASTER,TYPE_TRANS_USDT_TO_WALLET,TYPE_TRANS_USDT_TO_MASTER,
                  TYPE_TRANS_CNB_TO_WALLET,TYPE_TRANS_CNB_TO_MASTER,
                  TYPE_TRANS_ERC_TO_WALLET,TYPE_TRANS_ERC_TO_MASTER,
                  TYPE_VERIFY_PIN, TYPE_BOT_VERIFY_PIN, TYPE_BTC_WITHDRAW, TYPE_EOS_WITHDRAW, TYPE_BTC_WITHDRAW_READ,
                  TYPE_EOS_WITHDRAW_READ, TYPE_FETCH_USDT_MARKETINFO, TYPE_FETCH_BTC_MARKETINFO,
                  TYPE_EXCHANGE_BTC_USDT, TYPE_EXCHANGE_USDT_BTC, TYPE_READ_SNAPSHOTS, TYPE_SEPRATE_LINE,
                  TYPE_OO_FETCH_BTC_USDT,TYPE_OO_FETCH_XIN_USDT, TYPE_OO_FETCH_ERC_USDT,
                  TYPE_OO_SELL_BTC_USDT, TYPE_OO_SELL_XIN_USDT, TYPE_OO_SELL_ERC_USDT,
                  TYPE_OO_BUY_BTC_USDT, TYPE_OO_BUY_XIN_USDT, TYPE_OO_BUY_ERC_USDT,TYPE_OO_CANCEL_ORDER,
                  "Exit"],
      },
    ];
    (async () => {
      const args = await inquirer.prompt(prompts);
      console.log('You choice to :', args);
      console.log('You wallet is :', process.argv[2]);
      if ( args.type === 'Exit' ) { process.exit(); }
      var stream = fs.createReadStream(WalletName);
      csv
       .fromStream(stream, {headers: false})
       .on("data", function(data){
         (async () => {
           if ( process.argv[2] === data[3] ) {
             // console.log(data[0]);
             // console.log(args);
             let aesKey = '';
             const privateKeyBytes = pem.decode(Buffer.from(data[0]));
             const aesKeyBuffer = await oaepDecrypt(
               Buffer.from(data[1], 'base64'),
               privateKeyBytes,
               'SHA-256',
               Buffer.from(data[2])
             );
             aesKey = Buffer.from(aesKeyBuffer).toString('base64');
             // console.log(aesKey);
             const newUserConfig = {clientId: data[3], aesKey: aesKey,
                                    privateKey: data[0], sessionId: data[2],
                                    clientSecret: "do not need", assetPin: data[4]};
             // console.log(newUserConfig);
             const newUserClient = new HttpClient(newUserConfig);
             if ( args.type === TYPE_WALLET_ASSETS_INFO ) {
               const assetsInfo = await newUserClient.getUserAssets();
               console.log("-AssetID--Asset--Balance--public_key--");
               assetsInfo.forEach(function(element) {
                  console.log(element.asset_id + "  " +
                              element.symbol + "  " +
                              element.balance + "  " +
                              element.public_key + " " +
                              element.account_name + "  " +
                              element.account_tag
                            );
                });
               // console.log(assetsInfo);
             } else if ( args.type === TYPE_BOT_ASSETS_INFO ) {
                  const assetsInfo = await clientBot.getUserAssets();
                  console.log("-AssetID--Asset--Balance--public_key--");
                  assetsInfo.forEach(function(element) {
                     console.log(element.asset_id + "  " +
                                 element.symbol + "  " +
                                 element.balance + "  " +
                                 element.public_key + " " +
                                 element.account_name + "  " +
                                 element.account_tag
                               );
                   });
                  // console.log(assetsInfo);
                } else if (args.type === TYPE_BITCOIN_INFO) {
                // console.log('You choice to 1:', args);
                const assetInfo = await newUserClient.getUserAsset(BTC_ASSET_ID);
                console.log("Bitcoin address is ", assetInfo.public_key);
                console.log("Bitcoin balance is ", assetInfo.balance);
                console.log("Bitcoin price is (USD) ", assetInfo.price_usd);
             } else if (args.type === TYPE_USDT_INFO) {
               // console.log('You choice to 1:', args);
               const assetInfo = await newUserClient.getUserAsset(USDT_ASSET_ID);
               console.log("USDT address is ", assetInfo.public_key);
               console.log("USDT balance is ", assetInfo.balance);
               console.log("USDT price is (USD) ", assetInfo.price_usd);
             } else if (args.type === TYPE_EOS_INFO) {
               // console.log('You choice to 1:', args);
               const assetInfo = await newUserClient.getUserAsset(EOS_ASSET_ID);
               console.log("EOS account name is ", assetInfo.account_name, " tag is ", assetInfo.account_tag);
               console.log("EOS balance is ", assetInfo.balance);
               console.log("EOS price is (USD) ", assetInfo.price_usd);
             } else if (args.type === TYPE_TRANS_BTC_TO_WALLET) {
               // console.log('You choice to 1:', args);
               const assetInfo = await clientBot.getUserAsset(BTC_ASSET_ID);
               console.log("The Bot 's BTC balance is ", assetInfo.balance);
               if ( assetInfo.balance > 0 ) {
                 const Obj = {
                   assetId: BTC_ASSET_ID,
                   recipientId: process.argv[2],
                     traceId: clientBot.getUUID(),
                     amount: assetInfo.balance,
                     memo: '',
                 };
                 console.log(Obj);
                 transInfo = await clientBot.transferFromBot(Obj);
                 console.log(transInfo);
               }
             } else if (args.type === TYPE_TRANS_USDT_TO_WALLET) {
               // console.log('You choice to 1:', args);
               const assetInfo = await clientBot.getUserAsset(USDT_ASSET_ID);
               console.log("The Bot 's USDT balance is ", assetInfo.balance);
               if ( assetInfo.balance > 0 ) {
                 const Obj = {
                   assetId: USDT_ASSET_ID,
                   recipientId: process.argv[2],
                     traceId: clientBot.getUUID(),
                     amount: assetInfo.balance,
                     memo: '',
                 };
                 console.log(Obj);
                 transInfo = await clientBot.transferFromBot(Obj);
                 console.log(transInfo);
               }
             } else if (args.type === TYPE_TRANS_ERC_TO_WALLET) {
               // console.log('You choice to 1:', args);
               const assetInfo = await clientBot.getUserAsset(ERC20_BENZ);
               console.log("The Bot 's USDT balance is ", assetInfo.balance);
               if ( assetInfo.balance > 0 ) {
                 const Obj = {
                   assetId: ERC20_BENZ,
                   recipientId: process.argv[2],
                     traceId: clientBot.getUUID(),
                     amount: assetInfo.balance,
                     memo: '',
                 };
                 console.log(Obj);
                 transInfo = await clientBot.transferFromBot(Obj);
                 console.log(transInfo);
               }
             } else if (args.type === TYPE_TRANS_EOS_TO_WALLET) {
               // console.log('You choice to 1:', args);
               const assetInfo = await clientBot.getUserAsset(EOS_ASSET_ID);
               console.log("The Bot 's EOS balance is ", assetInfo.balance);
               if ( assetInfo.balance > 0 ) {
                 const Obj = {
                   assetId: EOS_ASSET_ID,
                   recipientId: process.argv[2],
                     traceId: clientBot.getUUID(),
                     amount: assetInfo.balance,
                     memo: '',
                 };
                 console.log(Obj);
                 clientBot.transferFromBot(Obj);
               }
             }  else if (args.type === TYPE_TRANS_CNB_TO_WALLET) {
               // console.log('You choice to 1:', args);
               const assetInfo = await clientBot.getUserAsset(CNB_ASSET_ID);
               console.log("The Bot 's CNB balance is ", assetInfo.balance);
               if ( assetInfo.balance > 0 ) {
                 const Obj = {
                   assetId: CNB_ASSET_ID,
                   recipientId: process.argv[2],
                     traceId: clientBot.getUUID(),
                     amount: assetInfo.balance,
                     memo: '',
                 };
                 console.log(Obj);
                 clientBot.transferFromBot(Obj);
               }
             } else if (args.type === TYPE_TRANS_BTC_TO_MASTER) {
               // console.log('You choice to 1:', args);
               const assetInfo = await newUserClient.getUserAsset(BTC_ASSET_ID);
               console.log("The Wallet 's BTC balance is ", assetInfo.balance);
               if ( assetInfo.balance > 0 ) {
                 const Obj = {
                   assetId: BTC_ASSET_ID,
                   recipientId: MASTER_UUID,
                     traceId: newUserClient.getUUID(),
                     amount: assetInfo.balance,
                     memo: '',
                 };
                 console.log(Obj);
                 newUserClient.transferFromBot(Obj);
               }
             } else if (args.type === TYPE_TRANS_EOS_TO_MASTER) {
               // console.log('You choice to 1:', args);
               const assetInfo = await newUserClient.getUserAsset(EOS_ASSET_ID);
               console.log("The Wallet 's EOS balance is ", assetInfo.balance);
               if ( assetInfo.balance > 0 ) {
                 const Obj = {
                   assetId: EOS_ASSET_ID,
                   recipientId: MASTER_UUID,
                     traceId: newUserClient.getUUID(),
                     amount: assetInfo.balance,
                     memo: '',
                 };
                 console.log(Obj);
                 newUserClient.transferFromBot(Obj);
               }
             } else if (args.type === TYPE_TRANS_USDT_TO_MASTER) {
               // console.log('You choice to 1:', args);
               const assetInfo = await newUserClient.getUserAsset(USDT_ASSET_ID);
               console.log("The Wallet 's USDT balance is ", assetInfo.balance);
               if ( assetInfo.balance > 0 ) {
                 const Obj = {
                   assetId: USDT_ASSET_ID,
                   recipientId: MASTER_UUID,
                     traceId: newUserClient.getUUID(),
                     amount: assetInfo.balance,
                     memo: '',
                 };
                 console.log(Obj);
                 newUserClient.transferFromBot(Obj);
               }
             } else if (args.type === TYPE_TRANS_CNB_TO_MASTER) {
               // console.log('You choice to 1:', args);
               const assetInfo = await newUserClient.getUserAsset(CNB_ASSET_ID);
               console.log("The Wallet 's CNB balance is ", assetInfo.balance);
               if ( assetInfo.balance > 0 ) {
                 const Obj = {
                   assetId: CNB_ASSET_ID,
                   recipientId: MASTER_UUID,
                     traceId: newUserClient.getUUID(),
                     amount: assetInfo.balance,
                     memo: '',
                 };
                 console.log(Obj);
                 newUserClient.transferFromBot(Obj);
               }
             }  else if (args.type === TYPE_TRANS_ERC_TO_MASTER) {
               // console.log('You choice to 1:', args);
               const assetInfo = await newUserClient.getUserAsset(USDT_ASSET_ID);
               console.log("The Wallet 's USDT balance is ", assetInfo.balance);
               if ( assetInfo.balance > 0 ) {
                 const Obj = {
                   assetId: USDT_ASSET_ID,
                   recipientId: MASTER_UUID,
                     traceId: newUserClient.getUUID(),
                     amount: assetInfo.balance,
                     memo: '',
                 };
                 console.log(Obj);
                 newUserClient.transferFromBot(Obj);
               }
             }  else if (args.type === TYPE_VERIFY_PIN) {
               // console.log('You choice to 1:', args);
               const verifyPin = await newUserClient.verifyPin(data[4]);
               // const updatePin = await client.updatePin({ oldPin: config.assetPin, newPin: '123456' }); // CAUTION
               console.log({ verifyPin });
             } else if (args.type === TYPE_BTC_WITHDRAW) {
               const withdrawAddress = await newUserClient.createWithdrawAddress({
                 assetId: BTC_ASSET_ID,
                 label: 'BTC withdraw',
                 publicKey: BTC_WALLET_ADDR,
               });
               console.log(withdrawAddress);
               const prompts = [
                 {
                   name: 'amount',
                   type: 'input',
                   message: "Input you BTC amount: ",
                 },
               ];
              const answers = await inquirer.prompt(prompts);
              console.log(answers);
              const withdrawResult = await newUserClient.withdraw({
                 addressId: withdrawAddress.address_id,
                 assetId: BTC_ASSET_ID,
                 amount: answers.amount,
                 memo: 'withdraw by nodejs',
              });
              console.log(withdrawResult);
            } else if (args.type === TYPE_EOS_WITHDRAW) {
              const withdrawAddress = await newUserClient.createWithdrawAddress({
                assetId: EOS_ASSET_ID,
                label: 'EOS withdraw',
                publicKey: "do not need",
                accountName: EOS_WALLET_NAME,
                accountTag: EOS_WALLET_TAG,
              });
              console.log(withdrawAddress);
              // const addressList = await newUserClient.getWithdrawAddress(EOS_ASSET_ID);
              // console.log(addressList);
              const prompts = [
                {
                  name: 'amount',
                  type: 'input',
                  message: "Input withdrawal BTC amount: ",
                },
              ];
             const answers = await inquirer.prompt(prompts);
             console.log(answers);
             const withdrawResult = await newUserClient.withdraw({
                addressId: withdrawAddress.address_id,
                assetId: EOS_ASSET_ID,
                amount: answers.amount,
                memo: 'withdraw by nodejs',
             });
             console.log(withdrawResult);
           } else if (args.type === TYPE_EOS_WITHDRAW_READ) {
              const addressList = await newUserClient.getWithdrawAddress(EOS_ASSET_ID);
              console.log(addressList);
            } else if (args.type === TYPE_BTC_WITHDRAW_READ) {
               const addressList = await newUserClient.getWithdrawAddress(BTC_ASSET_ID);
               console.log(addressList);
             } else if ( args.type === TYPE_EXCHANGE_BTC_USDT ) {
               // Pack memo
               const bytes = Buffer.from(
                 USDT_ASSET_ID.replace(/-/g, ''),
                 'hex'
               );
               const memo = msgpack
                 .encode({
                   A: bytes,
                 })
                 .toString('base64');

               console.log(memo); // gaFBxBDG0McoJiRCm44N2dGbZZL6
               const assetInfo = await newUserClient.getUserAsset(BTC_ASSET_ID);
               console.log("The Wallet 's BTC balance is ", assetInfo.balance);
               if ( assetInfo.balance >= 0.0001 ) {
                 const Obj = {
                   assetId: BTC_ASSET_ID,
                   recipientId: EXIN_BOT,
                     traceId: newUserClient.getUUID(),
                     amount: "0.0001",
                     memo: memo,
                   }
                   console.log(Obj);
                   newUserClient.transferFromBot(Obj);
               } else {
                 console.log("Not enough BTC!");
               }
             } else if ( args.type === TYPE_EXCHANGE_USDT_BTC ) {
               // Pack memo
               const bytes = Buffer.from(
                 BTC_ASSET_ID.replace(/-/g, ''),
                 'hex'
               );
               const memo = msgpack
                 .encode({
                   A: bytes,
                 })
                 .toString('base64');

               console.log(memo);
               const assetInfo = await newUserClient.getUserAsset(USDT_ASSET_ID);
               console.log("The Wallet 's BTC balance is ", assetInfo.balance);
               if ( assetInfo.balance >= 1 ) {
                 const Obj = {
                   assetId: USDT_ASSET_ID,
                   recipientId: EXIN_BOT,
                     traceId: newUserClient.getUUID(),
                     amount: "1",
                     memo: memo,
                   }
                   console.log(Obj);
                   newUserClient.transferFromBot(Obj);
               } else {
                 console.log("Not enough USDT!");
               }
             } else if (  args.type === TYPE_FETCH_USDT_MARKETINFO ) {
               FetchExinCoreMarketInfos(USDT_ASSET_ID);
             } else if (  args.type === TYPE_FETCH_BTC_MARKETINFO ) {
               FetchExinCoreMarketInfos(BTC_ASSET_ID);
            } else if ( args.type === TYPE_READ_SNAPSHOTS ) {
              let answers;
              if ( process.argv[2] === '0b10471b-1aed-3944-9eda-5ab947562761' )
              {
                answers = { datetime: '2019-04-08T05:16:33.615253Z'};
              } else {
                const prompts = [
                  {
                    name: 'datetime',
                    type: 'input',
                    message: "Input iso8601 datetime: ",
                  },
                ];
                answers = await inquirer.prompt(prompts);
                console.log(answers);
              }
              console.log(encodeURIComponent(answers.datetime));
              const snapshots = await newUserClient.getSnapshots({ limit: 10, asset: USDT_ASSET_ID, offset: answers.datetime, order: "ASC"});
              // console.log(snapshots);
              snapshots.forEach(function(element) {
               if ( element.amount > 0) {
                 if ( element.data != null ) {
                    console.log(element.amount);
                    console.log(element.data);
                    const buf = Buffer.from(element.data, 'base64');
                    console.log(msgpack.decode(buf));
                    const codeInt = msgpack.decode(buf).C;
                    if ( codeInt === 1000 ) {
                      console.log("Successful Exchange");
                    } else { console.log("Go to there get more info https://github.com/exinone/exincore#code error code: " + codeStr);}

                    const hexStr = Buffer.from(msgpack.decode(buf).FA).toString('hex');
                    const uuid = `${hexStr.slice(0,8)}-${hexStr.slice(8,12)}-${hexStr.slice(12,16)}-${hexStr.slice(16,20)}-${hexStr.slice(20)}`;
                    console.log("Asset uuid is :" + uuid);
                    const priceStr = msgpack.decode(buf).P;
                    console.log("Price is :" + priceStr);
                    const feeStr = msgpack.decode(buf).F;
                    console.log("Fee is :" + feeStr);
                    console.log("percent of Fee is :" + (feeStr/element.amount)* 100 + " %");
                    const tStr = msgpack.decode(buf).T;
                    console.log("T is :" + tStr);
                 }
               }
             });
           } else if ( args.type === TYPE_OO_FETCH_BTC_USDT ) {
             FetchOceanOneMarketInfos(BTC_ASSET_ID, USDT_ASSET_ID);
          }
           else if ( args.type === TYPE_OO_FETCH_XIN_USDT ) {
            FetchOceanOneMarketInfos(XIN_ASSET_ID, USDT_ASSET_ID);
          } else if ( args.type === TYPE_OO_FETCH_ERC_USDT ) {
            FetchOceanOneMarketInfos(ERC20_BENZ, USDT_ASSET_ID);
          } else if ( args.type === TYPE_OO_SELL_BTC_USDT ) {
            var prompts = [
              {
                name: 'price',
                type: 'input',
                message: "Input the price of BTC/USDT: ",
              },
            ];
            price = await inquirer.prompt(prompts);
            var prompts = [
              {
                name: 'amount',
                type: 'input',
                message: "Input the amount of BTC: ",
              },
            ];
            amount = await inquirer.prompt(prompts);
            console.log(price);
            console.log(amount);
            const memo = GenerateOceanMemo(USDT_ASSET_ID,"A",price.price);
            const assetInfo = await newUserClient.getUserAsset(BTC_ASSET_ID);
            console.log("The Wallet 's USDT balance is ", assetInfo.balance);
            if ( assetInfo.balance >= amount.amount ) {
              const Obj = {
                assetId: BTC_ASSET_ID,
                recipientId: OCEANONE_BOT,
                  traceId: newUserClient.getUUID(),
                  amount: amount.amount,
                  memo: memo,
                }
                const transInfo = await newUserClient.transferFromBot(Obj);
                console.log(transInfo);
                console.log("The Order id is " + transInfo.trace_id + " It is needed to cancel the order!");
            } else {
              console.log("Not enough BTC!");
            }
          }  else if ( args.type === TYPE_OO_SELL_XIN_USDT ) {
            var prompts = [
              {
                name: 'price',
                type: 'input',
                message: "Input the price of XIN/USDT: ",
              },
            ];
            price = await inquirer.prompt(prompts);
            var prompts = [
              {
                name: 'amount',
                type: 'input',
                message: "Input the amount of XIN: ",
              },
            ];
            amount = await inquirer.prompt(prompts);
            console.log(price);
            console.log(amount);
            const memo = GenerateOceanMemo(XIN_ASSET_ID,"A",price.price);
            const assetInfo = await newUserClient.getUserAsset(BTC_ASSET_ID);
            console.log("The Wallet 's USDT balance is ", assetInfo.balance);
            if ( assetInfo.balance >= amount.amount ) {
              const Obj = {
                assetId: XIN_ASSET_ID,
                recipientId: OCEANONE_BOT,
                  traceId: newUserClient.getUUID(),
                  amount: amount.amount,
                  memo: memo,
                }
                const transInfo = await newUserClient.transferFromBot(Obj);
                console.log(transInfo);
                console.log("The Order id is " + transInfo.trace_id + " It is needed to cancel the order!");
            } else {
              console.log("Not enough XIN!");
            }
          }  else if ( args.type === TYPE_OO_SELL_ERC_USDT ) {
            var prompts = [
              {
                name: 'price',
                type: 'input',
                message: "Input the price of ERC(Benz)/USDT: ",
              },
            ];
            price = await inquirer.prompt(prompts);
            var prompts = [
              {
                name: 'amount',
                type: 'input',
                message: "Input the amount of ERC20(Benz): ",
              },
            ];
            amount = await inquirer.prompt(prompts);
            console.log(price);
            console.log(amount);
            const memo = GenerateOceanMemo(USDT_ASSET_ID,"A",price.price);
            const assetInfo = await newUserClient.getUserAsset(ERC20_BENZ);
            console.log("The Wallet 's USDT balance is ", assetInfo.balance);
            if ( assetInfo.balance >= amount.amount ) {
              const Obj = {
                assetId: ERC20_BENZ,
                recipientId: OCEANONE_BOT,
                  traceId: newUserClient.getUUID(),
                  amount: amount.amount,
                  memo: memo,
                }
                const transInfo = await newUserClient.transferFromBot(Obj);
                console.log(transInfo);
                console.log("The Order id is " + transInfo.trace_id + " It is needed to cancel the order!");
            } else {
              console.log("Not enough ERC20_BENZ!");
            }
          }  else if ( args.type === TYPE_OO_BUY_BTC_USDT ) {
            var prompts = [
              {
                name: 'price',
                type: 'input',
                message: "Input the price of BTC/USDT: ",
              },
            ];
            price = await inquirer.prompt(prompts);
            var prompts = [
              {
                name: 'amount',
                type: 'input',
                message: "Input the amount of USDT: ",
              },
            ];
            amount = await inquirer.prompt(prompts);
            console.log(price);
            console.log(amount);
            const memo = GenerateOceanMemo(BTC_ASSET_ID,"B",price.price);
            const assetInfo = await newUserClient.getUserAsset(USDT_ASSET_ID);
            console.log("The Wallet 's USDT balance is ", assetInfo.balance);
            if ( assetInfo.balance >= amount.amount && assetInfo.balance >= 1 ) {
              const Obj = {
                assetId: USDT_ASSET_ID,
                recipientId: OCEANONE_BOT,
                  traceId: newUserClient.getUUID(),
                  amount: amount.amount,
                  memo: memo,
                }
                const transInfo = await newUserClient.transferFromBot(Obj);
                console.log(transInfo);
                console.log("The Order id is " + transInfo.trace_id + " It is needed to cancel the order!");
            } else {
              console.log("Not enough USDT!");
            }
          }   else if ( args.type === TYPE_OO_BUY_XIN_USDT ) {
            var prompts = [
              {
                name: 'price',
                type: 'input',
                message: "Input the price of XIN/USDT: ",
              },
            ];
            price = await inquirer.prompt(prompts);
            var prompts = [
              {
                name: 'amount',
                type: 'input',
                message: "Input the amount of USDT: ",
              },
            ];
            amount = await inquirer.prompt(prompts);
            console.log(price);
            console.log(amount);
            const memo = GenerateOceanMemo(XIN_ASSET_ID,"B",price.price);
            const assetInfo = await newUserClient.getUserAsset(USDT_ASSET_ID);
            console.log("The Wallet 's USDT balance is ", assetInfo.balance);
            if ( assetInfo.balance >= amount.amount && assetInfo.balance >= 1 ) {
              const Obj = {
                assetId: USDT_ASSET_ID,
                recipientId: OCEANONE_BOT,
                  traceId: newUserClient.getUUID(),
                  amount: amount.amount,
                  memo: memo,
                }
                const transInfo = await newUserClient.transferFromBot(Obj);
                console.log(transInfo);
                console.log("The Order id is " + transInfo.trace_id + " It is needed to cancel the order!");
            } else {
              console.log("Not enough USDT!");
            }
          }  else if ( args.type === TYPE_OO_BUY_ERC_USDT ) {
            var prompts = [
              {
                name: 'price',
                type: 'input',
                message: "Input the price of ERC20(Benz)/USDT: ",
              },
            ];
            price = await inquirer.prompt(prompts);
            var prompts = [
              {
                name: 'amount',
                type: 'input',
                message: "Input the amount of USDT: ",
              },
            ];
            amount = await inquirer.prompt(prompts);
            console.log(price);
            console.log(amount);
            const memo = GenerateOceanMemo(ERC20_BENZ,"B",price.price);
            const assetInfo = await newUserClient.getUserAsset(USDT_ASSET_ID);
            console.log("The Wallet 's USDT balance is ", assetInfo.balance);
            if ( assetInfo.balance >= amount.amount && assetInfo.balance >= 1 ) {
              const Obj = {
                assetId: USDT_ASSET_ID,
                recipientId: OCEANONE_BOT,
                  traceId: newUserClient.getUUID(),
                  amount: amount.amount,
                  memo: memo,
                }
                const transInfo = await newUserClient.transferFromBot(Obj);
                console.log(transInfo);
                console.log("The Order id is " + transInfo.trace_id + " It is needed to cancel the order!");
            } else {
              console.log("Not enough USDT!");
            }
          }  else if ( args.type === TYPE_OO_CANCEL_ORDER ) {
            const prompts = [
              {
                name: 'order_id',
                type: 'input',
                message: "Input iso8601 datetime: ",
              },
            ];
            answers = await inquirer.prompt(prompts);
            const memo = GenerateOceanCancelMemo(answers.order_id);
            const assetInfo = await newUserClient.getUserAsset(CNB_ASSET_ID);
            console.log("The Wallet 's USDT balance is ", assetInfo.balance);
            if ( assetInfo.balance >= 0.00000001 ) {
              const Obj = {
                assetId: CNB_ASSET_ID,
                recipientId: OCEANONE_BOT,
                  traceId: newUserClient.getUUID(),
                  amount: "0.00000001",
                  memo: memo,
                }
                const transInfo = await newUserClient.transferFromBot(Obj);
                console.log(transInfo);
            } else {
              console.log("Not enough CNB!");
            }
          }
             runScript(scriptName, [process.argv[2]], function (err) {
                 if (err) throw err;
             });
           }
           })();
       })
       .on("end", function(){
       });
    })();
  }
}
function GenerateOceanCancelMemo(targetAsset) {
  const bytes = Buffer.from(
    targetAsset.replace(/-/g, ''),
    'hex'
  );
  const memo = msgpack
    .encode({
      O: bytes,
    })
    .toString('base64');
  console.log(memo);
  return memo;
}

function GenerateOceanMemo(targetAsset,side,price) {
  const bytes = Buffer.from(
    targetAsset.replace(/-/g, ''),
    'hex'
  );
  const memo = msgpack
    .encode({
      S: side,
      A: bytes,
      P: price,
      T: "L",
    })
    .toString('base64');
  console.log(memo);
  return memo;
}
function FetchExinCoreMarketInfos(_assetID) {
  var instance = axios.create({
  baseURL: 'https://exinone.com/exincore/markets',
  timeout: 3000,
  headers: {'X-Custom-Header': 'foobar'}
  });
  instance.get('?base_asset=' + _assetID)
  .then(function(response) {
    console.log("-Asset--Price--MinAmount--MaxAmount--Exchange")
    response.data.data.forEach(function(element) {
       console.log(element.exchange_asset_symbol + "     " +
                   element.price + "     " +
                   element.minimum_amount + "     " +
                   element.maximum_amount + "     " +
                   element.exchanges);
     });
    // console.log(response.data.data);
  });
}

function FetchOceanOneMarketInfos(asset_id, base_asset) {
  var instance = axios.create({
  baseURL: "https://events.ocean.one/markets/" + asset_id + "-" + base_asset + "/book",
  timeout: 3000,
  headers: {'X-Custom-Header': 'foobar'}
  });
  instance.get()
  .then(function(response) {
    console.log("--Price--Amount--Funds--Side")
    response.data.data.data.asks.forEach(function(element) {
       console.log(element.price + "     " +
                   element.amount + "     " +
                   element.funds + "     " +
                   element.side);
     });
     response.data.data.data.bids.forEach(function(element) {
        console.log(element.price + "     " +
                    element.amount + "     " +
                    element.funds + "     " +
                    element.side);
      });
    // console.log(response.data.data.data.asks);
  });
}
