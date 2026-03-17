# Known Bugs

## BUG-001: Same-lot replacement matching (partial lot sales)

**Status:** Open
**Severity:** High — affects loss/gain calculations
**Found:** 2026-03-16

### Summary

When selling part of a lot at a loss, the calculator incorrectly matches the **remaining unsold shares from the same purchase** as replacement shares, triggering a wash sale. The prevailing interpretation of IRC § 1091 is that remaining shares from the same acquisition should NOT be considered replacement shares.

### Reproduction

```csv
date,action,source,shares,pricePerShare,transactionType,acquiredDate
2025-01-15,BUY,Shareworks,100,10.00,RSU_VEST,2025-01-15
2025-01-16,BUY,Shareworks,20,12.00,RSU_VEST,2025-01-16
2025-02-01,SELL,Other,50,8.00,OPEN_MARKET_SALE,2025-01-15
```

**Current (incorrect) behavior:**
- Sells 50 shares from frag_001 (Jan 15 lot) at a loss of $2/share ($100 total)
- Matches 50 replacement shares from frag_001 itself (the remaining 50 unsold shares)
- Disallows the entire $100 loss

**Expected behavior:**
- Sells 50 shares from frag_001 (Jan 15 lot) at a loss of $2/share ($100 total)
- Only matches replacement shares from **different** acquisitions within the 61-day window
- frag_002 (Jan 16 vest, 20 shares) is a valid replacement → disallowed loss = 20 × $2 = $40
- Remaining 30 shares have no replacement → allowed loss = 30 × $2 = $60

### Audit log showing the bug

```
LOT_SPLIT            Split frag_001: sold 50 of 100 shares
SALE_PROCESSED       Processed sale of 50 shares from frag_001
LOSS_DETECTED        Loss of -100 on sale (50 shares from frag_001)
REPLACEMENT_MATCHED  Matched 50 replacement shares from frag_001 ← BUG: same lot as sold shares
```

### Research

#### Statutory text (IRC § 1091(a))

The statute disallows a loss if "within a period beginning 30 days before the date of such sale and ending 30 days after such date, the taxpayer **has acquired** … substantially identical stock or securities." It does not explicitly define whether remaining shares from the same purchase count as an "acquisition" for this purpose.

#### Regulatory examples (Reg. § 1.1091-1)

Every example in the regulations uses **separate** acquisitions as replacement shares:
- Example 1: Dec 1 and Dec 15 purchases → Jan 3 sale of Dec 1 shares → replacement = Dec 15 lot
- Example 2: Sept 21 purchase → Dec 21/27 purchases → Jan 3 sale → replacement = Dec lots
- Example 3: Sept 15 purchase sold Feb 1 → replacement = Feb 15–18 purchases

No example shows remaining shares from the same lot serving as replacement.

#### IRS Publication 550

Pub 550's "More or Less Stock Bought Than Sold" section instructs: "Match the shares **bought** with an equal number of the shares sold. Match the shares bought in the same order that you bought them, beginning with the first shares bought." The examples consistently use different purchase events.

#### Prevailing interpretation

The wash sale rule targets "sell at a loss, then buy back to reestablish position." When selling part of a lot:
- No new purchase was made to replace the sold shares
- The remaining shares are not "replacement" — they're the remainder of the original position
- The taxpayer actually reduced their position (no abuse)

While the literal text of § 1091(a) could be read to include same-lot shares (they were "acquired" within 30 days), this interpretation:
- Is not supported by any regulatory example
- Contradicts the purpose of the rule
- Is not the standard industry practice

#### Conclusion

The better view is that same-lot remaining shares are **not** replacement shares. Only separate acquisitions should be matched.

### Proposed fix

In the replacement matching phase (`packages/core/src/phases/d-replacement-match.ts`), when searching for replacement lots, exclude lot fragments that originated from the **same source lot** as the sold shares. Specifically:

1. Track which original BUY row created each lot fragment
2. When matching replacements for a loss sale, skip fragments whose source BUY row matches the sold fragment's source BUY row
3. Only match fragments from different acquisition events

### Downstream impact

This bug cascades — incorrectly disallowing losses from partial lot sales means basis adjustments on remaining shares are wrong, which affects every subsequent sale from those lots. A fix will change multiple Form 8949 lines.

### Sources

| Source | Citation |
|--------|----------|
| Statute | 26 U.S.C. § 1091(a) |
| Regulations | 26 CFR § 1.1091-1(a)–(e), examples |
| IRS Publication | Publication 550, "Wash Sales" and "More or Less Stock Bought Than Sold" |
| Commentary | Fairmark, "Wash Sales and Replacement Stock" |
