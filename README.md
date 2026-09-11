# ALU Regex Data Extraction & Secure Validation

A small Node.js program that reads a file of raw strings, works out what each
string is *supposed* to be, and decides whether it is valid — **using regular
expressions only**. Every verdict, including the reason a string was rejected,
comes from a regex match rather than hand-written logic.

---

## Project structure

```
alu-regex-data-extraction/
├── input/
│   └── raw-text.txt          raw strings to check (AI-generated sample data)
├── src/
│   └── main.js               all regex patterns and the checking pipeline
├── output/
│   └── sample-output.json    the result of every check
└── README.md
```

## How to run it

Requires Node.js 16 or newer. No dependencies, no install step.

```bash
node src/main.js
```

Optional paths:

```bash
node src/main.js --input input/raw-text.txt --output output/sample-output.json
```

The program prints a summary to the console and writes the full report to
`output/sample-output.json`.

---

## How it works

The whole program is three steps:

1. **Read** `input/raw-text.txt`, skipping blank lines and `//` comment lines.
2. **Check** each string against the regular expressions below, in order.
3. **Record** the string as a key in the output JSON, with the type it matched.

Every pattern is anchored with `^` and `$`, so a string has to match a pattern
*completely* to be accepted. If it matches none of them it is simply recorded as
`invalid` — the program does not try to explain why, it just moves on.

```js
function identify(value) {
  if (ALU_ALUMNI_EMAIL_REGEX.test(value)) return 'alu_alumni_email';
  if (ALU_SI_EMAIL_REGEX.test(value)) return 'alu_si_email';
  if (ALU_OFFICIAL_EMAIL_REGEX.test(value)) return 'alu_official_email';
  if (EMAIL_REGEX.test(value)) return 'email';
  if (URL_REGEX.test(value)) return 'url';
  if (CREDIT_CARD_REGEX.test(value)) return 'credit_card';
  if (PHONE_REGEX.test(value)) return 'phone';
  if (HTML_TAG_REGEX.test(value)) return 'html_tag';
  return null;
}
```

Because the patterns are anchored, the tests are independent and the order is
mostly cosmetic. The one place it matters: the **ALU patterns run before**
`EMAIL_REGEX`, so an ALU address is reported with its specific domain rather than
as a generic email.

---

## The regular expressions

### 1. Email addresses

```js
/^[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/
```

| Part | Meaning |
|---|---|
| `[A-Za-z0-9_%+-]+` | the first chunk of the local part — at least one character, and **no dot** |
| `(?:\.[A-Za-z0-9_%+-]+)*` | more dot-separated chunks, each one non-empty |
| `@` | exactly one separator |
| `(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+` | one or more domain labels, each starting and ending with a letter or digit |
| `[A-Za-z]{2,24}$` | a top-level domain of letters only |

Writing the local part as *chunk, then dot-chunk, then dot-chunk* is what makes
the pattern reject `eve..morgan@…` (a chunk would have to be empty),
`.leading.dot@…` (it cannot start with a dot) and `trailing.dot.@…` (it cannot
end with one) — all without a single `if` statement.

### 2. URLs

```js
/^https?:\/\/[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+(?::\d{2,5})?(?:\/[^\s"'<>]{0,300})?$/
```

| Part | Meaning |
|---|---|
| `https?:\/\/` | `http://` or `https://` only — `ftp://` and `htp://` are rejected |
| domain labels | same label rule as the email domain, so hyphens can't start or end a label |
| `(?::\d{2,5})?` | optional port, e.g. `:8080` |
| `(?:\/[^\s"'<>]{0,300})?` | optional path, query string and fragment, stopping at whitespace or quotes |

### 3. Phone numbers

```js
/^(?!(?:\D*\d){13})(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})(?:[\s.-]?\d{2,4}){2,3}$/
```

| Part | Meaning |
|---|---|
| `(?!(?:\D*\d){13})` | a guard: reject anything with 13 or more digits, since no phone number is that long |
| `(?:\+\d{1,3}[\s.-]?)?` | optional country code, e.g. `+250`, `+44`, `+1` |
| `(?:\(\d{2,4}\)|\d{2,4})` | first group, with or without brackets — `(415)` or `415` |
| `(?:[\s.-]?\d{2,4}){2,3}` | two or three more groups, separated by a space, dot, hyphen or nothing |

