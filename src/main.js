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

const identify = (value) => {
	if (ALU_ALUMNI_EMAIL_REGEX.test(value)) return 'This is an ALU alumni email';
	if (ALU_SI_EMAIL_REGEX.test(value)) return 'This is an ALU SI email';
	if (ALU_OFFICIAL_EMAIL_REGEX.test(value)) return 'This is an ALU offical email';
	if (EMAIL_REGEX.test(value)) return 'This is a regular email address';
	if (VISA_CREDIT_CARD_REGEX.test(value)) return 'This is Visa Credit card';
	if (URL_REGEX.test(value)) return 'This is a valid url';
	if (PHONE_REGEX.test(value)) return 'This is a phone number';
	if (HTML_TAG_REGEX.test(value)) return 'This is a valid HTML tag';
	return null;
}

const readStrings = (filePath) => {
	return fs
		.readFileSync(filePath, 'utf-8')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !COMMENT_REGEX.test(line));
}

const main = () => {
	const root = path.dirname(__dirname);
	const outputPath = path.join(root, 'output', 'sample-output.json');
	const inputPath = path.join(root, 'input', 'raw-text.txt');

	const result = {};
	for (const value of readStrings(inputPath)) {
		const type = identify(value);
		result[value] = { type: type || 'Invalid String', valid: type !== null };
	}

	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	fs.writeFileSync(outputPath, JSON.stringify(result, null, 3) + '\n', 'utf-8');

	const entries = Object.entries(result);
	for (const [value, verdict] of entries) {
		console.log(`${verdict.valid ? 'VALID  ' : 'INVALID'}  ${verdict.type.padEnd(18)}  ${value}`);
	}

 	const valid = entries.filter(([, verdict]) => verdict.valid).length;
  console.log(`\n${entries.length} strings checked - ${valid} valid, ${entries.length - valid} invalid`);
  console.log(`Results written to ${path.relative(root, outputPath)}`);
}

main();
