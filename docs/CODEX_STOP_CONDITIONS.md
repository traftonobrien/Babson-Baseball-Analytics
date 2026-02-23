# Codex Stop Conditions

## Stop Immediately If
- Requires schema break
- Requires architectural redesign
- Tests fail twice consecutively
- Metrics cannot be made numerically stable
- Data insufficient
- Multi-module ripple effect detected

## Required Stop Output
If stopping, output all three:
1. Root cause
2. Why not locally fixable
3. Proposed next step

## Execution Rule
Do not continue patching after stop conditions are met until direction is confirmed.
