import pLimit from 'p-limit';

class EndError extends Error {
	constructor(value) {
		super();
		this.value = value;
	}
}

// Cache for tester results by element identity
const createCache = () => new Map();

// Optimized testElement with caching
const testElement = async (element, tester, cache) => {
	const resolved = await element;

	// Check cache first
	if (cache.has(resolved)) {
		return cache.get(resolved);
	}

	// Call tester and cache result
	const result = await tester(resolved);
	cache.set(resolved, result);
	return result;
};

// Optimized finder with early termination and reduced allocations
const finder = async (elementPromise, testPromise) => {
	const [element, testResult] = await Promise.all([elementPromise, testPromise]);

	// Early termination optimization
	if (testResult === true) {
		throw new EndError(element);
	}

	return false;
};

export default async function pLocate(
	iterable,
	tester,
	{
		concurrency = Number.POSITIVE_INFINITY,
		preserveOrder = true,
	} = {},
) {
	const limit = pLimit(concurrency);
	const cache = createCache();

	// Optimized: Reduce promise allocations by pre-resolving element promises
	const items = [...iterable].map(element => {
		const elementPromise = Promise.resolve(element);
		const testPromise = limit(testElement, element, tester, cache);
		return [elementPromise, testPromise];
	});

	// Check the promises either serially or concurrently
	const checkLimit = pLimit(preserveOrder ? 1 : Number.POSITIVE_INFINITY);

	try {
		await Promise.all(items.map(([elementPromise, testPromise]) =>
			checkLimit(finder, elementPromise, testPromise),
		));
	} catch (error) {
		if (error instanceof EndError) {
			return error.value;
		}

		throw error;
	}
}
