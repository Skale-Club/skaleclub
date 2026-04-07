import fetch from "node-fetch";

async function testTranslation() {
  console.log("🧪 Testing Translation API...\n");

  const testTexts = [
    "Welcome to Skale Club",
    "We help you grow your business",
    "Contact Us",
    "Our Services"
  ];

  try {
    console.log("📤 Sending translation request...");
    console.log("Texts:", testTexts);
    console.log("Target Language: pt\n");

    const response = await fetch("http://localhost:1000/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        texts: testTexts,
        targetLanguage: "pt",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("📥 Translation Response:\n");
    console.log(JSON.stringify(data, null, 2));

    console.log("\n✅ Translation API test completed!");
  } catch (error) {
    console.error("\n❌ Translation API test failed:", error);
    process.exit(1);
  }
}

testTranslation();
