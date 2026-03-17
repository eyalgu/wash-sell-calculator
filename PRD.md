# Wash Sale Cost Basis Calculator — Requirements / Light PRD

**Author:** Eyal Blum  
**Date:** 2026-03-14  
**Status:** Draft  
**Target Users:** Employees filing 2025 U.S. taxes with RSU/ESPP/IPO transactions  
**References:**
- [Design doc](./DESIGN_DOC.md)
- [`MS_2025_Tax_Filing_Guide.pdf`](https://drive.google.com/file/d/1Cio9YUmcNHexIPtJ8ZSyDWlxFp71_45C/view) — Morgan Stanley "Preparing for Your 2025 Tax Filing" (wash sale appendix pp. 59–62)
- [`MS_Cost_Basis_Wash_Sale_FAQ.pdf`](https://www.morganstanley.com/cs/pdf/6406112-2024-Cost-Basis-and-Wash-Sale-Enhancements-FAQ-FINAL.pdf) — Morgan Stanley "2024 Cost Basis and Wash Sale Enhancements FAQ"
- [IRS Publication 550 (Investment Income and Expenses)](https://www.irs.gov/publications/p550)
- [Treasury Regulation 26 CFR § 1.1091-1 (Losses from wash sales of stock or securities)](https://www.ecfr.gov/current/title-26/section-1.1091-1)
- [26 U.S.C. § 1091 (Loss from wash sales of stock or securities)](https://www.law.cornell.edu/uscode/text/26/1091)
- [26 U.S.C. § 1223(3) (Holding period carryover for wash sale replacement stock)](https://www.law.cornell.edu/uscode/text/26/1223)

---

## 1. Problem Statement

Employees face a significant tax-filing burden for the 2025 tax year due to the combination of:

1. **Open trading window sales at a loss + monthly RSU vesting = guaranteed wash sales** — When employees sell stock during an open trading window (e.g., IPO day, November window) and realize a loss, the loss is virtually always subject to wash sale rules because RSUs vest monthly on the 1st. Monthly vesting means there is *always* a replacement acquisition within the 30-day window. These discretionary sales are the **primary source** of meaningful wash sale losses.
2. **IPO sale through Computershare (cross-brokerage)** — The July 31, 2025 IPO involved selling shares through Computershare, a different broker than Shareworks (Morgan Stanley). IPO sales at a loss trigger wash sales when RSUs vest within 30 days — which they do, every month. This is the most common cross-brokerage wash sale scenario.
3. **Sell-to-cover losses (secondary complication)** — Starting **September 1, 2025**, RSU tax withholding switched from "net settlement" to "sell-to-cover," generating a taxable sale event at each monthly vest. These sell-to-cover sales typically produce only small gains or losses (intraday price fluctuation), but any loss triggers a wash sale against the next month's vest. While individually small, these create additional cascading wash sale chains that complicate the overall accounting.
4. **Cross-brokerage wash sales are not tracked** — Neither Computershare nor Shareworks tracks wash sales across accounts. IRS rules require the *taxpayer* to identify and report these.
5. **Shareworks 1099-B has intra-account adjustments but not cross-brokerage** — For RSU sell-to-cover and within-account sales, the Shareworks 1099-B **already includes adjusted cost basis with intra-account wash sales baked in**. However, the adjustments **do not account for cross-brokerage wash sales** (e.g., Computershare IPO losses), which the taxpayer must compute themselves. (Shareworks also does not issue a separate supplemental form; ESPP/ISO/NQSO transactions require separate manual basis adjustment.)
6. **Wash sale cascades** — Monthly vesting means a single loss sale can trigger a chain of wash sales: the disallowed loss rolls into the next lot's basis, which may itself be sold at a loss when the *next* month's vest occurs, cascading forward.

### Impact

- Employees report spending hours/days building spreadsheets that still don't tie out.
- Morgan Stanley support staff themselves cannot explain the wash sale math in their system.
- Even CPAs frequently get wash sale chains wrong.
- Risk of **double taxation** if cost basis is not properly adjusted.

---

## 2. Goal

Build a **calculator tool** (spreadsheet or JavaScript app) that allows employees to:

1. Input their unadjusted transactions from **multiple brokerages** (Shareworks, Computershare, and optionally others)
2. Automatically compute the **adjusted cost basis** and **adjusted acquisition dates** for all lots, accounting for wash sale rules
3. Produce output suitable for filing **IRS Form 8949** and **Schedule D**
4. See the **current adjusted cost basis and acquisition dates for shares they still hold** — so they know their true basis going forward for future tax years, future sales, and verifying against Shareworks' reported values

### Non-Goals (V1)

- Not providing tax advice (always disclaim)
- Not integrating directly with brokerage APIs or importing 1099-B files electronically
- Not handling options (ISOs/NQSOs) — RSU open-window sales and sell-to-cover are the primary use cases
- Not computing ESPP cost basis adjustments (including qualifying vs. disqualifying disposition mechanics). Users must determine and enter ESPP basis themselves before import/entry.
- Not handling spousal accounts or IRA-triggered wash sales (flag these for manual review)
- Not replacing a CPA — this is a computational aid

---

## 3. Background: Common Transaction Patterns

### 3.1 Monthly RSU Vesting (the constant replacement acquisition)

RSUs vest on the 1st of each month. Each vest is an **acquisition** of shares for wash sale purposes. This means there is *always* a purchase of substantially identical stock within a 30-day window of any sale — making **any sale at a loss a near-guaranteed wash sale**.

### 3.2 Open Trading Window Sales (primary wash sale trigger)

Employees can sell shares during open trading windows (e.g., IPO day, November trading window). If the sale price is below the lot's cost basis, the employee realizes a **capital loss**. Because RSUs vest monthly, there is always a replacement acquisition within 30 days, triggering a wash sale.

These discretionary sales are the **primary source of meaningful wash sale losses** because:
- The dollar amounts can be significant (selling large blocks of shares)
- The loss may be substantial if the stock has declined since the lot's vest date
- Monthly vesting guarantees a replacement acquisition in the wash sale window

**IPO sale via Computershare:** On July 31, 2025 (IPO day), shares were sold through Computershare, a different broker than Shareworks. Because of legal/processing fees, some employees realized a loss on this sale. Since RSUs vested on August 1 (and monthly thereafter), these losses are subject to wash sale rules — but Computershare's 1099-B shows `$0.00` in the wash sale disallowed box because they have no visibility into the Shareworks vesting schedule. This is the most common cross-brokerage scenario.

**November trading window and other open-market sales:** Shares sold at a loss during any trading window on Shareworks are also wash sale candidates. Shareworks *does* track these intra-account wash sales on the 1099-B, but employees may still want to verify the math.

### 3.3 Sell-to-Cover (secondary complication)

Starting **September 1, 2025**, RSU tax withholding switched from "net settlement" to "sell-to-cover." Each monthly vest now generates a taxable sale event where some shares are immediately sold to pay withholding taxes.

| Period | Method | 1099-B Impact |
|--------|--------|---------------|
| Jul 31 – Aug 1, 2025 | Net settlement ("Withhold shares to cover taxes, receive remaining shares") | No sell-to-cover sale on 1099-B |
| Sep 1, 2025 onward | Sell-to-cover ("Sell enough shares to cover taxes and fees, receive balance as shares") | Sale appears on Shareworks 1099-B |

Net-settlement withheld shares are not sold by the employee and should not be treated as sale dispositions for wash-sale loss calculations. They are withholding mechanics at release, while retained released shares are still acquisitions on that vest date.

**Why this is secondary:** Sell-to-cover sales typically produce only small gains or losses (intraday price fluctuation between vest and sale execution). Per MS's interpretation, the same-day vest does not count as a replacement purchase for its own sell-to-cover loss — so a sell-to-cover loss only triggers a wash sale if the **next** vest is within 30 days. With monthly vesting on the 1st, this depends on calendar month length (28–31 day gaps), so some months will trigger and others won't. While individually small, these add complexity:
- When triggered, they create additional cascading wash sale chains layered on top of the larger open-window losses
- The sell-to-cover basis adjustments from Shareworks can be hard to verify
- Users have reported being "$1,000 off" specifically due to sell-to-cover wash sale accounting

### 3.4 Shareworks Within-Account Wash Sales

Shareworks *does* track wash sales within the Shareworks account. Their 1099-B already shows adjusted basis and a wash sale indicator ("H") for intra-account wash sales. However:
- They do **not** track cross-account wash sales (Computershare, spousal accounts) — this is the primary gap this tool aims to fill
- The math behind their adjustments is opaque — employees cannot verify how original basis → adjusted basis was computed
- **Unverified observation:** Some employees have reported that the 1099-B uses the original unadjusted acquisition date for wash-sale-adjusted lots, while the Shareworks website shows adjusted dates. This has not been confirmed with Morgan Stanley and may not be accurate in all cases.

---

## 4. Functional Requirements

### FR-1: Transaction Input

The tool must accept transactions in the following formats:

**FR-1.1: Single-ticker analysis per run**
Each calculator run analyzes one ticker at a time. Configure the ticker once at the run/file level (default `FIG`) rather than per transaction row.

**FR-1.2: Manual entry (primary)**
Each row represents one lot per transaction. If multiple lots are sold on the same day, enter each lot as a **separate row** (this matches how the 1099-B reports them — one row per lot per sale).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Date | date | Yes | Trade/settlement date |
| Action | enum | Yes | `BUY` (vest/release/purchase), `SELL` (sale/sell-to-cover) |
| Source | enum | Yes | `Shareworks`, `Computershare`, `Other` |
| Shares | number | Yes | Positive number |
| Price per share | number | Yes | For BUY: FMV at vest. For SELL: **net sale price per share after fees/commissions** |
| Transaction type | enum | No | `RSU_VEST`, `SELL_TO_COVER`, `IPO_SALE`, `OPEN_MARKET_SALE`, `ESPP_PURCHASE`, `ESPP_SALE` |
| Acquired date | date | No | For sells: the **original (unadjusted)** acquisition date of the lot being sold — i.e., the actual vest/purchase date. Used to match the sell back to a BUY entry. Note: the 1099-B "Date Acquired" field may show either the original or adjusted date depending on the broker (see section 3.4). If in doubt, cross-reference against vest dates. |

**FR-1.3: Multi-brokerage support**
Tag each transaction with its source brokerage. The tool must merge transactions from all sources into a single chronological timeline for wash sale analysis.

**FR-1.4: CSV bulk import**
Support CSV bulk import for transaction rows using the same schema as manual entry (excluding ticker). The import should allow all rows for a single-ticker run to be loaded at once, with ticker supplied once at import/run configuration.

**FR-1.5: ESPP basis input assumption**
For any `ESPP_PURCHASE`/`ESPP_SALE` rows, the tool uses the basis values provided by the user as-is. The tool does not calculate ESPP basis adjustments tied to qualifying vs. disqualifying disposition rules; those adjustments must be completed before data entry/import.

### FR-2: Wash Sale Detection

**FR-2.1: 61-day window**
For each sale at a loss, identify replacement purchases within [sale_date − 30 days, sale_date + 30 days]. Use the replacement lot's **actual purchase date** (not any adjusted acquisition date from a prior wash sale) for this window check. The adjusted acquisition date from IRC § 1223(3) applies only to holding period (short-term vs. long-term), not to determining when shares were "acquired" under IRC § 1091(a).

**FR-2.2: Cross-brokerage detection**
Detect wash sales across accounts (e.g., Computershare IPO loss → Shareworks RSU vest replacement). This is the primary gap in existing brokerage reporting.

**FR-2.3: Partial wash sales**
Since we track at the per-share level, partial wash sales are handled naturally: each replacement share absorbs the disallowed loss from one sold share. If there are fewer replacement shares than sold shares, the unmatched sold shares' losses are simply **allowed** (not disallowed). No special formula is needed — this falls out of per-share matching.

MS PDF example confirms: 79 shares sold at a loss, 82 replacement shares bought → 79 replacement shares get adjusted basis, 3 remain unadjusted.

**FR-2.4: Wash sale cascades (chains)**
When a replacement lot is subsequently sold at a loss (using its *adjusted* basis), detect the new wash sale and propagate the adjustment to the next replacement lot. Repeat until the chain terminates. This is not a special rule — it's a natural byproduct of how capital gains/losses work: the replacement lot has an adjusted (higher) basis, and if it's later sold below that adjusted basis, it's a loss sale subject to the same wash sale rules as any other loss sale.

**FR-2.5: Sell-to-cover and wash sales**
Per the MS FAQ: "A sell-to-cover transaction in isolation will not trigger a wash sale. However, because the shares sold in the sell-to-cover could be sold at a loss, a repurchase of shares (including a release of Restricted Stock or RSUs) within 30 days could trigger a wash sale."

Taking MS's interpretation: the same-day vest that triggers the sell-to-cover does **not** itself count as the replacement purchase for that sell-to-cover's loss. A sell-to-cover loss only becomes a wash sale if there is **another** acquisition within 30 days. With monthly vesting (vests ~30 days apart), this means:
- If vests are exactly 30 days apart or less → the next month's vest is within the window → sell-to-cover losses trigger wash sales
- If vests are more than 30 days apart → sell-to-cover losses are allowed

For a typical monthly vesting schedule (1st of each month), vests are 28–31 days apart. **Whether a sell-to-cover loss triggers a wash sale depends on the specific calendar months involved** — months with 30 or fewer days between vests will trigger, while 31-day gaps (e.g., Oct 1 → Nov 1) will not.

Note: Even when a sell-to-cover loss doesn't trigger a wash sale on its own, the same-day vest **is** still a replacement acquisition for any *prior* loss sale (e.g., an open trading window sale within the preceding 30 days).

**FR-2.6: Multiple replacement lot matching**
When multiple lots qualify as replacements, match in **FIFO order** (earliest purchase first). Each replacement share absorbs disallowed loss from **at most one** loss sale. Loss sales are also processed in chronological order (earliest first).
If multiple loss dispositions occur on the same day and order is indeterminable, process those losses by original acquisition date (earliest first) per Reg. § 1.1091-1(b); do not average losses across lots.

Sources:
- **FIFO matching**: Treasury Reg. § 1.1091-1(d) — match acquired shares "in accordance with the order of acquisition (beginning with the earliest acquisition)." IRS Pub 550 confirms: "Match the shares bought in the same order that you bought them, beginning with the first shares bought."
- **Single-matching**: Treasury Reg. § 1.1091-1(e) — "The acquisition of any share of stock or any security which results in the nondeductibility of a loss... shall be disregarded in determining the deductibility of any other loss." Once a replacement share is matched to a loss sale, it cannot be replacement for another.
- **Loss sale ordering**: Reg. § 1.1091-1(b) — multiple losses are applied "in the order in which the stock or securities were disposed of (beginning with the earliest disposition)."

**FR-2.7: ESPP participation in wash-sale matching**
Even though ESPP basis computation is out of scope (see Non-Goals and FR-1.5), ESPP transactions are still part of wash-sale detection once entered:
- `ESPP_PURCHASE` can serve as replacement acquisition if it is substantially identical stock within the 61-day window.
- `ESPP_SALE` can itself be a wash-sale-triggering loss sale when the user-entered adjusted basis exceeds sale proceeds.

**FR-2.8: Same-acquisition replacement exclusion**
When selling part of a lot at a loss, the remaining unsold shares from the same acquisition event must NOT be treated as replacement shares for that loss sale. Only shares from separate acquisition events qualify as replacements. This reflects the prevailing interpretation of IRC section 1091(a) and is consistent with every regulatory example in Reg. section 1.1091-1. This generalizes FR-2.5 (sell-to-cover self-trigger exclusion) — the same-day vest exclusion for sell-to-cover is a special case of same-acquisition exclusion.

### FR-3: Cost Basis Adjustment

**FR-3.1: Adjusted cost basis**
Each replacement share's basis is increased by the disallowed loss per share:
```
disallowed_loss_per_share = acquisition_cost_per_share − sell_price_per_share
adjusted_basis_per_share = replacement_purchase_price + disallowed_loss_per_share
```
The `disallowed_loss_per_share` is the same for every share in the sold lot — when only a portion of the lot's shares are matched to replacements (partial wash sale), each matched replacement share still gets the full `disallowed_loss_per_share` added to its basis. The unmatched shares' losses are simply allowed.

MS PDF example: sold at $5/share, original basis $10/share → `disallowed_loss_per_share` = $5. Replacement purchased at $6/share → adjusted basis = $6 + $5 = $11/share.

**FR-3.2: Adjusted acquisition date**
The replacement lot's holding period includes the sold lot's holding period:
```
days_held = sale_date − sold_lot_acquisition_date
adjusted_acquisition_date = replacement_purchase_date − days_held
```
This is critical for determining short-term vs. long-term capital gains treatment.

**FR-3.3: Sub-replacement-lot tracking**
When a replacement lot is only partially matched (e.g., 82 shares purchased but only 79 matched as replacement), the lot splits into sub-lots with distinct basis and acquisition dates. Per the MS PDF example: 79 shares get adjusted basis ($11/share, adjusted acq Apr 5) while 3 shares retain original basis ($6/share, original acq Oct 1).

This also applies if shares from the same lot serve as replacements for different loss sales (processed in chronological order per Reg. § 1.1091-1(b)) — each portion would have a different adjusted basis and acquisition date.

**FR-3.4: Partial lot sales**
When only some shares from a lot are sold, the remaining shares stay in the lot with their current basis and acquisition date. The sold portion is evaluated for gain/loss and potential wash sale independently. The lot's remaining share count is reduced accordingly.

**FR-3.5: Loss-disposition ordering and same-day fallback (no averaging)**
Wash-sale allocation must not use average basis/loss across sold lots. The tool must allocate disallowed loss based on actual sold-lot outcomes and regulatory matching order:

1. Apply loss dispositions in chronological order (earliest disposition first).
2. If multiple loss dispositions occur on the same day and order cannot be determined, treat them as disposed in order of original acquisition (earliest acquisition first).
3. Match replacement shares in acquisition order (earliest replacement acquisition first).
4. Each replacement share can absorb disallowed loss from at most one loss disposition.
5. Users may choose sell lots only to the extent valid lot identification was made at trade time (or broker default applies). The calculator must not permit arbitrary re-selection after the fact.

Source: Treasury Reg. § 1.1091-1(b), (d), (e); IRS Pub 550 ("More or less stock bought than sold").

Plain-language clarification: When multiple loss sales exist, earlier loss dispositions get first claim on available replacement shares within their wash-sale windows; later loss dispositions can only use replacement shares not already matched.

**FR-3.6: Ambiguous internal sublot depletion (Shareworks-compatibility mode)**
When a sale disposition (including sell-to-cover) draws from a single broker-reported lot that internally contains multiple wash-adjusted sublots (different adjusted basis and/or adjusted acquisition dates), and broker output does not explicitly identify which internal sublot shares were sold, the tool must apply a deterministic depletion rule:

1. Deplete by **HIFO** within that broker lot (highest adjusted basis per share first).
2. If adjusted basis per share is tied, choose the sublot with the **earliest original acquisition date**.
3. If still tied, choose the sublot with the **earliest adjusted acquisition date**.
4. If still tied, use a stable deterministic internal ordering key (e.g., creation order / lot fragment ID).

This rule is an accounting allocation policy for ambiguous broker data and must be applied consistently across all transactions in the run (no transaction-by-transaction optimization).

Note: Shareworks appears to use an opaque internal allocation method for dispositions against wash-adjusted sublots. When reconciling multi-broker data, this exact allocation is not fully observable from available reports and cannot be replicated with certainty. This rule is therefore a deterministic approximation policy for unresolved sublot ambiguity.

### FR-4: Verification & Reconciliation

**FR-4.1: Reconciliation against Shareworks**
Allow users to input Shareworks' reported adjusted basis and compare with the tool's computed values. Flag discrepancies.
For rows affected by FR-3.6 ambiguous internal sublot depletion, classify differences as:
- `Expected (allocation-ambiguity)`: discrepancy attributable to opaque broker allocation behavior
- `Unexpected`: discrepancy not explained by known ambiguity and requiring review

**FR-4.2: Balance check**
Compute and verify:
```
total_disallowed_losses = losses_rolled_into_sold_lots + losses_rolled_into_remaining_holdings
```

**FR-4.3: Lot-level audit trail**
For each lot, show the complete chain of adjustments:
- Original basis and acquisition date
- Each wash sale that modified it (which sale triggered it, disallowed amount, date)
- Final adjusted basis and acquisition date

**FR-4.4: Reconciliation classification + assumption transparency**
For each discrepancy, the tool must output:
1. whether FR-3.6 policy was applied,
2. the sublot depletion order actually used,
3. the computed vs broker basis delta,
4. a classification (`Expected (allocation-ambiguity)` or `Unexpected`).

This allows multi-broker recomputation while preserving traceability where exact Shareworks replication is not possible.

### FR-5: Output

**FR-5.1: Form 8949 data**
For each sale, produce a row with:

| Column | Description |
|--------|-------------|
| (a) Description | e.g., "200 sh FIG" |
| (b) Date acquired | Adjusted acquisition date |
| (c) Date sold | Actual sale date |
| (d) Proceeds | Sale price × shares |
| (e) Cost basis | Adjusted cost basis |
| (f) Adjustment code | `W` for wash sale |
| (g) Adjustment amount | Disallowed loss amount |
| (h) Gain or loss | (d) − (e) + (g) |

**FR-5.2: Summary report**
- Total realized gains/losses (short-term and long-term)
- Total disallowed wash sale losses
- Total disallowed losses deferred into remaining holdings
- Remaining lot positions with adjusted basis

**FR-5.3: Export formats**
- CSV (for import into tax software)
- Printable table (for paper filing or CPA review)

### FR-6: Shareworks Intra-Account Wash Sale Handling

**FR-6.1: Full recomputation required**
When cross-brokerage wash sales exist (e.g., a Computershare IPO loss), they may sit **before** Shareworks' intra-account wash sale chain in the timeline. Because the cross-brokerage wash sale changes the basis at the head of the chain, all downstream Shareworks adjustments become invalid — the entire chain must be recomputed from scratch.

Therefore, the tool must accept all transactions with **original (unadjusted) basis** from all brokerages and compute all wash sales from the ground up. "Layering" cross-account adjustments on top of Shareworks' pre-adjusted numbers is not reliable.

**FR-6.2: Reconciliation against Shareworks**
After full recomputation, compare the tool's computed intra-account adjustments against Shareworks' reported adjustments. This serves as a sanity check — for employees with no cross-brokerage wash sales, the numbers should match. Discrepancies may indicate either a cross-brokerage wash sale impact or an error in Shareworks' calculations.

---

## 5. User Workflow

### Workflow A: "Full computation with reconciliation"

1. Input all transactions with **original (unadjusted) basis** from all brokerages (Shareworks, Computershare, etc.)
2. Tool computes all wash sales from scratch across all accounts
3. Tool produces reconciliation report comparing computed adjustments vs. Shareworks-reported adjusted basis
4. For employees with no cross-brokerage wash sales, numbers should match — discrepancies are flagged
5. User gets complete Form 8949 data and updated lot positions

### Workflow B: "I just want the numbers for my CPA"

1. Input all transactions (all brokerages) with original basis
2. Tool produces complete Form 8949 data and remaining lot positions
3. Export as CSV → hand to CPA

---

## 6. Acceptance Criteria

### AC-1: Simple Wash Sale
- BUY 100 shares @ $10 on Jan 15
- SELL 100 shares @ $8 on Feb 10 (loss of $200)
- BUY 100 shares @ $9 on Feb 20
- **Expected:** $200 loss disallowed, new basis = $11/share, adjusted acq = Jan 25

### AC-2: Partial Wash Sale
- SELL 100 shares at a loss of $5/share
- BUY 60 replacement shares within window
- **Expected:** 60 replacement shares get $5/share added to basis ($300 disallowed). 40 shares' worth of loss ($200) is allowed.

### AC-3: Morgan Stanley Wash Sale Example (from PDF)
- BUY 79 shares @ $10 on Feb 26
- SELL 79 shares @ $5 on Aug 24 (loss of $395)
- BUY 82 shares @ $6 on Sep 1
- **Expected:** 79 of 82 shares adjusted to $11/share basis, adjusted acq Mar 6. Remaining 3 shares at $6/share, acq Sep 1.

### AC-4: Sell-to-Cover Wash Sale Trigger at 30-Day Gap
- VEST 100 shares @ $100 on Sep 1
- SELL_TO_COVER 40 shares @ $99 on Sep 1 (loss of $1/share = $40 total)
- VEST 100 shares @ $95 on Oct 1 (30 days after Sep 1)
- **Expected:** Per FR-2.5, the Sep 1 same-day vest does not replace its own sell-to-cover loss. The Oct 1 vest is within 30 days and is replacement acquisition, so Sep 1 loss is a wash sale for 40 shares. Disallowed loss = $40, rolled into 40 shares of the Oct 1 lot (+$1/share basis). Thus 40 Oct 1 shares have adjusted basis $96/share; remaining 60 Oct 1 shares remain at $95/share.

### AC-5: Sell-to-Cover Non-Trigger at 31-Day Gap
- VEST 100 shares @ $95 on Oct 1
- SELL_TO_COVER 40 shares @ $94 on Oct 1 (loss of $1/share = $40 total)
- VEST 100 shares @ $90 on Nov 1 (31 days after Oct 1)
- **Expected:** Under FR-2.5, because the next vest occurs outside the 30-day window, the Oct 1 sell-to-cover loss is **not** a wash sale. Disallowed loss = $0, allowed loss = $40, and Nov 1 lot basis remains $90/share (no wash adjustment from Oct 1 sell-to-cover).

### AC-6: Cross-Brokerage (IPO → Shareworks)
- SELL 500 shares @ $30 via Computershare on Jul 31 (net sale price per share after fees). Sold lot basis = $33/share, acquired Jul 31.
- VEST 200 shares @ $115 via Shareworks on Aug 1
- **Expected:** Realized loss on Jul 31 sale = $3/share × 500 = $1,500. Since 200 replacement shares are acquired on Aug 1 within the wash window, disallowed loss = $3/share × 200 = $600. Allowed loss = $900. The 200 Aug 1 replacement shares get +$3/share basis adjustment, so adjusted basis = $118/share for those 200 shares.

### AC-7: Multi-Lot November Loss Sale + December Replacement
- VEST 100 shares @ $100 on Sep 1
- SELL_TO_COVER 40 shares on Sep 1
- VEST 100 shares @ $90 on Oct 1
- SELL_TO_COVER 40 shares on Oct 1
- VEST 100 shares @ $80 on Nov 1
- SELL_TO_COVER 40 shares on Nov 1
- SELL remaining shares from the three lots (60 + 60 + 60 = 180 shares) @ $70 on Nov 15
- VEST 100 shares @ $60 on Dec 1
- **Expected:** Nov 15 creates three loss sub-sales (60 shares from each vest lot): $30/share loss (Sep lot), $20/share loss (Oct lot), $10/share loss (Nov lot). Under Reg. § 1.1091-1(b),(d), and Pub 550 "More or less stock bought than sold," the 100 Dec 1 replacement shares must be matched in acquisition order to the Nov 15 loss shares (no averaging and no arbitrary lot picking): first 60 replacement shares absorb the Sep lot loss (+$30/share basis), next 40 absorb the Oct lot loss (+$20/share basis). Result: disallowed loss = $2,600; allowed loss on Nov 15 = $1,000 (20 Oct shares + 60 Nov shares).

### AC-8: HIFO Sublot Depletion for Ambiguous Sell-to-Cover
- VEST 100 shares @ $90 on Oct 1
- SELL_TO_COVER 40 shares on Oct 1
- VEST 100 shares @ $80 on Nov 1
- SELL_TO_COVER 40 shares on Nov 1
- SELL remaining shares from the two lots (60 + 60 = 120 shares) @ $70 on Nov 15
- VEST 100 shares @ $60 on Dec 1
- SELL_TO_COVER 40 shares on Dec 1
- **Expected:** Nov 15 creates two loss sub-sales: $20/share on 60 Oct shares and $10/share on 60 Nov shares. The 100 Dec 1 replacement shares match to these losses in order, creating two internal sublots: 60 shares with adjusted basis $80/share and 40 shares with adjusted basis $70/share. On Dec 1 sell-to-cover of 40 shares, apply FR-3.6 HIFO depletion within the single broker lot: consume 40 shares from the $80/share sublot first. Remaining Dec 1 holdings after sell-to-cover: 20 shares @ $80/share and 40 shares @ $70/share.

### AC-9: Single-Matching Guard (No Double-Use of Replacement Shares)
- BUY 100 shares @ $50 on Jan 10 (replacement lot candidate)
- SELL 60 shares from Lot A @ $40 on Jan 20 (loss)
- SELL 60 shares from Lot B @ $35 on Jan 25 (loss)
- **Expected:** Total disallowed loss applies to 100 replacement shares only (60 from first loss sale + 40 from second loss sale). Remaining 20 shares from the second loss sale are allowed loss.
- **Expected detail:** Replacement matching is applied in loss-disposition order. The first loss sale consumes 60 replacement shares from the Jan 10 lot. For the second loss sale, only the remaining 40 replacement shares from Jan 10 are eligible; the already-matched 60 shares are ineligible for reuse.

### AC-10: Partial Replacement-Lot Split from Single Loss Sale
- SELL 80 shares @ $20 on Mar 15 from a lot with basis $30 per share (loss of $10 per share)
- BUY 100 shares @ $22 on Mar 20 (replacement lot)
- **Expected:** Disallowed loss = $800 (80 shares × $10 per share); allowed loss = $0.
- **Expected detail:** 80 of the 100 replacement shares are matched and receive wash adjustment. Adjusted basis for matched shares = $32 per share (`$22 + $10`). The replacement lot is split into sub-lots: 80 adjusted shares (with adjusted acquisition date carryover from the sold lot) and 20 unadjusted shares at $22 per share with original Mar 20 acquisition date.

### AC-11: Sell-to-Cover in Isolation Does Not Self-Trigger Wash Sale
- VEST 100 shares @ $100 on Sep 1
- SELL_TO_COVER 40 shares @ $99 on Sep 1 (loss of $1 per share = $40 total)
- No other acquisitions of substantially identical stock occur within [Aug 2, Oct 1] except the Sep 1 vest tied to this sell-to-cover event
- **Expected:** Disallowed loss = $0; allowed loss = $40.
- **Expected detail:** Per FR-2.5, the same-day vest that generated the sell-to-cover does not count as replacement for that sell-to-cover loss. Without another acquisition in the 30-day window, no wash sale is triggered.

### AC-12: Partial Lot Sale — Same-Lot Remainder Excluded from Replacement

- BUY 100 shares at $10 on Jan 15
- BUY 20 shares at $12 on Jan 16
- SELL 50 shares at $8 on Feb 1 (from Jan 15 lot)
- **Expected:** Loss = $2/share x 50 = $100. The 50 remaining Jan 15 shares are NOT replacement (same acquisition). The 20 Jan 16 shares ARE replacement (different acquisition, within window). Disallowed = $40, allowed = $60. The 20 replacement shares get +$2 basis (new basis = $14/share).

---

## 7. Disclaimer

> **This tool is for educational and computational purposes only. It does not constitute tax, legal, or financial advice. Wash sale rules (IRC §1091) have nuances including but not limited to: IRA acquisitions, options/contracts on substantially identical securities, spousal transactions, and state-specific rules (e.g., Pennsylvania). Always consult a qualified tax professional for your specific situation.**

---

## Appendix A: IRS Wash Sale Rules Summary

Per IRS Publication 550:

> A wash sale occurs when you sell or trade stock or securities at a loss and within 30 days before or after the sale you:
> 1. Buy substantially identical stock or securities,
> 2. Acquire substantially identical stock or securities in a fully taxable trade,
> 3. Acquire a contract or option to buy substantially identical stock or securities, or
> 4. Acquire substantially identical stock for your individual retirement arrangement (IRA) or Roth IRA.

The loss is **disallowed** (deferred) and added to the cost basis of the replacement shares. The holding period of the sold shares carries over to the replacement shares.

Additional matching/ordering rules (Treasury Reg. § 1.1091-1):
- Losses are applied in the order dispositions occurred (earliest first) (§ 1.1091-1(b)).
- If multiple loss dispositions occur on the same day and their order cannot be determined, treat them as disposed in order of original acquisition (earliest acquisition first) (§ 1.1091-1(b)).
- Replacement shares are matched in order of acquisition (earliest replacement first) (§ 1.1091-1(d)).
- A replacement share already used to disallow one loss is disregarded for other losses (§ 1.1091-1(e)).
- Therefore, wash-sale allocation is lot/order based, not average-allocation based.

## Appendix B: Morgan Stanley Wash Sale Reporting Limitations

Per the Morgan Stanley "2024 Cost Basis and Wash Sale Enhancements FAQ":

- Morgan Stanley only tracks wash sales for **identical CUSIP** within the **same account**
- They do **not** identify wash sales for:
  - Securities purchased/sold at other broker-dealers
  - Spousal accounts
  - 401(k) accounts
  - IRAs
  - "Substantially identical" securities with different CUSIPs
- A release of Restricted Stock or RSUs **is considered an acquisition** for wash sale purposes
- Sell-to-cover transactions in isolation do not trigger wash sales, but the resulting loss + a subsequent acquisition within 30 days can

## Appendix C: Example 2025 Transaction Timeline

| Date | Event | Brokerage | Notes |
|------|-------|-----------|-------|
| Jul 31, 2025 | IPO — RSU vest + IPO sale | Brokerage A | Net settlement method. **IPO sale may generate loss from fees — primary cross-brokerage wash sale trigger.** |
| Aug 1, 2025 | RSU vest | Brokerage B | Net settlement method. No sell-to-cover 1099-B. Acts as replacement acquisition for IPO loss. |
| Sep 1, 2025 | RSU vest + sell-to-cover | Brokerage B | **First sell-to-cover on 1099-B.** |
| Oct 1, 2025 | RSU vest + sell-to-cover | Brokerage B | |
| Nov 2025 | **Open trading window sales** | Brokerage B | **Discretionary sales — primary source of meaningful within-account wash sale losses.** |
| Nov 1, 2025 | RSU vest + sell-to-cover | Brokerage B | Acts as replacement for any Oct losses |
| Dec 1, 2025 | RSU vest + sell-to-cover | Brokerage B | Acts as replacement for any Nov losses |

**Key insight:** Each monthly vest is an "acquisition" that serves as replacement shares for any loss sale within the prior 30 days. With monthly vesting, any sale at a loss — whether a large open-window sale or a small sell-to-cover — is virtually guaranteed to trigger a wash sale. Open trading window sales produce the largest losses; sell-to-cover adds cascading complexity on top.
