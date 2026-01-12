const paser = new DOMParser();
const explainsAndTraitExp = /(^[a-zA-Z]+\.)?(.*$)/;

async function getAudioU8(url) {
	const res = await fetch(url);
	const blob = await res.blob();
	const buffer = await blob.arrayBuffer();
	return new Uint8Array(buffer);
}

async function translateWord(text, from, to, options) {
	const result = {};
	try {
		const res = await fetch(
			`https://m.youdao.com/dict?q=${encodeURIComponent(
				text.split(/\s/)[0].trim()
			)}&le=eng`,
			{
				method: "GET",
			}
		);
		if (!res.ok) throw new Error("Request error, status: " + res.status);
		const html = await res.text();
		const document = paser.parseFromString(html, "text/html");
		const ec = document.getElementById("ec");
		if (!ec) throw new Error("not found this word!");

		// pronunciations
		const phonetic = ec.getElementsByClassName("phonetic");
		if (phonetic.length >= 2) {
			const pronunciations = (result.pronunciations = []);
			const audio = Array.from(ec.querySelectorAll("[title=真人发音]")).map(
				(el) => el.dataset.rel
			);
			pronunciations.push({
				region: "英", // 地区
				symbol: phonetic[0].textContent.trim(), // 音标
				voice: Array.from(getAudioU8(audio[0])),
			});
			pronunciations.push({
				region: "美", // 地区
				symbol: phonetic[1].textContent.trim(), // 音标
				voice: Array.from(getAudioU8(audio[0])),
			});
		}

		//explanations
		const explainsAndTrait = ec.querySelector("ul")?.children || [];
		const explanations = (result.explanations = []);
		for (let i = 0; i < explainsAndTrait.length; i++) {
			const textContent = explainsAndTrait[i].textContent.trim();
			const regExpMatchArray = textContent.match(explainsAndTraitExp);
			regExpMatchArray.length === 3 &&
				explanations.push({
					trait: regExpMatchArray[1], // 词性
					explains: [regExpMatchArray[2]], // 释义
				});
		}

		//associations
		const associations = (result.associations = []);
		const associationsRes = await fetch(
			`https://m.youdao.com/singledict?q=${encodeURIComponent(
				text.split(/\s/)[0].trim()
			)}&dict=syno&le=eng&more=false`,
			{
				method: "GET",
			}
		);
		if (associationsRes.ok) {
			const associationsHtml = await associationsRes.text();
			const associationsDocument = paser.parseFromString(
				associationsHtml,
				"text/html"
			);
			const associationsLis =
				associationsDocument.querySelector("ul")?.children || [];
			for (let i = 0; i < associationsLis.length; i++) {
				const source = associationsLis[i].children[0].textContent.trim();
				const target = associationsLis[i].children[1].textContent.trim();
				associations.push(`${source} -> ${target.replace("   /   ", "、")}`);
			}
		}

		//sentence
		const sentence = (result.sentence = []);
		const sentenceRes = await fetch(
			`https://m.youdao.com/singledict?q=${encodeURIComponent(
				text.split(/\s/)[0].trim()
			)}&dict=blng_sents_part&le=eng&more=false`,
			{
				method: "GET",
			}
		);
		if (sentenceRes.ok) {
			const sentenceHtml = await sentenceRes.text();
			const sentenceDocument = paser.parseFromString(sentenceHtml, "text/html");
			const sentenceLis = sentenceDocument.getElementsByClassName("col2") || [];
			for (let i = 0; i < sentenceLis.length; i++) {
				const source = sentenceLis[i].children[0].textContent.trim();
				const target = sentenceLis[i].children[1].textContent.trim();
				sentence.push({
					source, // 原文
					target, // 译文
				});
			}
		}
		return result;
	} catch (error) {
		return error.message;
		// throw error;
	}
}

async function translateSentence(text, from, to, options) {
	try {
		const res = await fetch("https://m.youdao.com/translate", {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
			},
			body: `inputtext=${encodeURIComponent(text)}&type=AUTO`,
		});
		if (!res.ok) throw new Error("Request error, status: " + res.status);
		const html = await res.text();
		const document = paser.parseFromString(html, "text/html");
		const translateResult = document.getElementById("translateResult");
		return translateResult?.textContent || "";
	} catch (error) {
		return error.message;
		// throw error;
	}
}

async function translate(text, from, to, options) {
	try {
		const isWord = /^\b\w+\b$/.test(text.trim());
		if (isWord) {
			return await translateWord(...arguments);
		} else {
			return await translateSentence(...arguments);
		}
	} catch (error) {
		return error.message;
		// throw error;
	}
}
