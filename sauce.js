const DOMAINS = {
	banned: ['imgur.com', 'github.com', 'youtube.com', 'twitter.com', 'instagram.com', 'wikipedia.org', 'reactiongifs.com'],
	gif: ['gfycat.com'],
	reddit: ['reddit.com'],
}

function isGif (hostname) {
	return !!DOMAINS.gif.find(domain => hostname.includes(domain))
}

function isBanned (hostname) {
 	return !!DOMAINS.banned.find(domain => hostname.includes(domain))
}

function isReddit (hostname) {
 	return !hostname || !!DOMAINS.reddit.find(domain => hostname.includes(domain))
}

function getJsonPage (url, cb) {
	return fetch(url).then(res => res.json())
}

function querySelector (selector, container) {
	container = container || document
	return container.querySelector(selector)
}

function querySelectorAll (selector, container) {
	container = container || document
	return Array.prototype.slice.call(container.querySelectorAll(selector))
}

function processLinks (links) {
	return links
		.filter(link => !isBanned(link.hostname))
		.map(link => {
			const types = ['sauce']

			if (isGif(link.hostname)) types.push('gif')
			if (isReddit(link.hostname)) types.push('reddit')

			return {
				href: link.href,
				hostname: link.hostname,
				types,
			}
		})
}

function unescapeHtml(safe) {
  return safe.replace(/&amp;/g, '&')
  	.replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
}

function parseHTML (html) {
	const parser = new DOMParser()
	const doc = parser.parseFromString(unescapeHtml(html), 'text/html')
	return doc
}

function findJsonSauces (data) {
	const comments = data[1].data.children
	let sauces = []

	while (comments.length > 0) {
		const com = comments[0]

		const html = parseHTML(com.data.body_html)
		const links = querySelectorAll('a', html)

		sauces = sauces.concat(processLinks( links ))

		// add replies to comments to parse
		if (com.data.replies) {
			comments.push.apply(comments, com.data.replies.data.children)
		}

		comments.shift()
	}

	return sauces
}

function createSauceLink (sauce) {
	const link = document.createElement('a')
	link.setAttribute('href', sauce.href)
	link.setAttribute('title', sauce.href)
	link.setAttribute('target', '_blank')

	link.className = sauce.types.join(' ')

	return link
}

function reduceSauces (sauceSets) {
	const urls = []

	return sauceSets.reduce((reduced, set) => {
		return reduced.concat(set.filter(sauce => {
			const found = urls.indexOf(sauce.href) !== -1
			if (!found) urls.push(sauce.href)
			return !found
		}))
	}, []).sort((a, b) => {
		if (a.types.includes('gif')) return -1
		if (b.types.includes('gif')) return 1
		if (a.types.includes('reddit')) return 1
		if (b.types.includes('reddit')) return -1
		else return 0
	})
}

function findPostSauces (post, cb) {
	const link = querySelector('.buttons .first a', post)
	const url = link.getAttribute('href').replace('/comments/', '/duplicates/')

	// get all duplicate posts
	getJsonPage(url + '.json')
		.then(res => {
			const posts = res[0].data.children.concat(res[1].data.children)

			// now parse every instace of the post
			Promise.all(posts.map(post => {
				const permalink = post.data.permalink
				return getJsonPage(permalink + '.json')
			}))
			.then(results => {
				// extract sauces from comments of each post and remove dupes
				const sauces = reduceSauces(results.map(findJsonSauces))
				cb(sauces)
			})
		})
}

const CACHE_TIME = 5 * 60 * 1000

function saveSauces (postId, sauces, cb) {
	chrome.storage.local.set({
		[postId]: {
			time: Date.now(),
			sauces,
		}
	}, cb)
}

function loadSauces (postId, cb) {
	chrome.storage.local.get(postId, data => cb(data[postId]))
}

function injectSauces (post, sauces) {
	const title = querySelector('.title', post)

	sauces
		.map(createSauceLink)
		.forEach(link => {
			title.appendChild(link)
		})
}

function processPage (page) {
	querySelectorAll('.thing.link.over18', page)
		.forEach(post => {
			const id = post.getAttribute('data-url')
			loadSauces(id, sauceData => {
				// if no data or out of date..
				if (!sauceData || Date.now() - sauceData.time > CACHE_TIME) {
					findPostSauces(post, sauces => {
						saveSauces(id, sauces, () => {})
						injectSauces(post, sauces)
					})
				// else use cached links
				} else {
					injectSauces(post, sauceData.sauces)
				}
			})
		})
}

// start app
(function () {
	processPage()
}())