One pattern covers `+250 788 123 456`, `(415) 555-0132`, `415.555.0199`,
`250-788-990-112` and `+250788990112`, while `555-01` and `+12345` fail because
they cannot produce enough groups.

### 4. Credit card numbers

```js
/^4\d{3}([ -]?)\d{4}\1\d{4}\1\d{4}$/
```

| Part | Meaning |
|---|---|
| `4\d{3}` | must start with **4**, then any 3 digits |
| `([ -]?)` | the separator — a space, a hyphen, or nothing — **captured** in brackets so it can be reused |
| `\d{4}\1` | four digits, then `\1` = *the same separator again* |
| ×3 | that repeats, giving 16 digits in four groups |

`\1` is a **backreference**: it does not mean "a separator", it means "whatever
matched the brackets the first time". So the separator has to be consistent all
the way through — `4111-1111 1111-1111` is rejected for mixing a hyphen with a
space. Using a literal `[ -]` rather than `[\s-]` also keeps out tabs and
non-breaking spaces, which `\s` would otherwise allow.

The leading digits of a card are not random: they identify the issuer. Visa
always starts with 4, Mastercard with 51–55, Discover with 6011 or 65. Requiring
a `4` is therefore a real check, not a guess.

| Input | Result | Why |
|---|---|---|
| `4111 1111 1111 1111` | `credit_card` | 16 digits, starts with 4 |
| `4532-0151-1283-0366` | `credit_card` | hyphens are accepted |
| `4012888888881881` | `credit_card` | no separators is fine too |
| `5555 5555 5555 4444` | `invalid` | Mastercard — right shape, wrong leading digit |
| `6011 0009 9013 9424` | `invalid` | Discover |
| `1234 5678 9012 3456` | `invalid` | no issuer starts with 1234 |
| `4111 1111 1111 111` | `invalid` | only 15 digits |
| `4111-1111 1111-1111` | `invalid` | separators are not consistent |
| `3782 822463 10005` | `invalid` | American Express — 15 digits, grouped 4-6-5 |

> **What this pattern does not cover.** Card numbers are not a fixed length.
> Under ISO/IEC 7812 a card number runs from 8 to 19 digits (10 to 19 after the
> 2016 revision): Visa itself also issues 13- and 19-digit numbers, and American
> Express uses 15 digits in three groups rather than four. This pattern targets
> the common 16-digit, four-group layout only.
>
> **Known limitation.** A regular expression cannot do arithmetic, so it cannot
> run the Luhn checksum that catches a single mistyped digit in a number that is
> otherwise correctly formed. A production system runs the regex first and the
> Luhn algorithm second. This program is regex-only by design, so that second
> step is out of scope.

### 5. HTML tags

```js
/^<\/?[A-Za-z][A-Za-z0-9-]{0,20}(?:\s[^<>]{0,200})?\/?>$/
```

| Part | Meaning |
|---|---|
| `<\/?` | an opening tag, or a closing tag with `/` |
| `[A-Za-z][A-Za-z0-9-]{0,20}` | tag name — must start with a letter |
| `(?:\s[^<>]{0,200})?` | optional attributes, which may not contain `<` or `>` |
| `\/?>` | allows self-closing tags such as `<br />` |

Rejects `< not a tag >` (no tag name) and `<123invalid>` (starts with a digit).

---

## ALU email validation

Three separate anchored patterns, tested in this order:

```js
/^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*@alumni\.alueducation\.com$/i
/^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*@si\.alueducation\.com$/i
/^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*@alueducation\.com$/i
```

Two details make these safe:

**The `^` and `$` anchors.** A pattern that merely *searched* for
`@alueducation.com` would accept both of these, which are in the sample input
as deliberate phishing attempts:

| Address | Why it is dangerous | Result |
|---|---|---|
| `admin@alueducation.com.attacker.net` | the real domain used as a **prefix** of an attacker domain | rejected |
| `frank@fake-alueducation.com` | the real domain used as a **suffix** | rejected |

