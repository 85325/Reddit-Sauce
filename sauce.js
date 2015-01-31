var banned = ["reddit.com", "imgur.com"];
var semi = ["gfycat.com"];
var svg = chrome.extension.getURL('sauce.svg');

function isSemi(hostname) {
	for (var i in semi) {
		if (hostname.indexOf(semi[i]) != -1)
			return true;
	}
	return false;
}

function isBanned(hostname) {
	for (var i in banned) {
		if (hostname.indexOf(banned[i]) != -1)
			return true;
	}
	return false;
}

$('.thing.over18').each(function(i, post) {
	var url = $(".buttons .first a", post).attr("href") + ".json";

	$.get(url, function(data) {
		var comments = data[1].data.children;
		var sauces = [];

		while (comments.length > 0) {
			var com = comments[0];

			$($.parseHTML(com.data.body_html)[0].wholeText).find("a")
			.each(function(i, link) {
				var $link = $(link);
				if ($link[0] && !isBanned($link[0].hostname)) {
					$link.addClass( (isSemi($link[0].hostname) ? "mild " : "") + "sauce");
					sauces.push($link);
				}
			});

			if (com.replies) {
				comments.push.apply(comments, com.data.replies.data.children);
			}

			comments.shift();
		}

		sauces.forEach(function($link) {
			$link.text("");
			$link.attr("target", "_blank");
			$(".title .domain", post).after($link);
		});

	});
});


