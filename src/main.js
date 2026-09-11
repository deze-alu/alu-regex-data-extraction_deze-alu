#!/usr/bin/env node
const fs = require("fs")
const path = require("path")

const EMAIL_REGEX = /^[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;
const URL_REGEX = /^(?:https|http):\/\/[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+(?::\d{2,5})?(?:\/[^\s"'<>]{0,300})?$/
const PHONE_REGEX = /^(?!(?:\D*\d){13})(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})(?:[\s.-]?\d{2,4}){2,3}$/;
const VISA_CREDIT_CARD_REGEX = /^4\d{3}([ -]?)\d{4}\1\d{4}\1\d{4}$/;
const HTML_TAG_REGEX = /^<\/?[A-Za-z][A-Za-z0-9-]{0,20}(?:\s[^<>]{0,200})?\/?>$/;
const ALU_OFFICIAL_EMAIL_REGEX = /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*@alueducation\.com$/i;
const ALU_ALUMNI_EMAIL_REGEX = /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*@alumni\.alueducation\.com$/i;
const ALU_SI_EMAIL_REGEX = /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*@si\.alueducation\.com$/i;
const COMMENT_REGEX = /^\/\//;

// Source - https://stackoverflow.com/a/31096949
const maskCard = (value) => '************' + value.slice(-4);

// Code idea gotten from: https://stackoverflow.com/questions/17651207/mask-us-phone-number-string-with-javascript
const maskPhone = (value) => {
	let seen = 0;
	return value.replace(/\d/g, (digit) => {
		seen += 1;
		return seen <= 6 ? digit : '*';
	});
};

// Idea Gotten from: https://stackoverflow.com/questions/39247866/mask-email-in-javascript
const maskEmail = (value) => {
	return value.replace(/^([^@]+)@/, (_, local) => {
		if (local.length <= 2) return '**@';
		return local[0] + '*'.repeat(local.length - 2) + local[local.length - 1] + '@';
	});
};

const plainReveal = (value) => value;

const RULES = [
	{ regex: ALU_ALUMNI_EMAIL_REGEX, label: 'This is an ALU alumni email', mask: maskEmail },
	{ regex: ALU_SI_EMAIL_REGEX, label: 'This is an ALU SI email', mask: maskEmail },
	{ regex: ALU_OFFICIAL_EMAIL_REGEX, label: 'This is an ALU official email', mask: maskEmail },
	{ regex: EMAIL_REGEX, label: 'This is a regular email address', mask: maskEmail },
	{ regex: VISA_CREDIT_CARD_REGEX, label: 'This is Visa Credit card', mask: maskCard },
	{ regex: URL_REGEX, label: 'This is a valid url', mask: plainReveal },
	{ regex: PHONE_REGEX, label: 'This is a phone number', mask: maskPhone },
	{ regex: HTML_TAG_REGEX, label: 'This is a valid HTML tag', mask: plainReveal },
];

const INVALID_RULE = { label: 'Invalid String', mask: plainReveal };

const identify = (value) => RULES.find((rule) => rule.regex.test(value)) || null;

const readStrings = (filePath) => {
	return fs
		.readFileSync(filePath, 'utf-8')
		.split(/\r?\n/)
		.map((text) => ({ value: text.trim() }))
		.filter(({ value }) => value.length > 0 && !COMMENT_REGEX.test(value));
}


// Main function runner
const main = () => {
	const root = path.dirname(__dirname);
	const outputPath = path.join(root, 'output', 'sample-output.json');
	const inputPath = path.join(root, 'input', 'raw-text.txt');

	const records = readStrings(inputPath).map(({ value }) => {
		const rule = identify(value) || INVALID_RULE;
		return {
			value: rule.mask(value),
			type: rule.label,
			valid: rule !== INVALID_RULE,
		};
	});

	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	fs.writeFileSync(outputPath, JSON.stringify(records, null, 3) + '\n', 'utf-8');

	for (const record of records) {
		console.log(`${record.valid ? 'VALID  ' : 'INVALID'}  ${record.type.padEnd(31)}  ${record.value}`);
	}

	const valid = records.filter((record) => record.valid).length;
	console.log(`\n${records.length} strings checked - ${valid} valid, ${records.length - valid} invalid`);
	console.log(`Results written to ${path.relative(root, outputPath)}`);
}

main();