Anchoring forces the address to be the entire string, so neither can slip
through — neither is reported as an ALU address.

Note that both are still well-formed email addresses, so `EMAIL_REGEX` accepts
them and they are reported as type `email`. The ALU patterns guarantee that no
impostor is ever *labelled* as an ALU address; they do not claim the address is
fake in general.

**Subdomain order.** `alumni.alueducation.com` and `si.alueducation.com` are
tested *before* `alueducation.com`, otherwise a more general pattern could claim
an address that belongs to a specific subdomain.

---

## Output

`output/sample-output.json` is a single object. **Each key is a string that was
checked**, and its value says what that string is:

```json
{
  "n.mugisha@alueducation.com": { "type": "alu_official_email", "valid": true },
  "brian.k@alumni.alueducation.com": { "type": "alu_alumni_email", "valid": true },
  "chidi.okafor@si.alueducation.com": { "type": "alu_si_email", "valid": true },
  "dana.w@gmail.com": { "type": "email", "valid": true },
  "https://partner-sync.io/contact": { "type": "url", "valid": true },
  "+250 788 123 456": { "type": "phone", "valid": true },
  "4111 1111 1111 1111": { "type": "credit_card", "valid": true },
  "<br />": { "type": "html_tag", "valid": true },
  "student@alueducation": { "type": "invalid", "valid": false },
  "5555 5555 5555 4444": { "type": "invalid", "valid": false },
  "< not a tag >": { "type": "invalid", "valid": false }
}
```

| Field | Meaning |
|---|---|
| `type` | the pattern the string matched, or `invalid` if it matched none |
| `valid` | `true` for anything that matched a pattern, `false` otherwise |

The possible types are `alu_official_email`, `alu_alumni_email`, `alu_si_email`,
`email`, `url`, `phone`, `credit_card`, `html_tag` and `invalid`.

Every line of the input file produces exactly one entry, so the report can be
read straight down and compared against the input. Results for the sample data:

| Type | Count |
|---|---|
| `invalid` | 19 |
| `html_tag` | 13 |
| `url` | 11 |
| `phone` | 10 |
| `email` | 7 |
| `alu_official_email` | 3 |
| `alu_alumni_email` | 2 |
| `alu_si_email` | 2 |
| `credit_card` | 4 |

The console prints the same verdicts, one per line:

```
VALID    alu_official_email  n.mugisha@alueducation.com
VALID    credit_card         4111 1111 1111 1111
INVALID  invalid             student@alueducation

71 strings checked - 52 valid, 19 invalid
```

---

## Security considerations

The brief asks the program to show that input is not automatically trusted.
Two properties of the patterns themselves do that, and neither weakens if the
input file changes.

**1. The patterns are bounded, which prevents ReDoS.**
Every repetition has an upper limit — `{0,300}`, `{2,24}`, `{0,200}` — instead of
an open-ended `.*`. Catastrophic backtracking, where a crafted string makes a
regex engine run for an extremely long time, needs unbounded nested quantifiers.
Bounded ones cannot blow up, so a hostile input file cannot stall the program
through the pattern matching itself.

**2. Validation is allow-list shaped, not deny-list shaped.**
Every pattern describes what is *acceptable* and rejects everything else, rather
than listing bad things to block. Nothing is passed through because it "looks
fine" — a string is only ever accepted because it matched a pattern in full,
anchored end to end. Anything unexpected fails by default and is recorded as
`invalid`.

This is also what makes the ALU checks trustworthy: `admin@alueducation.com.attacker.net`
is a perfectly well-formed email address, and it is still rejected, because it
does not match any ALU pattern, so it can never be labelled as an ALU address.

Values are written to the report as they appear in the input. The sample data is
synthetic — no real addresses, phone numbers or card accounts — so there is
nothing to redact. A system processing live data should mask card numbers and
contact details before writing them to any report or log.

---

## Sample data

`input/raw-text.txt` states its own provenance at the top: **the raw input data
in that file was AI-generated.** It is synthetic — no real personal data. The
card numbers are the standard public test numbers that payment gateways publish
for testing, not real accounts. Each section deliberately mixes well-formed
entries with malformed ones so that every rejection path in the program is
exercised.
