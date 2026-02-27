# Regenerate Personal Development Journals script

The API supports finding the guide by product name and using a custom prompt. To regenerate **right now**:

1. **Start the app** and log in: `npm run dev`
2. **Open the app in your browser** (e.g. http://localhost:3000)
3. **Open DevTools** (F12) → **Console**
4. **Paste and run** this (it will find the guide, call the new prompt, and update the DB):

```js
fetch('/api/video-guide/regenerate-full-script', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    findByProductName: 'Personal Development Journals',
    customUserPrompt: `HOOK: Start with a specific pain point about journaling or self-development. NOT the product name. Make it feel real and relatable.

BODY: Agitate the problem (why people fail at self-development), then naturally introduce Personal Development Journals as the solution. Keep it conversational. Short sentences.

CTA: One clear action. Link in bio. Urgent but human.

Rules:
- Product name appears ONCE only
- Max 15 words per sentence
- No corporate language
- Write like a real TikTok creator talking to camera`
  })
})
  .then((r) => r.json())
  .then((data) => {
    if (data.script) {
      console.log('Script updated:', data.script);
    } else {
      console.error('Error:', data);
    }
  })
  .catch(console.error);
```

5. Refresh the Video Guide page to see the new script.
