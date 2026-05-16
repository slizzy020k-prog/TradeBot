#!/usr/bin/env node

import { tradeBot } from './bot';
import { logger } from './utils/logger';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case 'start': {
      const symbols = args.slice(1);
      if (symbols.length === 0) {
        console.log('Usage: npm run cli start <symbol1> [symbol2] ...');
        console.log('Example: npm run cli start AAPL TSLA');
        process.exit(1);
      }
      tradeBot.start(symbols);
      console.log(`TradeBot started watching: ${symbols.join(', ')}`);
      break;
    }

    case 'stop':
      tradeBot.stop();
      console.log('TradeBot stopped');
      break;

    case 'status': {
      const status = tradeBot.status();
      console.log(`Running: ${status.running}`);
      console.log(`Symbols: ${(status.symbols || []).join(', ') || 'none'}`);
      break;
    }

    case 'add-info': {
      const content = args.slice(1).join(' ');
      if (!content) {
        console.log('Usage: npm run cli add-info <information text>');
        process.exit(1);
      }
      tradeBot.addUserInfo(content);
      console.log('Info added successfully');
      break;
    }

    case 'stats': {
      const memStats = tradeBot.getMemoryStats();
      const learningStats = tradeBot.getLearningStats();

      console.log('Memory Stats:');
      console.log(`  Total entries: ${memStats.total}`);
      console.log(`  By type: ${JSON.stringify(memStats.byType)}`);

      console.log('\nLearning Stats:');
      console.log(`  Total trades with outcomes: ${learningStats.total}`);
      console.log(`  Wins: ${learningStats.wins}`);
      console.log(`  Losses: ${learningStats.losses}`);
      if (learningStats.total > 0) {
        const winRate = ((learningStats.wins / learningStats.total) * 100).toFixed(1);
        console.log(`  Win rate: ${winRate}%`);
      }
      break;
    }

    case 'help':
    default:
      console.log('TradeBot CLI');
      console.log('');
      console.log('Commands:');
      console.log('  npm run cli start <symbol1> [symbol2] ...  - Start the bot watching symbols');
      console.log('  npm run cli stop                           - Stop the bot');
      console.log('  npm run cli status                          - Show bot status');
      console.log('  npm run cli add-info <text>                 - Add user information');
      console.log('  npm run cli stats                           - Show memory and learning stats');
      console.log('  npm run cli help                           - Show this help');
      break;
  }
}

main().catch(error => {
  logger.error('CLI error:', error);
  process.exit(1);
});