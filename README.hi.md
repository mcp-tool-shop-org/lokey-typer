<p align="center">
  <strong>English</strong> | <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/LoKey-Typer/readme.png" alt="LoKey Typer" width="400" />
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/lokey-typer/actions/workflows/deploy.yml"><img src="https://github.com/mcp-tool-shop-org/lokey-typer/actions/workflows/deploy.yml/badge.svg" alt="Deploy"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License"></a>
  <a href="https://mcp-tool-shop-org.github.io/lokey-typer/"><img src="https://img.shields.io/badge/Pages-target-blue" alt="Pages target"></a>
  <a href="https://apps.microsoft.com/detail/9NRVWM08HQC4"><img src="https://img.shields.io/badge/Microsoft_Store-available-blue" alt="Microsoft Store"></a>
</p>

एक शांत टाइपिंग अभ्यास ऐप, जिसमें सुखदायक ध्वनियाँ हैं, व्यक्तिगत दैनिक अभ्यास सेट उपलब्ध हैं, और इसके लिए किसी खाते की आवश्यकता नहीं है।

## यह क्या है।

LoKey Typer एक टाइपिंग अभ्यास ऐप है, जिसे वयस्कों के लिए बनाया गया है जो बिना किसी खेल के तत्वों, लीडरबोर्ड या अन्य विकर्षणों के, शांत और केंद्रित अभ्यास सत्र चाहते हैं।

सभी डेटा आपके डिवाइस पर ही रहता है। कोई खाता नहीं, कोई क्लाउड नहीं, और कोई ट्रैकिंग भी नहीं।

## अभ्यास मोड।

- **ध्यान केंद्रित:** लय और सटीकता विकसित करने के लिए शांत और व्यवस्थित अभ्यास।
- **वास्तविक जीवन:** ईमेल, कोड के अंश और रोजमर्रा के पाठ के साथ अभ्यास।
- **प्रतिस्पर्धात्मक:** समयबद्ध अभ्यास सत्र, जिसमें आपकी व्यक्तिगत सर्वश्रेष्ठ प्रदर्शन का रिकॉर्ड रखा जाता है।
- **दैनिक अभ्यास:** हर दिन नए अभ्यासों का सेट, जो आपके हालिया सत्रों के अनुसार अनुकूलित होता है।

## विशेषताएं।

- ध्यान केंद्रित करने में मदद करने वाले परिवेशीय ध्वनियाँ। सेटिंग में केवल वे श्रेणियाँ दिखती हैं जिनका ट्रैक मौजूद है।
- मैकेनिकल टाइपराइटर की कीबोर्ड की आवाज़ (वैकल्पिक)।
- हाल के सत्रों के आधार पर व्यक्तिगत दैनिक अभ्यास।
- पहली बार डाउनलोड करने के बाद पूरी तरह से ऑफलाइन उपयोग की सुविधा।
- सुलभ: स्क्रीन रीडर मोड, गति कम करने का विकल्प, ध्वनि वैकल्पिक।

## स्थापित करें।

