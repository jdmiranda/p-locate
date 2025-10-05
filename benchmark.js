/* eslint-disable no-await-in-loop */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import pLocate from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create test directory structure
async function setupTestFiles() {
	const testDirectory = path.join(__dirname, 'benchmark-test');
	await fs.mkdir(testDirectory, {recursive: true});

	// Create 100 test files
	const files = [];
	for (let index = 0; index < 100; index++) {
		const filePath = path.join(testDirectory, `file-${index}.txt`);
		await fs.writeFile(filePath, `content ${index}`);
		files.push(filePath);
	}

	return {testDirectory, files};
}

// Cleanup test files
async function cleanup(testDirectory) {
	await fs.rm(testDirectory, {recursive: true, force: true});
}

// Benchmark runner
async function runBenchmark(name, files, tester, iterations = 1000) {
	const start = performance.now();

	for (let index = 0; index < iterations; index++) {
		await pLocate(files, tester);
	}

	const end = performance.now();
	const totalTime = end - start;
	const opsPerSecond = (iterations / totalTime) * 1000;

	console.log(`${name}:`);
	console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
	console.log(`  Iterations: ${iterations}`);
	console.log(`  Ops/sec: ${opsPerSecond.toFixed(2)}`);
	console.log(`  Avg time per op: ${(totalTime / iterations).toFixed(4)}ms\n`);

	return opsPerSecond;
}

console.log('Setting up benchmark files...\n');
const {testDirectory, files} = await setupTestFiles();

try {
	console.log('=== p-locate Performance Benchmark ===\n');
	console.log(`Testing with ${files.length} files\n`);

	// Benchmark 1: File existence check (async tester)
	await runBenchmark(
		'Benchmark 1: Async file existence (target at index 50)',
		files,
		async file => file.includes('file-50'),
		1000,
	);

	// Benchmark 2: Synchronous tester (tests fast path)
	await runBenchmark(
		'Benchmark 2: Sync tester (target at index 50)',
		files,
		file => file.includes('file-50'),
		2000,
	);

	// Benchmark 3: Early termination (target at index 10)
	await runBenchmark(
		'Benchmark 3: Early termination (target at index 10)',
		files,
		file => file.includes('file-10'),
		2000,
	);

	// Benchmark 4: Late match (target at index 90)
	await runBenchmark(
		'Benchmark 4: Late match (target at index 90)',
		files,
		file => file.includes('file-90'),
		1000,
	);

	// Benchmark 5: No match (cache benefit)
	await runBenchmark(
		'Benchmark 5: No match - full scan (cache benefit)',
		files,
		file => file.includes('file-999'),
		500,
	);

	// Benchmark 6: With concurrency limit
	console.log('Benchmark 6: With concurrency limit (5)');
	const start = performance.now();
	const iterations = 500;

	for (let index = 0; index < iterations; index++) {
		await pLocate(files, file => file.includes('file-50'), {concurrency: 5});
	}

	const end = performance.now();
	const totalTime = end - start;
	const opsPerSecond = (iterations / totalTime) * 1000;

	console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
	console.log(`  Iterations: ${iterations}`);
	console.log(`  Ops/sec: ${opsPerSecond.toFixed(2)}`);
	console.log(`  Avg time per op: ${(totalTime / iterations).toFixed(4)}ms\n`);

	// Benchmark 7: preserveOrder false (race mode)
	console.log('Benchmark 7: preserveOrder=false (race mode)');
	const start2 = performance.now();
	const iterations2 = 1000;

	for (let index = 0; index < iterations2; index++) {
		await pLocate(files, file => file.includes('file-50'), {preserveOrder: false});
	}

	const end2 = performance.now();
	const totalTime2 = end2 - start2;
	const opsPerSecond2 = (iterations2 / totalTime2) * 1000;

	console.log(`  Total time: ${totalTime2.toFixed(2)}ms`);
	console.log(`  Iterations: ${iterations2}`);
	console.log(`  Ops/sec: ${opsPerSecond2.toFixed(2)}`);
	console.log(`  Avg time per op: ${(totalTime2 / iterations2).toFixed(4)}ms\n`);

	console.log('=== Benchmark Complete ===');
} finally {
	console.log('\nCleaning up...');
	await cleanup(testDirectory);
}
