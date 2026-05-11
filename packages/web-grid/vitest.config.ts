import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		// happy-dom: lighter than jsdom, sufficient for the bits of grid.ts that
		// touch DOM globals indirectly (loglevel's prefix plugin, future shadow-DOM
		// adapter tests). The core WebGrid class is plain TS and runs without it,
		// but happy-dom is cheap insurance and keeps the same env across test files.
		environment: 'happy-dom',
		// Co-located *.test.ts files alongside source.
		include: ['src/**/*.test.ts'],
		// No watch by default; `npm run test:watch` for that.
		watch: false,
		// Quiet by default — re-enable when debugging.
		silent: false,
		reporters: ['default'],
		// loglevel is silent at module load (`log.setLevel('silent')`); no test config needed.
	}
})