**माइक्रोसॉफ्ट स्टोर** (अनुशंसित):
[इसे माइक्रोसॉफ्ट स्टोर से प्राप्त करें](https://apps.microsoft.com/detail/9NRVWM08HQC4)

**ब्राउज़र:**
`npm run dev` चलाएँ और स्थानीय पता खोलें। यह रिपॉजिटरी सार्वजनिक होने के बाद Pages वर्कफ़्लो ऐप को [Pages लक्ष्य](https://mcp-tool-shop-org.github.io/lokey-typer/) पर प्रकाशित करता है। पुस्तिका उसी साइट के `/handbook/` पर होती है। तब तक वह पता एक चलता हुआ ऐप नहीं है।

## गोपनीयता।

लोकी टाइपर कोई भी डेटा एकत्र नहीं करता है। सभी प्राथमिकताएं, उपयोग का इतिहास और व्यक्तिगत सर्वश्रेष्ठ रिकॉर्ड आपके ब्राउज़र में स्थानीय रूप से संग्रहीत किए जाते हैं। पूरी [गोपनीयता नीति](https://mcp-tool-shop-org.github.io/lokey-typer/privacy.html) देखें। वह पृष्ठ साइट के साथ प्रकाशित होता है। यह रिपॉजिटरी सार्वजनिक होने तक वह पता उपलब्ध नहीं है।

## लाइसेंस।

एमआईटी। लाइसेंस के लिए [LICENSE] देखें।

---

## विकास।

### स्थानीय रूप से चलाएं।

```bash
npm ci
npm run dev
```

### बनाना।

```bash
npm run build
npm run preview
```

### स्क्रिप्टें।

- `npm run dev` — डेवलपमेंट सर्वर
- `npm run build` — टाइप चेकिंग + प्रोडक्शन बिल्ड
- `npm run typecheck` — केवल टाइपस्क्रिप्ट की टाइप चेकिंग
- `npm run lint` — ईएसएलइंट
- `npm run preview` — स्थानीय रूप से प्रोडक्शन बिल्ड का पूर्वावलोकन
- `npm run validate:content` — सभी कंटेंट पैकों के लिए स्कीमा और संरचनात्मक सत्यापन
- `npm run gen:phase2-content` — फेज 2 के पैकों को फिर से जेनरेट करें
- `npm run smoke:rotation` — नवीनता/रोटेशन स्मोक टेस्ट
- `npm run qa:ambient:assets` — एंबिएंट WAV एसेट की जांच
- `npm run qa:sound-design` — साउंड डिजाइन स्वीकृति जांच
- `npm run qa:phase3:novelty` — दैनिक सेट नवीनता सिमुलेशन
- `npm run qa:phase3:recommendation` — अनुशंसा सिमुलेशन (तर्कसंगतता जांच)

### कोड की संरचना।

- `src/app` — एप्लिकेशन का ढांचा (राउटर, शैल/लेआउट, वैश्विक प्रदाता)
- `src/features` — विशिष्ट सुविधाओं से संबंधित यूआई (पेज + फीचर घटक)
- `src/lib` — साझा डोमेन लॉजिक (भंडारण, टाइपिंग, मेट्रिक्स, ऑडियो/एम्बिएंट, आदि)
- `src/content` — सामग्री के प्रकार + सामग्री पैकेज लोडिंग

"मॉड्यूलर" से संबंधित आर्किटेक्चर, अनुबंधों और आयात सीमाओं के बारे में जानकारी के लिए `modular.md` देखें।

### आयात के उपनाम।

- `@app` → `src/app`
- `@features` → `src/features`
- `@content` → `src/content`
- `@lib` → `src/lib/public` (सार्वजनिक एपीआई इंटरफेस)
- `@lib-internal` → `src/lib` (केवल ऐप के आंतरिक कार्यों/प्रदाताओं के लिए)

### मार्ग।

- `/` — होम (मुख्य पृष्ठ)
- `/daily` — दैनिक सेट
- `/focus` — फोकस मोड
- `/real-life` — वास्तविक जीवन मोड
- `/competitive` — प्रतिस्पर्धात्मक मोड
- `/<mode>/exercises` — व्यायाम की सूची
- `/<mode>/settings` — सेटिंग्स
- `/<mode>/run/:exerciseId` — किसी व्यायाम को चलाएं

### दस्तावेज़।

- `modular.md` — आर्किटेक्चर + इम्पोर्ट बाउंड्री कॉन्ट्रैक्ट
- `docs/sound-design.md` — एंबिएंट साउंड डिजाइन फ्रेमवर्क
- `docs/sound-design-manifesto.md` — साउंड डिजाइन घोषणापत्र + स्वीकृति परीक्षण
- `docs/sound-philosophy.md` — सार्वजनिक रूप से प्रस्तुत साउंड दर्शन
- `docs/accessibility-commitment.md` — पहुंच संबंधी प्रतिबद्धता
- `docs/how-personalization-works.md` — पर्सनलाइजेशन का स्पष्टीकरण
