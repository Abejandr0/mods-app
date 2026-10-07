import { BrowserWindow as e, Menu as t, app as n, ipcMain as r } from "electron";
import i from "path";
import { fileURLToPath as a } from "url";
//#region node_modules/@google/generative-ai/dist/index.mjs
var o;
(function(e) {
	e.STRING = "string", e.NUMBER = "number", e.INTEGER = "integer", e.BOOLEAN = "boolean", e.ARRAY = "array", e.OBJECT = "object";
})(o ||= {});
var s;
(function(e) {
	e.LANGUAGE_UNSPECIFIED = "language_unspecified", e.PYTHON = "python";
})(s ||= {});
var c;
(function(e) {
	e.OUTCOME_UNSPECIFIED = "outcome_unspecified", e.OUTCOME_OK = "outcome_ok", e.OUTCOME_FAILED = "outcome_failed", e.OUTCOME_DEADLINE_EXCEEDED = "outcome_deadline_exceeded";
})(c ||= {});
var l = [
	"user",
	"model",
	"function",
	"system"
], u;
(function(e) {
	e.HARM_CATEGORY_UNSPECIFIED = "HARM_CATEGORY_UNSPECIFIED", e.HARM_CATEGORY_HATE_SPEECH = "HARM_CATEGORY_HATE_SPEECH", e.HARM_CATEGORY_SEXUALLY_EXPLICIT = "HARM_CATEGORY_SEXUALLY_EXPLICIT", e.HARM_CATEGORY_HARASSMENT = "HARM_CATEGORY_HARASSMENT", e.HARM_CATEGORY_DANGEROUS_CONTENT = "HARM_CATEGORY_DANGEROUS_CONTENT", e.HARM_CATEGORY_CIVIC_INTEGRITY = "HARM_CATEGORY_CIVIC_INTEGRITY";
})(u ||= {});
var d;
(function(e) {
	e.HARM_BLOCK_THRESHOLD_UNSPECIFIED = "HARM_BLOCK_THRESHOLD_UNSPECIFIED", e.BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE", e.BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE", e.BLOCK_ONLY_HIGH = "BLOCK_ONLY_HIGH", e.BLOCK_NONE = "BLOCK_NONE";
})(d ||= {});
var f;
(function(e) {
	e.HARM_PROBABILITY_UNSPECIFIED = "HARM_PROBABILITY_UNSPECIFIED", e.NEGLIGIBLE = "NEGLIGIBLE", e.LOW = "LOW", e.MEDIUM = "MEDIUM", e.HIGH = "HIGH";
})(f ||= {});
var p;
(function(e) {
	e.BLOCKED_REASON_UNSPECIFIED = "BLOCKED_REASON_UNSPECIFIED", e.SAFETY = "SAFETY", e.OTHER = "OTHER";
})(p ||= {});
var m;
(function(e) {
	e.FINISH_REASON_UNSPECIFIED = "FINISH_REASON_UNSPECIFIED", e.STOP = "STOP", e.MAX_TOKENS = "MAX_TOKENS", e.SAFETY = "SAFETY", e.RECITATION = "RECITATION", e.LANGUAGE = "LANGUAGE", e.BLOCKLIST = "BLOCKLIST", e.PROHIBITED_CONTENT = "PROHIBITED_CONTENT", e.SPII = "SPII", e.MALFORMED_FUNCTION_CALL = "MALFORMED_FUNCTION_CALL", e.OTHER = "OTHER";
})(m ||= {});
var h;
(function(e) {
	e.TASK_TYPE_UNSPECIFIED = "TASK_TYPE_UNSPECIFIED", e.RETRIEVAL_QUERY = "RETRIEVAL_QUERY", e.RETRIEVAL_DOCUMENT = "RETRIEVAL_DOCUMENT", e.SEMANTIC_SIMILARITY = "SEMANTIC_SIMILARITY", e.CLASSIFICATION = "CLASSIFICATION", e.CLUSTERING = "CLUSTERING";
})(h ||= {});
var g;
(function(e) {
	e.MODE_UNSPECIFIED = "MODE_UNSPECIFIED", e.AUTO = "AUTO", e.ANY = "ANY", e.NONE = "NONE";
})(g ||= {});
var ee;
(function(e) {
	e.MODE_UNSPECIFIED = "MODE_UNSPECIFIED", e.MODE_DYNAMIC = "MODE_DYNAMIC";
})(ee ||= {});
var _ = class extends Error {
	constructor(e) {
		super(`[GoogleGenerativeAI Error]: ${e}`);
	}
}, v = class extends _ {
	constructor(e, t) {
		super(e), this.response = t;
	}
}, y = class extends _ {
	constructor(e, t, n, r) {
		super(e), this.status = t, this.statusText = n, this.errorDetails = r;
	}
}, b = class extends _ {}, x = class extends _ {}, te = "https://generativelanguage.googleapis.com", S = "v1beta", ne = "0.24.1", re = "genai-js", C;
(function(e) {
	e.GENERATE_CONTENT = "generateContent", e.STREAM_GENERATE_CONTENT = "streamGenerateContent", e.COUNT_TOKENS = "countTokens", e.EMBED_CONTENT = "embedContent", e.BATCH_EMBED_CONTENTS = "batchEmbedContents";
})(C ||= {});
var w = class {
	constructor(e, t, n, r, i) {
		this.model = e, this.task = t, this.apiKey = n, this.stream = r, this.requestOptions = i;
	}
	toString() {
		let e = this.requestOptions?.apiVersion || S, t = `${this.requestOptions?.baseUrl || te}/${e}/${this.model}:${this.task}`;
		return this.stream && (t += "?alt=sse"), t;
	}
};
function T(e) {
	let t = [];
	return e?.apiClient && t.push(e.apiClient), t.push(`${re}/${ne}`), t.join(" ");
}
async function E(e) {
	let t = new Headers();
	t.append("Content-Type", "application/json"), t.append("x-goog-api-client", T(e.requestOptions)), t.append("x-goog-api-key", e.apiKey);
	let n = e.requestOptions?.customHeaders;
	if (n) {
		if (!(n instanceof Headers)) try {
			n = new Headers(n);
		} catch (e) {
			throw new b(`unable to convert customHeaders value ${JSON.stringify(n)} to Headers: ${e.message}`);
		}
		for (let [e, r] of n.entries()) {
			if (e === "x-goog-api-key") throw new b(`Cannot set reserved header name ${e}`);
			if (e === "x-goog-api-client") throw new b(`Header name ${e} can only be set using the apiClient field`);
			t.append(e, r);
		}
	}
	return t;
}
async function D(e, t, n, r, i, a) {
	let o = new w(e, t, n, r, a);
	return {
		url: o.toString(),
		fetchOptions: Object.assign(Object.assign({}, se(a)), {
			method: "POST",
			headers: await E(o),
			body: i
		})
	};
}
async function O(e, t, n, r, i, a = {}, o = fetch) {
	let { url: s, fetchOptions: c } = await D(e, t, n, r, i, a);
	return ie(s, c, o);
}
async function ie(e, t, n = fetch) {
	let r;
	try {
		r = await n(e, t);
	} catch (t) {
		ae(t, e);
	}
	return r.ok || await oe(r, e), r;
}
function ae(e, t) {
	let n = e;
	throw n.name === "AbortError" ? (n = new x(`Request aborted when fetching ${t.toString()}: ${e.message}`), n.stack = e.stack) : e instanceof y || e instanceof b || (n = new _(`Error fetching from ${t.toString()}: ${e.message}`), n.stack = e.stack), n;
}
async function oe(e, t) {
	let n = "", r;
	try {
		let t = await e.json();
		n = t.error.message, t.error.details && (n += ` ${JSON.stringify(t.error.details)}`, r = t.error.details);
	} catch {}
	throw new y(`Error fetching from ${t.toString()}: [${e.status} ${e.statusText}] ${n}`, e.status, e.statusText, r);
}
function se(e) {
	let t = {};
	if (e?.signal !== void 0 || e?.timeout >= 0) {
		let n = new AbortController();
		e?.timeout >= 0 && setTimeout(() => n.abort(), e.timeout), e?.signal && e.signal.addEventListener("abort", () => {
			n.abort();
		}), t.signal = n.signal;
	}
	return t;
}
function k(e) {
	return e.text = () => {
		if (e.candidates && e.candidates.length > 0) {
			if (e.candidates.length > 1 && console.warn(`This response had ${e.candidates.length} candidates. Returning text from the first candidate only. Access response.candidates directly to use the other candidates.`), M(e.candidates[0])) throw new v(`${N(e)}`, e);
			return ce(e);
		}
		if (e.promptFeedback) throw new v(`Text not available. ${N(e)}`, e);
		return "";
	}, e.functionCall = () => {
		if (e.candidates && e.candidates.length > 0) {
			if (e.candidates.length > 1 && console.warn(`This response had ${e.candidates.length} candidates. Returning function calls from the first candidate only. Access response.candidates directly to use the other candidates.`), M(e.candidates[0])) throw new v(`${N(e)}`, e);
			return console.warn("response.functionCall() is deprecated. Use response.functionCalls() instead."), A(e)[0];
		}
		if (e.promptFeedback) throw new v(`Function call not available. ${N(e)}`, e);
	}, e.functionCalls = () => {
		if (e.candidates && e.candidates.length > 0) {
			if (e.candidates.length > 1 && console.warn(`This response had ${e.candidates.length} candidates. Returning function calls from the first candidate only. Access response.candidates directly to use the other candidates.`), M(e.candidates[0])) throw new v(`${N(e)}`, e);
			return A(e);
		}
		if (e.promptFeedback) throw new v(`Function call not available. ${N(e)}`, e);
	}, e;
}
function ce(e) {
	let t = [];
	if (e.candidates?.[0].content?.parts) for (let n of e.candidates?.[0].content?.parts) n.text && t.push(n.text), n.executableCode && t.push("\n```" + n.executableCode.language + "\n" + n.executableCode.code + "\n```\n"), n.codeExecutionResult && t.push("\n```\n" + n.codeExecutionResult.output + "\n```\n");
	return t.length > 0 ? t.join("") : "";
}
function A(e) {
	let t = [];
	if (e.candidates?.[0].content?.parts) for (let n of e.candidates?.[0].content?.parts) n.functionCall && t.push(n.functionCall);
	if (t.length > 0) return t;
}
var j = [
	m.RECITATION,
	m.SAFETY,
	m.LANGUAGE
];
function M(e) {
	return !!e.finishReason && j.includes(e.finishReason);
}
function N(e) {
	let t = "";
	if ((!e.candidates || e.candidates.length === 0) && e.promptFeedback) t += "Response was blocked", e.promptFeedback?.blockReason && (t += ` due to ${e.promptFeedback.blockReason}`), e.promptFeedback?.blockReasonMessage && (t += `: ${e.promptFeedback.blockReasonMessage}`);
	else if (e.candidates?.[0]) {
		let n = e.candidates[0];
		M(n) && (t += `Candidate was blocked due to ${n.finishReason}`, n.finishMessage && (t += `: ${n.finishMessage}`));
	}
	return t;
}
function P(e) {
	return this instanceof P ? (this.v = e, this) : new P(e);
}
function F(e, t, n) {
	if (!Symbol.asyncIterator) throw TypeError("Symbol.asyncIterator is not defined.");
	var r = n.apply(e, t || []), i, a = [];
	return i = {}, o("next"), o("throw"), o("return"), i[Symbol.asyncIterator] = function() {
		return this;
	}, i;
	function o(e) {
		r[e] && (i[e] = function(t) {
			return new Promise(function(n, r) {
				a.push([
					e,
					t,
					n,
					r
				]) > 1 || s(e, t);
			});
		});
	}
	function s(e, t) {
		try {
			c(r[e](t));
		} catch (e) {
			d(a[0][3], e);
		}
	}
	function c(e) {
		e.value instanceof P ? Promise.resolve(e.value.v).then(l, u) : d(a[0][2], e);
	}
	function l(e) {
		s("next", e);
	}
	function u(e) {
		s("throw", e);
	}
	function d(e, t) {
		e(t), a.shift(), a.length && s(a[0][0], a[0][1]);
	}
}
var I = /^data\: (.*)(?:\n\n|\r\r|\r\n\r\n)/;
function L(e) {
	let [t, n] = B(e.body.pipeThrough(new TextDecoderStream("utf8", { fatal: !0 }))).tee();
	return {
		stream: z(t),
		response: R(n)
	};
}
async function R(e) {
	let t = [], n = e.getReader();
	for (;;) {
		let { done: e, value: r } = await n.read();
		if (e) return k(V(t));
		t.push(r);
	}
}
function z(e) {
	return F(this, arguments, function* () {
		let t = e.getReader();
		for (;;) {
			let { value: e, done: n } = yield P(t.read());
			if (n) break;
			yield yield P(k(e));
		}
	});
}
function B(e) {
	let t = e.getReader();
	return new ReadableStream({ start(e) {
		let n = "";
		return r();
		function r() {
			return t.read().then(({ value: t, done: i }) => {
				if (i) {
					if (n.trim()) {
						e.error(new _("Failed to parse stream"));
						return;
					}
					e.close();
					return;
				}
				n += t;
				let a = n.match(I), o;
				for (; a;) {
					try {
						o = JSON.parse(a[1]);
					} catch {
						e.error(new _(`Error parsing JSON response: "${a[1]}"`));
						return;
					}
					e.enqueue(o), n = n.substring(a[0].length), a = n.match(I);
				}
				return r();
			}).catch((e) => {
				let t = e;
				throw t.stack = e.stack, t = t.name === "AbortError" ? new x("Request aborted when reading from the stream") : new _("Error reading from the stream"), t;
			});
		}
	} });
}
function V(e) {
	let t = { promptFeedback: e[e.length - 1]?.promptFeedback };
	for (let n of e) {
		if (n.candidates) {
			let e = 0;
			for (let r of n.candidates) if (t.candidates ||= [], t.candidates[e] || (t.candidates[e] = { index: e }), t.candidates[e].citationMetadata = r.citationMetadata, t.candidates[e].groundingMetadata = r.groundingMetadata, t.candidates[e].finishReason = r.finishReason, t.candidates[e].finishMessage = r.finishMessage, t.candidates[e].safetyRatings = r.safetyRatings, r.content && r.content.parts) {
				t.candidates[e].content || (t.candidates[e].content = {
					role: r.content.role || "user",
					parts: []
				});
				let n = {};
				for (let i of r.content.parts) i.text && (n.text = i.text), i.functionCall && (n.functionCall = i.functionCall), i.executableCode && (n.executableCode = i.executableCode), i.codeExecutionResult && (n.codeExecutionResult = i.codeExecutionResult), Object.keys(n).length === 0 && (n.text = ""), t.candidates[e].content.parts.push(n);
			}
			e++;
		}
		n.usageMetadata && (t.usageMetadata = n.usageMetadata);
	}
	return t;
}
async function H(e, t, n, r) {
	return L(await O(t, C.STREAM_GENERATE_CONTENT, e, !0, JSON.stringify(n), r));
}
async function U(e, t, n, r) {
	return { response: k(await (await O(t, C.GENERATE_CONTENT, e, !1, JSON.stringify(n), r)).json()) };
}
function W(e) {
	if (e != null) {
		if (typeof e == "string") return {
			role: "system",
			parts: [{ text: e }]
		};
		if (e.text) return {
			role: "system",
			parts: [e]
		};
		if (e.parts) return e.role ? e : {
			role: "system",
			parts: e.parts
		};
	}
}
function G(e) {
	let t = [];
	if (typeof e == "string") t = [{ text: e }];
	else for (let n of e) typeof n == "string" ? t.push({ text: n }) : t.push(n);
	return le(t);
}
function le(e) {
	let t = {
		role: "user",
		parts: []
	}, n = {
		role: "function",
		parts: []
	}, r = !1, i = !1;
	for (let a of e) "functionResponse" in a ? (n.parts.push(a), i = !0) : (t.parts.push(a), r = !0);
	if (r && i) throw new _("Within a single message, FunctionResponse cannot be mixed with other type of part in the request for sending chat message.");
	if (!r && !i) throw new _("No content is provided for sending chat message.");
	return r ? t : n;
}
function ue(e, t) {
	let n = {
		model: t?.model,
		generationConfig: t?.generationConfig,
		safetySettings: t?.safetySettings,
		tools: t?.tools,
		toolConfig: t?.toolConfig,
		systemInstruction: t?.systemInstruction,
		cachedContent: t?.cachedContent?.name,
		contents: []
	}, r = e.generateContentRequest != null;
	if (e.contents) {
		if (r) throw new b("CountTokensRequest must have one of contents or generateContentRequest, not both.");
		n.contents = e.contents;
	} else if (r) n = Object.assign(Object.assign({}, n), e.generateContentRequest);
	else {
		let t = G(e);
		n.contents = [t];
	}
	return { generateContentRequest: n };
}
function K(e) {
	let t;
	return t = e.contents ? e : { contents: [G(e)] }, e.systemInstruction && (t.systemInstruction = W(e.systemInstruction)), t;
}
function de(e) {
	return typeof e == "string" || Array.isArray(e) ? { content: G(e) } : e;
}
var q = [
	"text",
	"inlineData",
	"functionCall",
	"functionResponse",
	"executableCode",
	"codeExecutionResult"
], fe = {
	user: ["text", "inlineData"],
	function: ["functionResponse"],
	model: [
		"text",
		"functionCall",
		"executableCode",
		"codeExecutionResult"
	],
	system: ["text"]
};
function pe(e) {
	let t = !1;
	for (let n of e) {
		let { role: e, parts: r } = n;
		if (!t && e !== "user") throw new _(`First content should be with role 'user', got ${e}`);
		if (!l.includes(e)) throw new _(`Each item should include role field. Got ${e} but valid roles are: ${JSON.stringify(l)}`);
		if (!Array.isArray(r)) throw new _("Content should have 'parts' property with an array of Parts");
		if (r.length === 0) throw new _("Each Content should have at least one part");
		let i = {
			text: 0,
			inlineData: 0,
			functionCall: 0,
			functionResponse: 0,
			fileData: 0,
			executableCode: 0,
			codeExecutionResult: 0
		};
		for (let e of r) for (let t of q) t in e && (i[t] += 1);
		let a = fe[e];
		for (let t of q) if (!a.includes(t) && i[t] > 0) throw new _(`Content with role '${e}' can't contain '${t}' part`);
		t = !0;
	}
}
function J(e) {
	if (e.candidates === void 0 || e.candidates.length === 0) return !1;
	let t = e.candidates[0]?.content;
	if (t === void 0 || t.parts === void 0 || t.parts.length === 0) return !1;
	for (let e of t.parts) if (e === void 0 || Object.keys(e).length === 0 || e.text !== void 0 && e.text === "") return !1;
	return !0;
}
var Y = "SILENT_ERROR", me = class {
	constructor(e, t, n, r = {}) {
		this.model = t, this.params = n, this._requestOptions = r, this._history = [], this._sendPromise = Promise.resolve(), this._apiKey = e, n?.history && (pe(n.history), this._history = n.history);
	}
	async getHistory() {
		return await this._sendPromise, this._history;
	}
	async sendMessage(e, t = {}) {
		await this._sendPromise;
		let n = G(e), r = {
			safetySettings: this.params?.safetySettings,
			generationConfig: this.params?.generationConfig,
			tools: this.params?.tools,
			toolConfig: this.params?.toolConfig,
			systemInstruction: this.params?.systemInstruction,
			cachedContent: this.params?.cachedContent,
			contents: [...this._history, n]
		}, i = Object.assign(Object.assign({}, this._requestOptions), t), a;
		return this._sendPromise = this._sendPromise.then(() => U(this._apiKey, this.model, r, i)).then((e) => {
			if (J(e.response)) {
				this._history.push(n);
				let t = Object.assign({
					parts: [],
					role: "model"
				}, e.response.candidates?.[0].content);
				this._history.push(t);
			} else {
				let t = N(e.response);
				t && console.warn(`sendMessage() was unsuccessful. ${t}. Inspect response object for details.`);
			}
			a = e;
		}).catch((e) => {
			throw this._sendPromise = Promise.resolve(), e;
		}), await this._sendPromise, a;
	}
	async sendMessageStream(e, t = {}) {
		await this._sendPromise;
		let n = G(e), r = {
			safetySettings: this.params?.safetySettings,
			generationConfig: this.params?.generationConfig,
			tools: this.params?.tools,
			toolConfig: this.params?.toolConfig,
			systemInstruction: this.params?.systemInstruction,
			cachedContent: this.params?.cachedContent,
			contents: [...this._history, n]
		}, i = Object.assign(Object.assign({}, this._requestOptions), t), a = H(this._apiKey, this.model, r, i);
		return this._sendPromise = this._sendPromise.then(() => a).catch((e) => {
			throw Error(Y);
		}).then((e) => e.response).then((e) => {
			if (J(e)) {
				this._history.push(n);
				let t = Object.assign({}, e.candidates[0].content);
				t.role ||= "model", this._history.push(t);
			} else {
				let t = N(e);
				t && console.warn(`sendMessageStream() was unsuccessful. ${t}. Inspect response object for details.`);
			}
		}).catch((e) => {
			e.message !== Y && console.error(e);
		}), a;
	}
};
async function he(e, t, n, r) {
	return (await O(t, C.COUNT_TOKENS, e, !1, JSON.stringify(n), r)).json();
}
async function ge(e, t, n, r) {
	return (await O(t, C.EMBED_CONTENT, e, !1, JSON.stringify(n), r)).json();
}
async function _e(e, t, n, r) {
	let i = n.requests.map((e) => Object.assign(Object.assign({}, e), { model: t }));
	return (await O(t, C.BATCH_EMBED_CONTENTS, e, !1, JSON.stringify({ requests: i }), r)).json();
}
var X = class {
	constructor(e, t, n = {}) {
		this.apiKey = e, this._requestOptions = n, this.model = t.model.includes("/") ? t.model : `models/${t.model}`, this.generationConfig = t.generationConfig || {}, this.safetySettings = t.safetySettings || [], this.tools = t.tools, this.toolConfig = t.toolConfig, this.systemInstruction = W(t.systemInstruction), this.cachedContent = t.cachedContent;
	}
	async generateContent(e, t = {}) {
		let n = K(e), r = Object.assign(Object.assign({}, this._requestOptions), t);
		return U(this.apiKey, this.model, Object.assign({
			generationConfig: this.generationConfig,
			safetySettings: this.safetySettings,
			tools: this.tools,
			toolConfig: this.toolConfig,
			systemInstruction: this.systemInstruction,
			cachedContent: this.cachedContent?.name
		}, n), r);
	}
	async generateContentStream(e, t = {}) {
		let n = K(e), r = Object.assign(Object.assign({}, this._requestOptions), t);
		return H(this.apiKey, this.model, Object.assign({
			generationConfig: this.generationConfig,
			safetySettings: this.safetySettings,
			tools: this.tools,
			toolConfig: this.toolConfig,
			systemInstruction: this.systemInstruction,
			cachedContent: this.cachedContent?.name
		}, n), r);
	}
	startChat(e) {
		return new me(this.apiKey, this.model, Object.assign({
			generationConfig: this.generationConfig,
			safetySettings: this.safetySettings,
			tools: this.tools,
			toolConfig: this.toolConfig,
			systemInstruction: this.systemInstruction,
			cachedContent: this.cachedContent?.name
		}, e), this._requestOptions);
	}
	async countTokens(e, t = {}) {
		let n = ue(e, {
			model: this.model,
			generationConfig: this.generationConfig,
			safetySettings: this.safetySettings,
			tools: this.tools,
			toolConfig: this.toolConfig,
			systemInstruction: this.systemInstruction,
			cachedContent: this.cachedContent
		}), r = Object.assign(Object.assign({}, this._requestOptions), t);
		return he(this.apiKey, this.model, n, r);
	}
	async embedContent(e, t = {}) {
		let n = de(e), r = Object.assign(Object.assign({}, this._requestOptions), t);
		return ge(this.apiKey, this.model, n, r);
	}
	async batchEmbedContents(e, t = {}) {
		let n = Object.assign(Object.assign({}, this._requestOptions), t);
		return _e(this.apiKey, this.model, e, n);
	}
}, ve = class {
	constructor(e) {
		this.apiKey = e;
	}
	getGenerativeModel(e, t) {
		if (!e.model) throw new _("Must provide a model name. Example: genai.getGenerativeModel({ model: 'my-model-name' })");
		return new X(this.apiKey, e, t);
	}
	getGenerativeModelFromCachedContent(e, t, n) {
		if (!e.name) throw new b("Cached content must contain a `name` field.");
		if (!e.model) throw new b("Cached content must contain a `model` field.");
		for (let n of ["model", "systemInstruction"]) if (t?.[n] && e[n] && t?.[n] !== e[n]) {
			if (n === "model" && (t.model.startsWith("models/") ? t.model.replace("models/", "") : t.model) === (e.model.startsWith("models/") ? e.model.replace("models/", "") : e.model)) continue;
			throw new b(`Different value for "${n}" specified in modelParams (${t[n]}) and cachedContent (${e[n]})`);
		}
		let r = Object.assign(Object.assign({}, t), {
			model: e.model,
			tools: e.tools,
			toolConfig: e.toolConfig,
			systemInstruction: e.systemInstruction,
			cachedContent: e
		});
		return new X(this.apiKey, r, n);
	}
}, Z = process.env.GEMINI_API_KEY || "", ye = new ve(Z);
async function be(e, t) {
	if (!Z) throw Error("No se ha configurado la clave API de Gemini. Exporta GEMINI_API_KEY en tu terminal.");
	let n = ye.getGenerativeModel({ model: "gemini-1.5-flash" }), r = `
  Eres un experto modificador de motos (Copiloto de ModSim).
  El usuario te pide hacer una modificación a su moto.
  Configuración actual y piezas modificadas hasta ahora: ${JSON.stringify(t)}

  Tu trabajo es interpretar su solicitud y responder EXCLUSIVAMENTE en formato JSON.
  
  El JSON debe seguir este esquema exacto:
  {
    "modifications": {
      "rearTire": { "width": number, "profile": number, "rim": number }, // Solo incluir si se modifica
      "sprocket": number, // Solo incluir si se modifica
      "chainring": number // Solo incluir si se modifica
    },
    "explanation": "Breve explicación en lenguaje natural de qué hace esta modificación, amigable.",
    "warnings": ["Advertencia 1 si el velocímetro se descalibra mucho o se pierde demasiada aceleración", "Advertencia 2 si aplica"] // OPCIONAL
  }
  
  No incluyas formato markdown como \`\`\`json. Solo devuelve el objeto puro.
  `;
	try {
		let t = (await n.generateContent(`${r}\n\nUsuario: ${e}`)).response.text().replace(/```json/gi, "").replace(/```/gi, "").trim();
		return JSON.parse(t);
	} catch (e) {
		throw Error(`Error en el copiloto: ${e.message}`);
	}
}
//#endregion
//#region src/main/index.ts
var xe = a(import.meta.url), Q = i.dirname(xe);
process.env.DIST = i.join(Q, "../"), process.env.VITE_PUBLIC = n.isPackaged ? process.env.DIST : i.join(process.env.DIST, "../public");
var $;
function Se() {
	$ = new e({
		width: 1200,
		height: 800,
		minWidth: 1100,
		minHeight: 700,
		webPreferences: {
			preload: i.join(Q, "preload.mjs"),
			contextIsolation: !0,
			nodeIntegration: !1
		},
		backgroundColor: "#0f172a",
		title: "ModSim"
	}), t.setApplicationMenu(null), process.env.VITE_DEV_SERVER_URL ? $.loadURL(process.env.VITE_DEV_SERVER_URL) : $.loadFile(i.join(process.env.DIST || "", "index.html"));
}
n.on("ready", () => {
	Se(), r.handle("ask-copilot", async (e, t, n) => {
		try {
			return {
				success: !0,
				data: await be(t, n)
			};
		} catch (e) {
			return {
				success: !1,
				error: e.message
			};
		}
	});
}), n.on("window-all-closed", () => {
	process.platform !== "darwin" && n.quit();
});
//#endregion
export {};
