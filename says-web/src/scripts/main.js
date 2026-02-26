(function () {
	const state = {
		prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
	};

	const logError = (context, error) => {
		console.error(`[says-web] ${context}`, error);
	};

	const safeExec = (callback, context) => {
		try {
			return callback();
		} catch (error) {
			logError(context, error);
			return undefined;
		}
	};

	const ensureImageAttributes = () => {
		document.querySelectorAll('img').forEach((img) => {
			if (!img.hasAttribute('loading')) {
				img.setAttribute('loading', 'lazy');
			}
			if (!img.hasAttribute('decoding')) {
				img.setAttribute('decoding', 'async');
			}
		});
	};

	const scrollIntoView = (element) => {
		if (!element) return;
		element.scrollIntoView({
			behavior: state.prefersReducedMotion ? 'auto' : 'smooth',
			block: 'start',
		});
	};

	const setupNavScrolling = () => {
		const nav = document.querySelector('.primary-nav');
		if (!nav) return;

		nav.addEventListener('click', (event) => {
			const link = event.target.closest('a[href^="#"]');
			if (!link) return;
			event.preventDefault();

			safeExec(() => {
				const targetId = link.getAttribute('href').slice(1);
				if (!targetId) return;
				const section = document.getElementById(targetId);
				scrollIntoView(section);
			}, 'navigation scroll');
		});
	};

	const setupHeroCta = () => {
		const button = document.querySelector('.hero-cta');
		if (!button) return;
		const selector = button.dataset.scrollTarget;
		if (!selector) return;

		button.addEventListener('click', () => {
			safeExec(() => {
				const target = document.querySelector(selector);
				if (!target) return;
				if (!target.hasAttribute('tabindex')) {
					target.setAttribute('tabindex', '-1');
				}
				scrollIntoView(target);
				if (typeof target.focus === 'function') {
					target.focus({ preventScroll: true });
				}
			}, 'hero cta scroll');
		});
	};

	const init = () => {
		safeExec(ensureImageAttributes, 'image attribute hydration');
		safeExec(setupNavScrolling, 'navigation wiring');
		safeExec(setupHeroCta, 'hero cta wiring');
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();