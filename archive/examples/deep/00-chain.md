# Deep fixture: one path to depth 7, no ceiling on depth. Sizes are relaxed in strata.config.json.

## DP.need · Bill customers monthly
> state: settled

Charge every customer once a month for what they used.

## DP.system · Billing service
> up: DP.need · state: settled

Usage events in, invoices and payments out.

## DP.invoicing · Invoicing capability
> up: DP.system · state: settled · needs: build

Turns a month of usage into one invoice per customer.

## DP.invoice-engine · Invoice engine architecture
> up: DP.invoicing · state: settled

A batch job per billing day.

## DP.proration · Proration subsystem architecture
> up: DP.invoice-engine · state: settled

Plan changes mid-month split the period.

## DP.proration-api · Proration contract
> up: DP.proration · kind: contract · state: settled

`prorate(plan, from, to)` returns line items.

## DP.proration-rounding · Rounding rules contract
> up: DP.proration-api · kind: contract · state: settled

Round half to even, per line, in minor units.

## DP.rounding-impl · Rounding implementation
> up: DP.proration-rounding · kind: build · state: settled

Uses integer minor units throughout; no floating point.
