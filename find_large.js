const fs = require('fs');
const readline = require('readline');

async function findWriteFile() {
  const fileStream = fs.createReadStream('C:/Users/puri/.gemini/antigravity/brain/29c907ab-ada4-4a29-a959-89464e5ba221/.system_generated/logs/transcript_full.jsonl');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let best = '';
  for await (const line of rl) {
    if (line.includes('write_file') && line.includes('pages/project') && line.includes('SLOT 1')) {
      try {
        const obj = JSON.parse(line);
        for (const tc of obj.tool_calls || []) {
          if (tc.name === 'write_file' && tc.args && tc.args.Content && tc.args.Content.length > best.length) {
            best = tc.args.Content;
          }
        }
      } catch (e) {}
    }
  }
  if (best) {
    fs.writeFileSync('frontend/pages/project/detail_restored.vue', best);
    console.log('Saved best! length:', best.length);
  } else {
    console.log('None found with SLOT 1');
  }
}

findWriteFile();

