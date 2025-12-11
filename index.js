const fs = require('fs');
const OpenAI = require('openai');
const path = require('path');

// Read the input JSON file
// Get filename from command line arg or default to 'input.json'
const inputFileName = process.argv[2] || 'input.json';
const inputFilePath = path.isAbsolute(inputFileName) ? inputFileName : path.join(__dirname, inputFileName);

async function main() {
  try {
    console.log(`[INFO] Reading config from: ${inputFilePath}`);

    // 1. Read content from local json file
    if (!fs.existsSync(inputFilePath)) {
      console.error(`[ERROR] File not found at ${inputFilePath}`);
      process.exit(1);
    }

    const fileContent = fs.readFileSync(inputFilePath, 'utf8');
    const inputData = JSON.parse(fileContent);

    // Support both camelCase (original) and snake_case (CustomPrompt.json)
    const { inputFields, knowledgeSources, prompt, outputFields, input_fields, knowledge_sources, output_fields } = inputData;
    const finalInputs = inputFields || input_fields;
    const finalOutputs = outputFields || output_fields;
    const finalKnowledgeSources = knowledgeSources || knowledge_sources;

    // Validate required fields
    if (!finalInputs || !prompt || !finalOutputs) {
      console.error("Error: JSON must contain 'inputFields' (or 'input_fields'), 'prompt', and 'outputFields' (or 'output_fields').");
      process.exit(1);
    }

    console.log('[INFO] Initializing OpenAI client...');
    // 2. Initialize OpenAI client
    // Ensure OPENAI_API_KEY is set in your environment variables
    const key = 'xxx'
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || key,
    });

    // 3. Construct the prompt
    // We construct a structured prompt to guide the model
    let constructedPrompt = `Task: ${prompt}\n\n`;

    if (finalKnowledgeSources && finalKnowledgeSources.length > 0) {
      let ks = ''
      for (const k of finalKnowledgeSources) {
        if (fs.existsSync(k)) {
          ks += fs.readFileSync(k, 'utf8') + '\n\n';
        }
      }
      constructedPrompt += `Knowledge Sources:\n${ks}\n\n`;
    }

    constructedPrompt += `Input Data:\n${JSON.stringify(finalInputs, null, 2)}\n\n`;
    
    constructedPrompt += `Please analyze the input data based on the task and knowledge sources.\n`;
    constructedPrompt += `Return the result strictly in JSON format matching the following structure:\n${JSON.stringify(finalOutputs, null, 2)}`;
    console.log('[INFO] Constructed Prompt:\n', constructedPrompt);
    console.log('[INFO] Sending request to OpenAI API...');

    // 4. Call OpenAI API
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant designed to output JSON." },
        { role: "user", content: constructedPrompt },
        { role: "user", content: "Please output the result in JSON format." }

      ],
      model: "gpt-5", // Or "gpt-4" if preferred
      response_format: { type: "json_object" }, // Enforce JSON mode
    });

    console.log('[INFO] Received response from OpenAI.');

    // 5. Get the result and return/print it
    const result = completion.choices[0].message.content;
    
    // Parse it to ensure it's valid JSON before printing
    try {
      const jsonResult = JSON.parse(result);
      console.log(JSON.stringify(jsonResult, null, 2));
    } catch (e) {
      console.error("Failed to parse OpenAI response as JSON:", result);
    }

  } catch (error) {
    console.error("Error occurred:", error);
  }
}

main();
