import moment from 'moment';
import axios from 'axios';
import sqlite3 from 'sqlite3';
import csv from 'csv-parser';
import fs from 'fs';
import * as rl from 'readline';
import { stdin as input, stdout as output } from 'node:process';
import * as dotenv from 'dotenv';
dotenv.config();

// Create interface for terminal input
const readline = rl.createInterface({ input, output });

// Open the SQLite database
const db = new sqlite3.Database('src/data/crypto-portfolio-db.sqlite');

// Create a table to store the CSV data
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, timestamp INTEGER, transaction_type TEXT, token TEXT, amount INTEGER)');
});

function seedData() {
  // Read the CSV file and insert its data into the database if not exist
  let dataLength = 1;
  fs.createReadStream('src/data/transactions.csv')
    .pipe(csv())
    .on('data', (row: { timestamp: any; transaction_type: any; token: any; amount: any }) => {
      db.run(`INSERT OR IGNORE INTO transactions (id, timestamp, transaction_type, token, amount) VALUES (?, ?, ?, ?, ?)`, [
        dataLength,
        row.timestamp,
        row.transaction_type,
        row.token,
        row.amount,
      ]);
      console.log('INSERT OR IGNORE INTO transactions with id :', dataLength);
      dataLength++;
    })
    .on('end', () => {
      console.log('CSV file successfully imported into SQLite database');
      db.close();
      readline.close();
    });
}

async function fetchTokenPrice(tokenSymbol: string, date: number): Promise<number> {
  // Get crypto price from cryptocompare
  const config = {
    method: 'GET',
    url: `https://min-api.cryptocompare.com/data/v2/histohour?fsym=${tokenSymbol}&tsym=USD&limit=1&toTs=${date}`,
    headers: { accept: 'application/json', authorization: `Apikey ${process.env.CRYPTOCOMPARE_API_KEY}` },
  };

  const response = await axios.request(config);
  const close = response.data.Data.Data[1].close;
  return close;
}

function getLatestUsdValuePerToken() {
  const query = `SELECT token, SUM(CASE WHEN transaction_type = 'DEPOSIT' THEN amount ELSE -amount END) AS net_amount FROM transactions GROUP BY token;`;
  // Query data from the table
  console.log('___________________________________________\n\nResult\n___________________________________________\n');
  db.each(query, async function (error: any, row: { token: string; net_amount: number }) {
    if (error) {
      console.log(error);
    }
    const usdPrice = await fetchTokenPrice(String(row.token), moment().utc().unix());
    console.log(row.token + '\nAmount : ' + row.net_amount.toLocaleString('en') + '\nUSD Value : ' + (row.net_amount * usdPrice).toLocaleString('en') + '\n');
  });
  db.close();
  readline.close();
}

function getUsdValuePerTokenBasedOnDate(date: number) {
  const query = `SELECT token, SUM(CASE WHEN transaction_type = 'DEPOSIT' THEN amount ELSE -amount END) AS net_amount, MAX(timestamp) as latest_date FROM transactions WHERE timestamp <= ${date} GROUP BY token;`;
  // Query data from the table
  console.log('___________________________________________\n\nResult\n___________________________________________\n');
  db.each(query, async function (error: any, row: { token: string; net_amount: number; latest_date: number }) {
    if (error) {
      console.log(error);
    }
    const usdPrice = await fetchTokenPrice(String(row.token), row.latest_date);
    console.log(row.token + '\nAmount : ' + row.net_amount.toLocaleString('en') + '\nUSD Value : ' + (row.net_amount * usdPrice).toLocaleString('en') + '\n');
  });
  db.close();
  readline.close();
}

function getUsdValuePerTokenBasedOnDateAndToken(date: number, tokenSymbol: string) {
  const query = `SELECT token, SUM(CASE WHEN transaction_type = 'DEPOSIT' THEN amount ELSE -amount END) AS net_amount FROM transactions WHERE timestamp <= ${date} AND token='${tokenSymbol}' GROUP BY token;`;
  // Query data from the table
  console.log('___________________________________________\n\nResult\n___________________________________________\n');
  db.each(query, async function (error: any, row: { token: string; net_amount: number }) {
    if (error) {
      console.log(error);
    }
    const usdPrice = await fetchTokenPrice(tokenSymbol, date);
    console.log(row.token + '\nAmount : ' + row.net_amount.toLocaleString('en') + '\nUSD Value : ' + (row.net_amount * usdPrice).toLocaleString('en') + '\n');
  });
  db.close();
  readline.close();
}

function getLatestUsdValueBasedOnToken(tokenSymbol: string) {
  const query = `SELECT token, SUM(CASE WHEN transaction_type = 'DEPOSIT' THEN amount ELSE -amount END) AS net_amount FROM transactions WHERE token='${tokenSymbol}' GROUP BY token;`;
  // Query data from the table
  console.log('___________________________________________\n\nResult\n___________________________________________\n');
  db.each(query, async function (error: any, row: { token: string; net_amount: number }) {
    if (error) {
      console.log(error);
    }
    const usdPrice = await fetchTokenPrice(tokenSymbol, moment().utc().unix());
    console.log(row.token + '\nAmount : ' + row.net_amount.toLocaleString('en') + '\nUSD Value : ' + (row.net_amount * usdPrice).toLocaleString('en') + '\n');
  });
  db.close();
  readline.close();
}

function main() {
  const question =
    'Pick a function number! \n 0. Seed CSV data to SQLite \n 1. getLatestUsdValuePerToken() \n 2. getLatestUsdValueBasedOnToken(tokenSymbol) \n 3. getUsdValuePerTokenBasedOnDate(date) \n 4. getUsdValuePerTokenBasedOnDateAndToken(date, tokenSymbol) \n \nInput number (0-4) : ';
  readline.question(question, (commandNumber: string) => {
    switch (Number(commandNumber)) {
      case 0:
        seedData();
        break;
      case 1:
        getLatestUsdValuePerToken();
        break;
      case 2:
        readline.question('\nInput synmbol (option: BTC, ETH, XRP) : ', (tokenSymbol: string) => {
          if (tokenSymbol == 'BTC' || tokenSymbol == 'ETH' || tokenSymbol == 'XRP') {
            getLatestUsdValueBasedOnToken(tokenSymbol);
          } else {
            console.log('\nNot valid!');
            readline.close();
          }
        });
        break;
      case 3:
        readline.question('\nInput date : ', (date: string) => {
          getUsdValuePerTokenBasedOnDate(Number(date));
        });
        break;
      case 4:
        readline.question('\nInput date : ', (date: string) => {
          readline.question('\nInput synmbol (option: BTC, ETH, XRP) : ', (tokenSymbol: string) => {
            if (tokenSymbol == 'BTC' || tokenSymbol == 'ETH' || tokenSymbol == 'XRP') {
              getUsdValuePerTokenBasedOnDateAndToken(Number(date), tokenSymbol);
            } else {
              console.log('\nNot valid!');
              readline.close();
            }
          });
        });
        break;
      default:
        console.log('\nNot valid!');
        readline.close();
        break;
    }
  });
}

main();