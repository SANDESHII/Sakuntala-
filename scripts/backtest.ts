import { runBacktest } from '../src/core/engine';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('--- Alpha Terminal Backtest Engine ---');
  if (dryRun) {
    console.log('Mode: DRY RUN (Data Planning)');
    console.log('Source Plan:');
    const apiFootballOk = !!process.env.VITE_API_FOOTBALL_KEY;
    const oddsApiOk = !!process.env.VITE_ODDS_API_KEY;

    console.log(`- Fixtures (API-Football): ${apiFootballOk ? 'READY' : 'MISSING KEY'}`);
    console.log(`- Odds (The Odds API): ${oddsApiOk ? 'READY' : 'MISSING KEY'}`);
    console.log(`- xG (Understat): READY (via proxy/stub)`);

    console.log('\nProjection (per 100 fixtures):');
    const fixtureCoverage = apiFootballOk ? 100 : 0;
    const oddsCoverage = (apiFootballOk && oddsApiOk) ? 85 : 0; // Estimation
    const xgCoverage = 92;

    console.log(`- Fixture Match: ${fixtureCoverage}%`);
    console.log(`- Historical Odds Join: ${oddsCoverage}%`);
    console.log(`- xG Coverage: ${xgCoverage}%`);

    console.log('\nQuota Budget (Estimated):');
    console.log(`- api-football: ${apiFootballOk ? '100 reqs' : '0'}`);
    console.log(`- the-odds-api: ${oddsApiOk ? '50 reqs' : '0'}`);

    if (!apiFootballOk || !oddsApiOk) {
      console.log('\n⚠️ WARNING: Missing keys will result in zero-data backtest.');
    }
  } else {
    const result = await runBacktest();
    console.log('Backtest Completed.');
    console.log('-----------------------------------');
    console.log(`Total Matches:    ${result.totalMatches}`);
    console.log(`PnL (Stake=1.0):  ${result.totalPnl.toFixed(2)} units`);
    console.log(`Yield:           ${result.totalYield.toFixed(2)}%`);
    console.log(`Avg CLV:         ${result.avgClv.toFixed(2)}%`);
    console.log(`Brier Score:     ${result.brierScore.toFixed(4)}`);
    console.log(`Over 1.5 Acc:    ${result.over15Accuracy.toFixed(1)}%`);
    console.log(`Under 3.5 Acc:   ${result.under35Accuracy.toFixed(1)}%`);
    console.log('-----------------------------------');
  }
}

main().catch(err => {
  console.error('Backtest Error:', err);
  process.exit(1);
});
